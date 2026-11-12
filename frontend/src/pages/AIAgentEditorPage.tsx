import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Eye, EyeOff, RefreshCw, Send, BookOpen, Plus, Trash2,
  CheckCircle2, AlertCircle, Sparkles, Database, Image, MessageSquare, Bot, Loader2, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAgentService, aiMediaService, knowledgeService, AiAgentPayload } from '../services/index';
import { AiAgent, AiProvider, AiKnowledge, AiMedia, AiMediaTrigger, AiTestResponseResult } from '../types';
import { providerMeta, PROVIDER_ORDER } from '../constants/aiProviders';
import { Spinner } from '../components/ui/index';

type Tab = 'config' | 'knowledge' | 'media' | 'test';

interface FormState {
  name: string;
  description: string;
  provider: AiProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  provider: 'OPENAI',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: '',
  isActive: true,
};

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  usedKnowledge?: string[];
  usedMedia?: string[];
  attachments?: AiMediaAttachment[];
}

export default function AIAgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id && id !== 'new');
  const agentId = isEdit ? (id as string) : undefined;

  const [tab, setTab] = useState<Tab>('config');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Knowledge form + test chat
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  // Knowledge yang dibuat sebelum agent disimpan (mode Create).
  const [pendingKnowledge, setPendingKnowledge] = useState<{ title: string; content: string }[]>([]);
  // Media/gambar yang dibuat sebelum agent disimpan (mode Create).
  const [pendingMedia, setPendingMedia] = useState<{ title: string; mediaUrl: string; caption?: string | null; description?: string; keywords?: string; trigger: AiMediaTrigger }[]>([]);
  const [mbTitle, setMbTitle] = useState('');
  const [mbUrl, setMbUrl] = useState('');
  const [mbCaption, setMbCaption] = useState('');
  const [mbDesc, setMbDesc] = useState('');
  const [mbKeywords, setMbKeywords] = useState('');
  const [mbTrigger, setMbTrigger] = useState<AiMediaTrigger>('KEYWORD');
  const [testMessage, setTestMessage] = useState('');
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [useMedia, setUseMedia] = useState(false);
  const [chat, setChat] = useState<ChatTurn[]>([]);

  const { data: providers } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: aiAgentService.providers,
    staleTime: 5 * 60 * 1000,
  });

  const { data: agent, isLoading: loadingAgent } = useQuery({
    queryKey: ['ai-agent', agentId],
    queryFn: () => aiAgentService.get(agentId as string),
    enabled: isEdit,
  });

  const { data: knowledge, isLoading: loadingKnowledge } = useQuery({
    queryKey: ['ai-knowledge', agentId],
    queryFn: () => knowledgeService.list(agentId as string),
    enabled: isEdit,
  });

  const { data: media, isLoading: loadingMedia } = useQuery({
    queryKey: ['ai-media', agentId],
    queryFn: () => aiMediaService.list(agentId as string),
    enabled: isEdit,
  });

  // Hydrate form from a loaded agent (only once per agent).
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!agent) return;
    if (hydratedFor.current === agent.id) return;
    hydratedFor.current = agent.id;
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      provider: agent.provider,
      apiKey: '',
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      systemPrompt: agent.systemPrompt ?? '',
      isActive: agent.isActive,
    });
  }, [agent]);

  // Keep the model dropdown populated for the selected provider.
  useEffect(() => {
    const p = providers?.find(x => x.id === form.provider);
    if (p) setModelOptions(p.models);
  }, [providers, form.provider]);

  const meta = providerMeta[form.provider];
  const ProviderIcon = meta?.icon ?? Bot;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => (e[key as string] ? { ...e, [key as string]: '' } : e));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Nama agent wajib diisi';
    if (!form.model.trim()) next.model = 'Model wajib dipilih';
    if (!isEdit && !form.apiKey.trim()) next.apiKey = 'API key wajib diisi';
    if (form.temperature < 0 || form.temperature > 2) next.temperature = 'Temperature harus antara 0 dan 2';
    if (form.maxTokens < 1 || form.maxTokens > 100000) next.maxTokens = 'Max tokens tidak valid';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async (payload: AiAgentPayload) => {
      if (isEdit) return aiAgentService.update(agentId as string, payload);
      const saved = await aiAgentService.create(payload);
      // Simpan knowledge dan media yang diinput sebelum agent dibuat.
      await Promise.all([
        ...pendingKnowledge.map(k => knowledgeService.create(saved.id, k)),
        ...pendingMedia.map(m => aiMediaService.create(saved.id, {
          title: m.title,
          mediaUrl: m.mediaUrl,
          caption: m.caption || undefined,
          description: m.description,
          keywords: m.keywords,
          trigger: m.trigger,
        })),
      ]);
      return saved;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      qc.invalidateQueries({ queryKey: ['ai-agent', saved.id] });
      toast.success(isEdit ? 'Perubahan disimpan' : 'AI Agent berhasil dibuat');
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3000);
      if (!isEdit) {
        setPendingKnowledge([]);
        setPendingMedia([]);
        navigate(`/ai-agents/${saved.id}`, { replace: true });
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menyimpan AI Agent'),
  });

  const loadModelsMutation = useMutation({
    mutationFn: () => aiAgentService.models(form.provider, form.apiKey || undefined, agentId),
    onSuccess: (models) => {
      setModelOptions(models);
      if (models.length && !form.model) set('model', models[0]);
      toast.success(`${models.length} model dimuat`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal memuat model'),
  });

  const testConnectionMutation = useMutation({
    mutationFn: () =>
      aiAgentService.testConnection(form.provider, form.apiKey || undefined, agentId) as any,
    onSuccess: (res: any) => {
      setConnectionResult({ ok: true, message: `Terhubung. ${res?.modelCount ?? 0} model tersedia.` });
      toast.success('Koneksi berhasil');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Koneksi gagal';
      setConnectionResult({ ok: false, message: msg });
      toast.error(msg);
    },
  });

  const testResponseMutation = useMutation({
    mutationFn: () =>
      aiAgentService.testResponse({
        agentId,
        provider: agentId ? undefined : form.provider,
        model: form.model,
        apiKey: form.apiKey || undefined,
        systemPrompt: form.systemPrompt,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        message: testMessage.trim(),
        useKnowledge,
        useMedia,
        knowledge: isEdit ? undefined : pendingKnowledge,
      }),
    onSuccess: (res: AiTestResponseResult) => {
      setChat(c => [
        ...c,
        { role: 'user', content: testMessage.trim() },
        { role: 'assistant', content: res.reply || '(kosong)', usedKnowledge: res.usedKnowledge, usedMedia: res.usedMedia, attachments: res.attachments },
      ]);
      setTestMessage('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menguji respons AI'),
  });

  const addKnowledgeMutation = useMutation({
    mutationFn: () => knowledgeService.create(agentId as string, { title: kbTitle.trim(), content: kbContent.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge', agentId] });
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      setKbTitle('');
      setKbContent('');
      toast.success('Knowledge ditambahkan');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menambah knowledge'),
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: (kid: string) => knowledgeService.delete(agentId as string, kid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge', agentId] });
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Knowledge dihapus');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menghapus knowledge'),
  });

  const addMediaMutation = useMutation({
    mutationFn: () => aiMediaService.create(agentId as string, {
      title: mbTitle.trim(),
      mediaUrl: mbUrl.trim(),
      caption: mbCaption.trim() || undefined,
      description: mbDesc.trim() || undefined,
      keywords: mbKeywords.trim() || undefined,
      trigger: mbTrigger,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-media', agentId] });
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      setMbTitle(''); setMbUrl(''); setMbCaption(''); setMbDesc(''); setMbKeywords(''); setMbTrigger('KEYWORD');
      toast.success('Media ditambahkan');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menambah media'),
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (mid: string) => aiMediaService.delete(agentId as string, mid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-media', agentId] });
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Media dihapus');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menghapus media'),
  });

  const handleSave = () => {
    if (!validate()) {
      setTab('config');
      toast.error('Lengkapi field yang wajib diisi');
      return;
    }
    const payload: AiAgentPayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      provider: form.provider,
      model: form.model.trim(),
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      systemPrompt: form.systemPrompt.trim() || undefined,
      isActive: form.isActive,
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    };
    saveMutation.mutate(payload);
  };

  const handleTestResponse = () => {
    if (!testMessage.trim()) {
      toast.error('Tulis pesan uji terlebih dahulu');
      return;
    }
    testResponseMutation.mutate();
  };

  const handleAddKnowledge = () => {
    if (!kbTitle.trim() || !kbContent.trim()) {
      toast.error('Judul dan isi knowledge wajib diisi');
      return;
    }
    if (isEdit) {
      addKnowledgeMutation.mutate();
      return;
    }
    // Mode Create: tampung dulu, disimpan otomatis saat agent dibuat.
    setPendingKnowledge(list => [...list, { title: kbTitle.trim(), content: kbContent.trim() }]);
    setKbTitle('');
    setKbContent('');
    toast.success('Knowledge ditambahkan (akan disimpan bersama agent)');
  };

  const handleDeleteKnowledge = (id: string | undefined, index: number, title: string) => {
    if (!window.confirm(`Hapus knowledge "${title}"?`)) return;
    if (isEdit && id) {
      deleteKnowledgeMutation.mutate(id);
      return;
    }
    setPendingKnowledge(list => list.filter((_, i) => i !== index));
    toast.success('Knowledge dihapus');
  };

  const handleAddMedia = () => {
    if (!mbTitle.trim() || !mbUrl.trim()) {
      toast.error('Judul dan URL gambar wajib diisi');
      return;
    }
    const item = {
      title: mbTitle.trim(),
      mediaUrl: mbUrl.trim(),
      caption: mbCaption.trim() || undefined,
      description: mbDesc.trim() || undefined,
      keywords: mbKeywords.trim() || undefined,
      trigger: mbTrigger,
    };
    if (isEdit) {
      addMediaMutation.mutate();
      return;
    }
    setPendingMedia(list => [...list, item]);
    setMbTitle(''); setMbUrl(''); setMbCaption(''); setMbDesc(''); setMbKeywords(''); setMbTrigger('KEYWORD');
    toast.success('Media ditambahkan (akan disimpan bersama agent)');
  };

  const handleDeleteMedia = (id: string | undefined, index: number, title: string) => {
    if (!window.confirm(`Hapus media "${title}"?`)) return;
    if (isEdit && id) {
      deleteMediaMutation.mutate(id);
      return;
    }
    setPendingMedia(list => list.filter((_, i) => i !== index));
    toast.success('Media dihapus');
  };

  const tabs: { id: Tab; label: string; icon: typeof Bot; disabled?: boolean }[] = [
    { id: 'config', label: 'Configuration', icon: Sparkles },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'media', label: 'Media', icon: Image },
    { id: 'test', label: 'Test', icon: MessageSquare },
  ];

  const knowledgeList = Array.isArray(knowledge) ? (knowledge as AiKnowledge[]) : [];
  const mediaList = Array.isArray(media) ? (media as AiMedia[]) : [];
  // Di mode Create, knowledge/media ditampung lokal dulu sampai agent disimpan.
  const displayKnowledge = isEdit
    ? knowledgeList.map(k => ({ id: k.id as string | undefined, title: k.title, content: k.content }))
    : pendingKnowledge.map(k => ({ id: undefined as string | undefined, title: k.title, content: k.content }));
  const displayMedia = isEdit
    ? mediaList.map(m => ({ id: m.id as string | undefined, title: m.title, mediaUrl: m.mediaUrl, caption: m.caption, description: m.description, keywords: m.keywords, trigger: m.trigger }))
    : pendingMedia.map(m => ({ id: undefined as string | undefined, ...m }));

  const keyPlaceholder = useMemo(() => {
    const p = providers?.find(x => x.id === form.provider);
    return p?.keyPlaceholder ?? 'API key';
  }, [providers, form.provider]);

  if (isEdit && loadingAgent) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <button
          onClick={() => navigate('/ai-agents')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AI Agents
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (meta?.color ?? '#18a6fc') + '20' }}>
              <ProviderIcon className="w-6 h-6" style={{ color: meta?.color ?? '#18a6fc' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {isEdit ? form.name || 'Edit AI Agent' : 'Create New AI Agent'}
              </h1>
              <p className="text-sm text-gray-500">
                {isEdit ? 'Perbarui konfigurasi, knowledge base, dan uji agent.' : 'Konfigurasi provider, model, dan instruksi agent.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {savedFlash && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-success font-medium">
                <CheckCircle2 className="w-4 h-4" /> Tersimpan
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gradient-btn px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                disabled={t.disabled}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                } ${t.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Configuration tab */}
        {tab === 'config' && (
          <div className="space-y-6">
            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Informasi Dasar</h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Name <span className="text-danger">*</span></label>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. CS WhatsApp Assistant"
                    className={`w-full rounded-xl border ${errors.name ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
                  />
                  {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={2}
                    placeholder="Deskripsi singkat fungsi AI agent ini"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>
            </section>

            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Provider & Model</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {PROVIDER_ORDER.map(p => {
                  const m = providerMeta[p];
                  const Icon = m.icon;
                  const active = form.provider === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { set('provider', p); setModelOptions(providers?.find(x => x.id === p)?.models ?? []); setConnectionResult(null); }}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition ${
                        active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" style={{ color: m.color }} />
                      <span className="text-xs font-medium text-gray-700">{m.short}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <label className="text-sm font-medium text-gray-700">
                  API Key {!isEdit && <span className="text-danger">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={e => set('apiKey', e.target.value)}
                    placeholder={isEdit ? 'Biarkan kosong untuk memakai key tersimpan' : keyPlaceholder}
                    autoComplete="off"
                    className={`w-full rounded-xl border ${errors.apiKey ? 'border-danger' : 'border-gray-300'} bg-white pl-3 pr-10 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title={showKey ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.apiKey && <p className="text-xs text-danger">{errors.apiKey}</p>}
                {isEdit && agent?.hasApiKey && !form.apiKey && (
                  <p className="text-xs text-gray-400">API key tersimpan dan terenkripsi. Isi hanya jika ingin mengganti.</p>
                )}
              </div>

              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Model <span className="text-danger">*</span></label>
                  <button
                    type="button"
                    onClick={() => loadModelsMutation.mutate()}
                    disabled={loadModelsMutation.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadModelsMutation.isPending ? 'animate-spin' : ''}`} />
                    Load Models
                  </button>
                </div>
                <input
                  list="ai-model-options"
                  value={form.model}
                  onChange={e => set('model', e.target.value)}
                  placeholder="Pilih atau ketik nama model"
                  className={`w-full rounded-xl border ${errors.model ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
                />
                <datalist id="ai-model-options">
                  {modelOptions.map(m => <option key={m} value={m} />)}
                </datalist>
                {errors.model && <p className="text-xs text-danger">{errors.model}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Temperature</label>
                  <input
                    type="number" step="0.1" min={0} max={2}
                    value={form.temperature}
                    onChange={e => set('temperature', Number(e.target.value))}
                    className={`w-full rounded-xl border ${errors.temperature ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
                  />
                  <span className="text-xs text-gray-400">0 = deterministik, 2 = paling kreatif</span>
                  {errors.temperature && <p className="text-xs text-danger">{errors.temperature}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Max Tokens</label>
                  <input
                    type="number" step="1" min={1}
                    value={form.maxTokens}
                    onChange={e => set('maxTokens', Number(e.target.value))}
                    className={`w-full rounded-xl border ${errors.maxTokens ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
                  />
                  {errors.maxTokens && <p className="text-xs text-danger">{errors.maxTokens}</p>}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">System Prompt</h2>
              <p className="text-xs text-gray-500 mb-3">Atur identitas, perilaku, instruksi, dan aturan AI.</p>
              <textarea
                value={form.systemPrompt}
                onChange={e => set('systemPrompt', e.target.value)}
                rows={7}
                placeholder="You are a helpful customer service assistant for ..."
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-y"
              />
            </section>

            <section className="glass-card rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Status</h2>
                <p className="text-xs text-gray-500">Agent nonaktif tidak akan melayani pelanggan.</p>
              </div>
              <button
                type="button"
                onClick={() => set('isActive', !form.isActive)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${form.isActive ? 'bg-success' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </section>
          </div>
        )}

        {/* Knowledge tab */}
        {tab === 'knowledge' && (
          <div className="space-y-6">
            <section className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-gray-900">Tambah Knowledge</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Knowledge base dipakai untuk RAG — AI mengambil potongan relevan sebelum menjawab pelanggan.
              </p>
              <div className="space-y-3">
                <input
                  value={kbTitle}
                  onChange={e => setKbTitle(e.target.value)}
                  placeholder="Judul (e.g. Kebijakan Pengembalian)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <textarea
                  value={kbContent}
                  onChange={e => setKbContent(e.target.value)}
                  rows={4}
                  placeholder="Isi knowledge..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-y"
                />
                <button
                  onClick={handleAddKnowledge}
                  disabled={addKnowledgeMutation.isPending}
                  className="gradient-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {addKnowledgeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Knowledge
                </button>
                {!isEdit && (
                  <p className="text-xs text-gray-400">
                    Agent belum disimpan — knowledge ini akan otomatis tersimpan saat kamu klik <span className="font-medium">Create Agent</span>.
                  </p>
                )}
              </div>
            </section>

            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Knowledge {isEdit ? 'Tersimpan' : 'Ditambahkan'} {displayKnowledge.length > 0 && <span className="text-gray-400 font-normal">({displayKnowledge.length})</span>}
              </h2>
              {isEdit && loadingKnowledge ? (
                <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-primary" /></div>
              ) : displayKnowledge.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Belum ada knowledge untuk agent ini.</p>
              ) : (
                <div className="space-y-3">
                  {displayKnowledge.map((k, index) => (
                    <div key={k.id ?? `pending-${index}`} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 text-sm">{k.title}</h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-3 whitespace-pre-wrap">{k.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteKnowledge(k.id, index, k.title)}
                        className="text-gray-300 hover:text-danger transition flex-shrink-0"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Media tab */}
        {tab === 'media' && (
          <div className="space-y-6">
            <section className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <Image className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-gray-900">Tambah Media / Gambar</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Unggah atau masukkan URL gambar yang bisa dikirim AI ke pelanggan. Pilih trigger <b>KEYWORD</b> agar gambar dikirim otomatis saat kata kunci muncul di pesan, atau <b>AI</b> agar AI memutuskan sendiri kapan mengirimnya.
              </p>
              <div className="space-y-3">
                <input
                  value={mbTitle}
                  onChange={e => setMbTitle(e.target.value)}
                  placeholder="Judul (e.g. Voucher Diskon 50%)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  value={mbUrl}
                  onChange={e => setMbUrl(e.target.value)}
                  placeholder="URL gambar (e.g. https://contoh.com/voucher.jpg)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  value={mbCaption}
                  onChange={e => setMbCaption(e.target.value)}
                  placeholder="Caption (opsional)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  value={mbDesc}
                  onChange={e => setMbDesc(e.target.value)}
                  placeholder="Deskripsi untuk AI (digunakan saat trigger = AI)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  value={mbKeywords}
                  onChange={e => setMbKeywords(e.target.value)}
                  placeholder="Kata kunci (pisahkan koma, hanya trigger KEYWORD)"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Trigger</label>
                  <select
                    value={mbTrigger}
                    onChange={e => setMbTrigger(e.target.value as AiMediaTrigger)}
                    className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="KEYWORD">KEYWORD — otomatis saat kata kunci cocok</option>
                    <option value="AI">AI — AI memutuskan sendiri</option>
                  </select>
                </div>
                <button
                  onClick={handleAddMedia}
                  disabled={addMediaMutation.isPending}
                  className="gradient-btn px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {addMediaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Media
                </button>
                {!isEdit && (
                  <p className="text-xs text-gray-400">
                    Agent belum disimpan — media ini akan otomatis tersimpan saat kamu klik <span className="font-medium">Create Agent</span>.
                  </p>
                )}
              </div>
            </section>

            <section className="glass-card rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Media {isEdit ? 'Tersimpan' : 'Ditambahkan'} {displayMedia.length > 0 && <span className="text-gray-400 font-normal">({displayMedia.length})</span>}
              </h2>
              {isEdit && loadingMedia ? (
                <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-primary" /></div>
              ) : displayMedia.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Belum ada media untuk agent ini.</p>
              ) : (
                <div className="space-y-3">
                  {displayMedia.map((m, index) => (
                    <div key={m.id ?? `pending-${index}`} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <img src={m.mediaUrl} alt={m.title} className="w-16 h-16 rounded-lg border border-gray-200 object-cover flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 text-sm">{m.title}</h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{m.mediaUrl}</p>
                        {m.caption && <p className="text-xs text-gray-500 mt-1">{m.caption}</p>}
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${m.trigger === 'AI' ? 'border-primary/20 text-primary bg-primary/5' : 'border-gray-200 text-gray-400 bg-gray-50'}`}>
                          {m.trigger}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteMedia(m.id, index, m.title)}
                        className="text-gray-300 hover:text-danger transition flex-shrink-0"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Test tab */}
        {tab === 'test' && (
          <div className="space-y-6">
            <section className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Test Connection</h2>
                    <p className="text-xs text-gray-500">Validasi API key ke provider.</p>
                  </div>
                </div>
                <button
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {testConnectionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Test Connection
                </button>
              </div>
              {connectionResult && (
                <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${connectionResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {connectionResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {connectionResult.message}
                </div>
              )}
            </section>

            <section className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Test AI Response</h2>
                  <p className="text-xs text-gray-500">Kirim pesan contoh dan lihat jawaban agent.</p>
                </div>
              </div>

              <label className="flex items-center gap-2 mb-4 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={useKnowledge} onChange={e => setUseKnowledge(e.target.checked)} className="rounded" />
                Gunakan Knowledge Base (RAG)
                {!isEdit && pendingKnowledge.length > 0 && (
                  <span className="text-xs text-gray-400">({pendingKnowledge.length} knowledge belum disimpan)</span>
                )}
              </label>
              {displayMedia.length > 0 && (
                <label className="flex items-center gap-2 mb-4 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={useMedia} onChange={e => setUseMedia(e.target.checked)} className="rounded" />
                  Kirim Gambar (Media)
                  {!isEdit && pendingMedia.filter(m => m.trigger === 'AI').length > 0 && (
                    <span className="text-xs text-gray-400">({pendingMedia.filter(m => m.trigger === 'AI').length} pilih AI)</span>
                  )}
                </label>
              )}

              {chat.length > 0 && (
                <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                  {chat.map((turn, i) => (
                    <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${turn.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {turn.content}
                        {turn.role === 'assistant' && turn.usedKnowledge && turn.usedKnowledge.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200/60 text-xs text-gray-500">
                            <BookOpen className="w-3 h-3 inline mr-1" />
                            Knowledge: {turn.usedKnowledge.join(', ')}
                          </div>
                        )}
                        {turn.role === 'assistant' && turn.usedMedia && turn.usedMedia.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200/60 text-xs text-gray-500">
                            <Image className="w-3 h-3 inline mr-1" />
                            Gambar: {turn.usedMedia.join(', ')}
                          </div>
                        )}
                        {turn.role === 'assistant' && turn.attachments && turn.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {turn.attachments.map((a, j) => (
                              <div key={a.id} className="flex flex-col items-center gap-1">
                                <img src={a.mediaUrl} alt={a.title} className="w-24 h-24 rounded-lg border border-gray-200 object-cover" />
                                <div className="text-[10px] text-gray-500 text-center truncate w-24">{a.title}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {testResponseMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTestResponse(); } }}
                  rows={2}
                  placeholder="Tulis pesan uji... (Enter untuk kirim)"
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
                />
                <button
                  onClick={handleTestResponse}
                  disabled={testResponseMutation.isPending}
                  className="gradient-btn px-4 py-3 text-sm disabled:opacity-50"
                  title="Kirim"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
