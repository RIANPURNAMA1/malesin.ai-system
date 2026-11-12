import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bot, Plus, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAgentService, channelService } from '../services/index';
import { AiAgent, Channel } from '../types';
import { providerMeta } from '../constants/aiProviders';
import { Spinner } from '../components/ui/index';

/** Kanal yang dijawab agent ini (sama dengan logika backend: agent pilihan kanal, atau agent aktif pertama). */
function channelsFor(agent: AiAgent, channels: Channel[], fallbackId?: string) {
  return channels.filter(c => {
    const m = (c.metadata ?? {}) as { aiEnabled?: boolean; aiAgentId?: string };
    if (m.aiEnabled === false) return false;
    return m.aiAgentId ? m.aiAgentId === agent.id : agent.id === fallbackId;
  });
}

export default function AIAgentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: agents, isLoading } = useQuery({ queryKey: ['ai-agents'], queryFn: aiAgentService.list });
  const { data: channels = [] } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });

  const deleteMutation = useMutation({
    mutationFn: aiAgentService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-agents'] }); toast.success('AI Agent dihapus'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menghapus agent'),
  });
  const toggleMutation = useMutation({
    mutationFn: (a: AiAgent) => aiAgentService.update(a.id, { isActive: !a.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents'] }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal mengubah status'),
  });

  const list = Array.isArray(agents) ? agents : [];
  const fallbackId = useMemo(
    () => [...list].filter(a => a.isActive).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id,
    [list]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(a =>
      a.name.toLowerCase().includes(q) || a.model.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q)
    );
  }, [list, search]);

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
            <p className="text-sm text-gray-500">Chatbot AI untuk membalas pelanggan otomatis.</p>
          </div>
          <button className="gradient-btn flex-shrink-0 px-4 py-2 text-sm" onClick={() => navigate('/ai-agents/new')}>
            <Plus className="h-4 w-4" />Buat Agent
          </button>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari agent…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-primary/40 focus:outline-none" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Bot className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">{list.length ? 'Agent tidak ditemukan.' : 'Belum ada AI Agent.'}</p>
            {!list.length && (
              <button className="gradient-btn mt-4 px-4 py-2 text-sm" onClick={() => navigate('/ai-agents/new')}>
                <Plus className="h-4 w-4" />Buat Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map(agent => {
              const meta = providerMeta[agent.provider];
              const Icon = meta?.icon ?? Bot;
              const color = meta?.color ?? '#18a6fc';
              const used = channelsFor(agent, channels, fallbackId);
              return (
                <div key={agent.id} onClick={() => navigate(`/ai-agents/${agent.id}`)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary/40 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a` }}>
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{agent.name}</p>
                      <p className="truncate text-xs text-gray-500">{meta?.label ?? agent.provider} · <span className="font-mono">{agent.model}</span></p>
                    </div>
                    <button
                      role="switch" aria-checked={agent.isActive} title={agent.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      disabled={toggleMutation.isPending}
                      onClick={e => { e.stopPropagation(); toggleMutation.mutate(agent); }}
                      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition disabled:opacity-50 ${agent.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${agent.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {agent.description && <p className="mt-3 line-clamp-2 text-sm text-gray-600">{agent.description}</p>}

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{agent._count?.knowledge ?? 0} knowledge</span>
                      <span className="truncate">{used.length ? `Kanal: ${used.map(c => c.name).join(', ')}` : 'Belum di kanal mana pun'}</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); if (window.confirm(`Hapus agent "${agent.name}"?`)) deleteMutation.mutate(agent.id); }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Hapus agent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
