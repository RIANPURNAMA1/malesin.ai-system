import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Bot, Brain, Settings, Route, Repeat, Plug, Network, ClipboardCheck } from 'lucide-react';
import { aiAgentService, aiMediaService, knowledgeService, AiAgentPayload } from '../../services/index';
import { AiAgent, AiKnowledge, AiKnowledgeMedia, AiMedia, AiMediaTrigger, AiTestResponseResult, AiAdditionalInstruction } from '../../types';
import { Tab, ImageDraft, PendingKnowledge, KbSource, FormState, ChatTurn } from './types';
import { MAX_INSTRUCTION_CHARS, EMPTY_KB_FIELDS, EMPTY_FORM, KB_TEXT_TITLE } from './constants';
import { newInstructionId, pdfToText, urlToText, revokeImageDrafts, knowledgeKind } from './utils';
import toast from 'react-hot-toast';

/** Semua state, query, mutation, dan handler editor AI Agent. Dipakai bersama oleh semua tab
 * supaya isi form tidak hilang saat berpindah tab. */
export function useAgentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id && id !== 'new');
  const agentId = isEdit ? (id as string) : undefined;

  const [tab, setTab] = useState<Tab>('behavior');
  const [knowledgeView, setKnowledgeView] = useState<'knowledge' | 'media'>('knowledge');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState('welcome');
  const toggleSection = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const goToSection = (key: string) => {
    setActiveSection(key);
    setCollapsed(c => ({ ...c, [key]: false }));
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Knowledge form + test chat
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  // Ganti key untuk mengosongkan isi editor setelah knowledge ditambahkan.
  const [kbEditorKey, setKbEditorKey] = useState(0);
  // Knowledge yang dibuat sebelum agent disimpan (mode Create).
  const [pendingKnowledge, setPendingKnowledge] = useState<PendingKnowledge[]>([]);
  // Gambar untuk knowledge yang sedang diisi di form Tambah Knowledge.
  const [kbImages, setKbImages] = useState<ImageDraft[]>([]);
  const [kbSource, setKbSource] = useState<KbSource>('text');
  const [kbFields, setKbFields] = useState(EMPTY_KB_FIELDS);
  const [kbFiles, setKbFiles] = useState<File[]>([]);
  const [kbBusy, setKbBusy] = useState(false);
  const [kbDrag, setKbDrag] = useState(false);
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

  // Hydrate form dari agent (juga dipakai "Batalkan edit").
  const applyAgent = (a: AiAgent) => {
    setForm({
      name: a.name,
      description: a.description ?? '',
      provider: a.provider,
      apiKey: '',
      model: a.model,
      temperature: a.temperature,
      maxTokens: a.maxTokens,
      systemPrompt: a.systemPrompt ?? '',
      welcomeMessage: a.welcomeMessage ?? '',
      communicationStyle: a.communicationStyle ?? '',
      conversationFlow: a.conversationFlow ?? '',
      communicationRules: a.communicationRules ?? '',
      additionalInstructions: Array.isArray(a.additionalInstructions)
        ? a.additionalInstructions.map(item => ({
            id: item.id || newInstructionId(),
            content: item.content ?? '',
            pipeline: item.pipeline ?? '',
          }))
        : [],
      version: a.version ?? 1,
      isActive: a.isActive,
    });
    setErrors({});
  };

  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!agent) return;
    if (hydratedFor.current === agent.id) return;
    hydratedFor.current = agent.id;
    applyAgent(agent);
  }, [agent]);

  const handleCancel = () => {
    if (isEdit && agent) {
      applyAgent(agent);
      toast.success('Perubahan dibatalkan');
    } else {
      navigate('/ai-agents');
    }
  };

  // Keep the model dropdown populated for the selected provider.
  useEffect(() => {
    const p = providers?.find(x => x.id === form.provider);
    if (p) setModelOptions(p.models);
  }, [providers, form.provider]);

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
      if (kbDoc.trim()) await knowledgeService.create(saved.id, { title: KB_TEXT_TITLE, content: kbDoc.trim() });
      // Simpan knowledge (beserta gambarnya) dan media yang diinput sebelum agent dibuat.
      for (const k of pendingKnowledge) {
        const created = await knowledgeService.create(saved.id, { title: k.title, content: k.content });
        if (k.images.length) {
          await knowledgeService.addMedia(saved.id, created.id, k.images.map(img => img.file));
        }
      }
      if (pendingMedia.length) {
        await Promise.all(
          pendingMedia.map(m => aiMediaService.create(saved.id, {
            title: m.title,
            mediaUrl: m.mediaUrl,
            caption: m.caption || undefined,
            description: m.description,
            keywords: m.keywords,
            trigger: m.trigger,
          }))
        );
      }
      return saved;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      qc.invalidateQueries({ queryKey: ['ai-agent', saved.id] });
      toast.success(isEdit ? 'Perubahan disimpan' : 'AI Agent berhasil dibuat');
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3000);
      if (!isEdit) {
        pendingKnowledge.forEach(k => revokeImageDrafts(k.images));
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
    mutationFn: (message: string) =>
      aiAgentService.testResponse({
        agentId,
        // Selalu pakai provider yang sedang dipilih di form. Kalau hanya mengandalkan
        // provider tersimpan, ganti provider tanpa simpan akan mengetes model baru
        // memakai provider lama (biasanya berakhir 404 model tidak ditemukan).
        provider: form.provider,
        model: form.model,
        apiKey: form.apiKey || undefined,
        systemPrompt: form.systemPrompt,
        welcomeMessage: form.welcomeMessage,
        communicationStyle: form.communicationStyle,
        conversationFlow: form.conversationFlow,
        communicationRules: form.communicationRules,
        additionalInstructions: form.additionalInstructions
          .map(item => ({ id: item.id, content: item.content.trim(), pipeline: item.pipeline?.trim() || null }))
          .filter(item => item.content),
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        message,
        useKnowledge,
        useMedia,
        knowledge: isEdit
          ? undefined
          : [...(kbDoc.trim() ? [{ title: KB_TEXT_TITLE, content: kbDoc.trim(), images: [] }] : []), ...pendingKnowledge],
      }),
    onSuccess: (res: AiTestResponseResult) => {
      setChat(c => [
        ...c,
        { role: 'assistant', content: res.reply || '(kosong)', usedKnowledge: res.usedKnowledge, usedMedia: res.usedMedia, attachments: res.attachments, animate: true },
      ]);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Gagal menguji respons AI';
      setChat(c => [...c, { role: 'assistant', content: msg, error: true }]);
    },
  });

  const addKnowledgeMutation = useMutation({
    mutationFn: async ({ title, content, images }: { title: string; content: string; images: ImageDraft[] }) => {
      const created = await knowledgeService.create(agentId as string, { title, content });
      if (images.length) {
        await knowledgeService.addMedia(agentId as string, created.id, images.map(img => img.file));
      }
      return created;
    },
    onSuccess: (_created, variables) => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge', agentId] });
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      revokeImageDrafts(variables.images);
      resetKbForm();
      toast.success('Knowledge ditambahkan');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menambah knowledge'),
  });

  const addKnowledgeMediaMutation = useMutation({
    mutationFn: ({ knowledgeId, files }: { knowledgeId: string; files: File[] }) =>
      knowledgeService.addMedia(agentId as string, knowledgeId, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge', agentId] });
      toast.success('Gambar knowledge diupload');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal mengupload gambar'),
  });

  const deleteKnowledgeMediaMutation = useMutation({
    mutationFn: ({ knowledgeId, mediaId }: { knowledgeId: string; mediaId: string }) =>
      knowledgeService.deleteMedia(agentId as string, knowledgeId, mediaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge', agentId] });
      toast.success('Gambar knowledge dihapus');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menghapus gambar'),
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

  const addInstruction = () => {
    setForm(f => ({
      ...f,
      additionalInstructions: [...f.additionalInstructions, { id: newInstructionId(), content: '', pipeline: '' }],
    }));
  };

  const updateInstruction = (id: string, patch: Partial<AiAdditionalInstruction>) => {
    setForm(f => ({
      ...f,
      additionalInstructions: f.additionalInstructions.map(item =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  };

  const removeInstruction = (id: string) => {
    setForm(f => ({
      ...f,
      additionalInstructions: f.additionalInstructions.filter(item => item.id !== id),
    }));
  };

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
      welcomeMessage: form.welcomeMessage.trim() || null,
      communicationStyle: form.communicationStyle.trim() || null,
      conversationFlow: form.conversationFlow.trim() || null,
      communicationRules: form.communicationRules.trim() || null,
      additionalInstructions: form.additionalInstructions
        .map(item => ({
          id: item.id,
          content: item.content.trim().slice(0, MAX_INSTRUCTION_CHARS),
          pipeline: item.pipeline?.trim() || null,
        }))
        .filter(item => item.content),
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
    if (testResponseMutation.isPending) return;
    const message = testMessage.trim();
    // Pesan user tampil langsung, lalu indikator "mengetik" sampai AI membalas.
    setChat(c => [...c, { role: 'user', content: message }]);
    setTestMessage('');
    testResponseMutation.mutate(message);
  };

  function resetKbForm() {
    setKbTitle('');
    setKbContent('');
    setKbImages([]);
    setKbFiles([]);
    setKbFields(EMPTY_KB_FIELDS);
    setKbEditorKey(k => k + 1);
  }

  /** Ubah input sesuai jenis sumber menjadi item knowledge (judul + isi). */
  const buildKnowledgeItems = async (): Promise<{ title: string; content: string }[]> => {
    const title = kbTitle.trim();
    const content = kbContent.trim();
    switch (kbSource) {
      case 'web': {
        const url = kbFields.url.trim();
        if (!/^https?:\/\/\S+\.\S+/i.test(url)) throw new Error('URL situs web tidak valid');
        return [{ title: title || url, content: `Sumber: ${url}\n\n${await urlToText(url)}` }];
      }
      case 'file':
        if (!kbFiles.length) throw new Error('Pilih minimal satu file PDF');
        return Promise.all(kbFiles.map(async f => {
          const text = await pdfToText(f);
          if (!text) throw new Error(`Teks di ${f.name} tidak terbaca (PDF hasil scan?)`);
          return { title: `[File] ${f.name}`, content: text };
        }));
      case 'qa':
        if (!title || !kbFields.answer.trim()) throw new Error('Pertanyaan dan jawaban wajib diisi');
        return [{ title, content: `Pertanyaan: ${title}\nJawaban: ${kbFields.answer.trim()}` }];
      case 'product':
        if (!title || !content) throw new Error('Nama dan deskripsi produk wajib diisi');
        return [{ title: `[Produk] ${title}`, content: `Produk: ${title}\nHarga: ${kbFields.price.trim() || '-'}\n\n${content}` }];
      default:
        if (!title || !content) throw new Error('Judul dan isi knowledge wajib diisi');
        return [{ title, content }];
    }
  };

  const handleAddKnowledge = async () => {
    setKbBusy(true);
    try {
      const items = (await buildKnowledgeItems()).map((it, i) => ({ ...it, images: i === 0 ? kbImages : [] }));
      if (isEdit) {
        for (const it of items) await addKnowledgeMutation.mutateAsync(it);
        return;
      }
      // Mode Create: tampung dulu, disimpan otomatis saat agent dibuat.
      setPendingKnowledge(list => [...list, ...items]);
      resetKbForm();
      toast.success('Knowledge ditambahkan (akan disimpan bersama agent)');
    } catch (err: any) {
      if (!err?.response) toast.error(err?.message || 'Gagal memproses knowledge');
    } finally {
      setKbBusy(false);
    }
  };

  const addKbFiles = (list: FileList | null) => {
    const pdfs = Array.from(list ?? []).filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (list && pdfs.length < list.length) toast.error('Hanya file .pdf yang didukung');
    setKbFiles(prev => [...prev, ...pdfs.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]);
  };

  const handleDeleteKnowledge = (id: string | undefined, index: number, title: string) => {
    if (!window.confirm(`Hapus knowledge "${title}"?`)) return;
    if (isEdit && id) {
      deleteKnowledgeMutation.mutate(id);
      return;
    }
    setPendingKnowledge(list => {
      const item = list[index];
      if (item) revokeImageDrafts(item.images);
      return list.filter((_, i) => i !== index);
    });
    toast.success('Knowledge dihapus');
  };

  const handleRemovePendingImage = (knowledgeIndex: number, imageIndex: number) => {
    setPendingKnowledge(list =>
      list.map((item, i) => {
        if (i !== knowledgeIndex) return item;
        const image = item.images[imageIndex];
        if (image) URL.revokeObjectURL(image.preview);
        return { ...item, images: item.images.filter((_, idx) => idx !== imageIndex) };
      })
    );
  };

  const handleDeleteKnowledgeMedia = (knowledgeId: string, mediaId: string) => {
    if (!window.confirm('Hapus gambar ini dari knowledge?')) return;
    deleteKnowledgeMediaMutation.mutate({ knowledgeId, mediaId });
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

  const navItems: { id: Tab; label: string; icon: typeof Bot; hint?: string }[] = [
    { id: 'behavior', label: 'Perilaku AI', icon: Brain, hint: 'Sambutan, gaya, alur, aturan' },
    { id: 'knowledge', label: 'Basis pengetahuan', icon: Database, hint: 'Knowledge & gambar' },
    { id: 'routing', label: 'Aksi AI & routing', icon: Route, hint: 'Aksi dan pengalihan' },
    { id: 'config', label: 'Konfigurasi AI', icon: Settings, hint: 'Provider, model, status' },
    { id: 'followup', label: 'Follow-up', icon: Repeat, hint: 'Pesan susulan' },
    { id: 'integration', label: 'Integrasi', icon: Plug, hint: 'Channel & tools' },
    { id: 'orchestration', label: 'Orkestrasi', icon: Network, hint: 'Koordinasi agent' },
    { id: 'evaluation', label: 'Evaluasi', icon: ClipboardCheck, hint: 'Kualitas jawaban' },
  ];

  const knowledgeList = Array.isArray(knowledge) ? (knowledge as AiKnowledge[]) : [];
  const mediaList = Array.isArray(media) ? (media as AiMedia[]) : [];
  // Di mode Create, knowledge/media ditampung lokal dulu sampai agent disimpan.
  const displayKnowledge = isEdit
    ? knowledgeList.map(k => ({
        id: k.id as string | undefined,
        title: k.title,
        content: k.content,
        media: k.media ?? ([] as AiKnowledgeMedia[]),
        pendingImages: [] as ImageDraft[],
      }))
    : pendingKnowledge.map(k => ({
        id: undefined as string | undefined,
        title: k.title,
        content: k.content,
        media: [] as AiKnowledgeMedia[],
        pendingImages: k.images,
      }));
  const displayMedia = isEdit
    ? mediaList.map(m => ({ id: m.id as string | undefined, title: m.title, mediaUrl: m.mediaUrl, caption: m.caption, description: m.description, keywords: m.keywords, trigger: m.trigger }))
    : pendingMedia.map(m => ({ id: undefined as string | undefined, ...m }));

  const keyPlaceholder = useMemo(() => {
    const p = providers?.find(x => x.id === form.provider);
    return p?.keyPlaceholder ?? 'API key';
  }, [providers, form.provider]);

  // --- Editor "Teks": satu dokumen knowledge per agent (seperti Cekat) ---
  const [kbDoc, setKbDoc] = useState('');
  const [kbDocKey, setKbDocKey] = useState(0);
  const [kbDocDirty, setKbDocDirty] = useState(false);
  const docEntry = knowledgeList.find(k => knowledgeKind(k) === 'doc');
  // Knowledge lama berjudul bebas tanpa gambar digabung ke editor Teks.
  // Yang punya gambar terlampir tidak digabung supaya file gambarnya tidak ikut terhapus.
  const legacyMergeable = knowledgeList.filter(k => knowledgeKind(k) === 'legacy' && !k.media?.length);
  const docHydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isEdit || !agentId || !Array.isArray(knowledge) || docHydratedFor.current === agentId) return;
    docHydratedFor.current = agentId;
    const parts = [docEntry?.content ?? '', ...legacyMergeable.map(k => `${k.title}\n${k.content}`)];
    setKbDoc(parts.filter(p => p.trim()).join('\n\n'));
    setKbDocKey(k => k + 1);
    // Ada knowledge lama yang digabung → perlu disimpan supaya jadi satu dokumen.
    setKbDocDirty(legacyMergeable.length > 0);
  }, [knowledge, isEdit, agentId]);

  const updateKbDoc = (value: string) => {
    setKbDoc(value);
    setKbDocDirty(true);
  };

  const saveDocMutation = useMutation({
    mutationFn: async () => {
      const id = agentId as string;
      const content = kbDoc.trim();
      if (docEntry) {
        if (content) await knowledgeService.update(id, docEntry.id, { title: KB_TEXT_TITLE, content });
        else await knowledgeService.delete(id, docEntry.id);
      } else if (content) {
        await knowledgeService.create(id, { title: KB_TEXT_TITLE, content });
      }
      // Isinya sudah masuk ke dokumen Teks, jadi entri lamanya dihapus agar tidak dobel.
      for (const k of legacyMergeable) await knowledgeService.delete(id, k.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-knowledge', agentId] });
      qc.invalidateQueries({ queryKey: ['ai-agents'] });
      setKbDocDirty(false);
      toast.success('Pengetahuan disimpan');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menyimpan pengetahuan'),
  });

  return {
    kbDoc,
    updateKbDoc,
    kbDocKey,
    setKbDocKey,
    kbDocDirty,
    saveDocMutation,
    legacyMergeable,
    id,
    navigate,
    qc,
    isEdit,
    agentId,
    tab,
    setTab,
    knowledgeView,
    setKnowledgeView,
    form,
    setForm,
    errors,
    setErrors,
    showKey,
    setShowKey,
    modelOptions,
    setModelOptions,
    savedFlash,
    setSavedFlash,
    connectionResult,
    setConnectionResult,
    collapsed,
    setCollapsed,
    activeSection,
    setActiveSection,
    toggleSection,
    goToSection,
    kbTitle,
    setKbTitle,
    kbContent,
    setKbContent,
    kbEditorKey,
    setKbEditorKey,
    pendingKnowledge,
    setPendingKnowledge,
    kbImages,
    setKbImages,
    kbSource,
    setKbSource,
    kbFields,
    setKbFields,
    kbFiles,
    setKbFiles,
    kbBusy,
    setKbBusy,
    kbDrag,
    setKbDrag,
    pendingMedia,
    setPendingMedia,
    mbTitle,
    setMbTitle,
    mbUrl,
    setMbUrl,
    mbCaption,
    setMbCaption,
    mbDesc,
    setMbDesc,
    mbKeywords,
    setMbKeywords,
    mbTrigger,
    setMbTrigger,
    testMessage,
    setTestMessage,
    useKnowledge,
    setUseKnowledge,
    useMedia,
    setUseMedia,
    chat,
    setChat,
    providers,
    agent,
    loadingAgent,
    knowledge,
    loadingKnowledge,
    media,
    loadingMedia,
    applyAgent,
    hydratedFor,
    handleCancel,
    set,
    validate,
    saveMutation,
    loadModelsMutation,
    testConnectionMutation,
    testResponseMutation,
    addKnowledgeMutation,
    addKnowledgeMediaMutation,
    deleteKnowledgeMediaMutation,
    deleteKnowledgeMutation,
    addMediaMutation,
    deleteMediaMutation,
    addInstruction,
    updateInstruction,
    removeInstruction,
    handleSave,
    handleTestResponse,
    resetKbForm,
    buildKnowledgeItems,
    handleAddKnowledge,
    addKbFiles,
    handleDeleteKnowledge,
    handleRemovePendingImage,
    handleDeleteKnowledgeMedia,
    handleAddMedia,
    handleDeleteMedia,
    navItems,
    knowledgeList,
    mediaList,
    displayKnowledge,
    displayMedia,
    keyPlaceholder,
  };
}

export type AgentEditor = ReturnType<typeof useAgentEditor>;

