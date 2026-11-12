import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bot, Plus, Trash2, BookOpen, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiAgentService } from '../services/index';
import { AiAgent } from '../types';
import { providerMeta } from '../constants/aiProviders';
import { Spinner } from '../components/ui/index';

export default function AIAgentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: agents, isLoading } = useQuery({ queryKey: ['ai-agents'], queryFn: aiAgentService.list });

  const deleteMutation = useMutation({
    mutationFn: aiAgentService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-agents'] }); toast.success('AI Agent dihapus'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menghapus agent'),
  });

  const list = Array.isArray(agents) ? agents : [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q)
    );
  }, [list, search]);

  return (
    <div className="h-full p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">AI Agents</h1>
            <p className="text-gray-600">
              Kelola chatbot AI untuk customer service kamu — pilih provider, model, dan knowledge base (RAG).
            </p>
          </div>
          <button className="gradient-btn px-5 py-2.5 text-sm flex-shrink-0" onClick={() => navigate('/ai-agents/new')}>
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search AI agents..."
            className="w-full bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Bot className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {list.length === 0 ? 'No AI Agents Found' : 'No matching agents'}
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
              {list.length === 0
                ? "You haven't created any AI agents yet. Create your first one to get started!"
                : 'Try a different search keyword.'}
            </p>
            {list.length === 0 && (
              <button className="gradient-btn px-6 py-2.5 text-sm" onClick={() => navigate('/ai-agents/new')}>
                <Plus className="w-4 h-4" />
                Create Your First Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(agent => {
              const meta = providerMeta[agent.provider];
              const Icon = meta?.icon ?? Bot;
              const color = meta?.color ?? '#18a6fc';
              return (
                <div
                  key={agent.id}
                  className="glass-card rounded-2xl p-5 flex flex-col cursor-pointer group"
                  onClick={() => navigate(`/ai-agents/${agent.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20' }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                        <p className="text-xs text-gray-500 truncate">{meta?.label ?? agent.provider}</p>
                      </div>
                    </div>
                    <span className={`status-dot ${agent.isActive ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2rem]">
                    {agent.description || 'Tidak ada deskripsi.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
                    <span className="inline-flex items-center gap-1.5 text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 font-mono truncate max-w-full">
                      {agent.model}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      {agent._count?.knowledge ?? 0} knowledge
                    </span>
                  </div>

                  <div className="mt-auto flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/ai-agents/${agent.id}`); }}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all inline-flex items-center justify-center gap-1.5"
                    >
                      Configure
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${agent.name}"?`)) deleteMutation.mutate(agent.id);
                      }}
                      className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-400 hover:text-danger hover:bg-red-50 transition-all"
                      title="Delete agent"
                    >
                      <Trash2 className="w-4 h-4" />
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
