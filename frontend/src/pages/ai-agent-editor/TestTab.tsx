import { Send, BookOpen, CheckCircle2, AlertCircle, Image, MessageSquare, Loader2, Zap } from 'lucide-react';
import type { AgentEditor } from './useAgentEditor';

export default function TestTab({ ed }: { ed: AgentEditor }) {
  const { isEdit, connectionResult, pendingKnowledge, pendingMedia, testMessage, setTestMessage, useKnowledge, setUseKnowledge, useMedia, setUseMedia, chat, agent, knowledge, testConnectionMutation, testResponseMutation, handleTestResponse, displayMedia } = ed;
  return (
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
  );
}

