import { useEffect, useRef, useState } from 'react';
import { Send, BookOpen, CheckCircle2, AlertCircle, Image, Loader2, Zap, Bot, RotateCcw, Sparkles } from 'lucide-react';
import type { AgentEditor } from './useAgentEditor';
import type { ChatTurn } from './types';

/** Animasi lokal untuk panel uji chat. */
const STYLES = `
@keyframes tt-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .45 } 30% { transform: translateY(-4px); opacity: 1 } }
@keyframes tt-in { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes tt-caret { 50% { opacity: 0 } }
.tt-dot { animation: tt-bounce 1.2s infinite ease-in-out }
.tt-in { animation: tt-in .22s ease-out both }
.tt-caret { display: inline-block; width: 2px; height: 1em; margin-left: 1px; vertical-align: -2px; background: currentColor; animation: tt-caret .8s steps(1) infinite }
@media (prefers-reduced-motion: reduce) { .tt-dot, .tt-in, .tt-caret { animation: none } }
`;

/** Batas gelembung chat per sesi uji (user + AI). Setelah penuh, harus reset. */
const MAX_TURNS = 20;

/** Menampilkan teks huruf demi huruf, lalu memanggil onDone. */
function Typewriter({ text, onTick, onDone }: { text: string; onTick: () => void; onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); onDone(); return; }
    // Teks panjang dipercepat agar total animasi tetap ± 1,5 detik.
    const step = Math.max(1, Math.ceil(text.length / 90));
    const id = setInterval(() => {
      setN(v => {
        const next = Math.min(text.length, v + step);
        if (next >= text.length) { clearInterval(id); onDone(); }
        return next;
      });
    }, 16);
    return () => clearInterval(id);
  }, [text]);
  useEffect(onTick, [n]);
  return <>{text.slice(0, n)}{n < text.length && <span className="tt-caret" />}</>;
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${checked ? 'border-primary/30 bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
      <span className={`relative h-3.5 w-6 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${checked ? 'left-3' : 'left-0.5'}`} />
      </span>
      {label}
      {hint && <span className="font-normal text-gray-400">{hint}</span>}
    </button>
  );
}

export default function TestTab({ ed }: { ed: AgentEditor }) {
  const { isEdit, form, connectionResult, pendingKnowledge, pendingMedia, testMessage, setTestMessage, useKnowledge, setUseKnowledge, useMedia, setUseMedia, chat, setChat, testConnectionMutation, testResponseMutation, handleTestResponse, displayMedia } = ed;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typing = testResponseMutation.isPending;
  const agentName = form.name?.trim() || 'AI Agent';

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(scrollToBottom, [chat.length, typing]);

  // Tandai animasi selesai supaya tidak diulang saat tab dibuka lagi.
  const finishAnimation = (i: number) => setChat((c: ChatTurn[]) => c.map((t, j) => (j === i ? { ...t, animate: false } : t)));

  // Satu kiriman = 2 gelembung (user + AI); kunci bila tidak cukup ruang.
  const full = chat.length + 2 > MAX_TURNS;
  const reset = () => { setChat([]); setTestMessage(''); setTimeout(() => inputRef.current?.focus()); };
  const send = () => { if (full) return; handleTestResponse(); inputRef.current?.focus(); };
  const pendingAiMedia = pendingMedia.filter(m => m.trigger === 'AI').length;

  return (
    <div className="space-y-6">
      <style>{STYLES}</style>

      {/* Koneksi */}
      <section className="glass-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Test Connection</h2>
              <p className="text-xs text-gray-500">Validasi API key ke provider.</p>
            </div>
          </div>
          <button
            onClick={() => testConnectionMutation.mutate()}
            disabled={testConnectionMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {testConnectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {testConnectionMutation.isPending ? 'Menguji...' : 'Test Connection'}
          </button>
        </div>
        {connectionResult && (
          <div className={`tt-in mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${connectionResult.ok ? 'border-green-100 bg-green-50 text-green-700' : 'border-red-100 bg-red-50 text-red-600'}`}>
            {connectionResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            {connectionResult.message}
          </div>
        )}
      </section>

      {/* Uji respons */}
      <section className="glass-card overflow-hidden rounded-2xl">
        {/* Header ala jendela chat */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white/70 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-white shadow-sm">
                <Bot className="h-5 w-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{agentName}</p>
              <p className="truncate text-xs text-gray-500">
                {typing ? <span className="text-primary">sedang mengetik...</span> : form.model ? `${form.model} · online` : 'Test AI Response'}
              </p>
            </div>
          </div>
          {chat.length > 0 && (
            <button onClick={reset} disabled={typing}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
              title="Mulai ulang percakapan uji">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>

        {/* Opsi */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-2.5">
          <Toggle checked={useKnowledge} onChange={setUseKnowledge} label="Knowledge Base (RAG)"
            hint={!isEdit && pendingKnowledge.length > 0 ? `${pendingKnowledge.length} belum disimpan` : undefined} />
          {displayMedia.length > 0 && (
            <Toggle checked={useMedia} onChange={setUseMedia} label="Kirim Gambar"
              hint={!isEdit && pendingAiMedia > 0 ? `${pendingAiMedia} pilih AI` : undefined} />
          )}
        </div>

        {/* Pesan */}
        <div ref={scrollRef} className="h-[420px] space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white px-4 py-5 scrollbar-thin sm:px-5">
          {chat.length === 0 && !typing && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-gray-700">Coba ngobrol dengan {agentName}</p>
              <p className="mt-1 max-w-xs text-xs text-gray-500">Kirim pesan seperti pelanggan sungguhan untuk melihat cara agent menjawab.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {['Halo', 'Berapa harganya?', 'Bisa dikirim ke luar kota?'].map(s => (
                  <button key={s} onClick={() => { setTestMessage(s); inputRef.current?.focus(); }}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition hover:border-primary/30 hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat.map((turn, i) => turn.role === 'user' ? (
            <div key={i} className="tt-in flex justify-end">
              <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white shadow-sm">
                {turn.content}
              </div>
            </div>
          ) : (
            <div key={i} className="tt-in flex items-end justify-start gap-2">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${turn.error ? 'bg-red-100 text-red-500' : 'bg-gradient-to-br from-primary to-primary-light text-white'}`}>
                {turn.error ? <AlertCircle className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm shadow-sm ${turn.error ? 'border-red-100 bg-red-50 text-red-600' : 'border-gray-100 bg-white text-gray-800'}`}>
                {turn.animate
                  ? <Typewriter text={turn.content} onTick={scrollToBottom} onDone={() => finishAnimation(i)} />
                  : turn.content}
                {!turn.animate && turn.usedKnowledge && turn.usedKnowledge.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-100 pt-2">
                    {turn.usedKnowledge.map(k => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
                        <BookOpen className="h-3 w-3" />{k}
                      </span>
                    ))}
                  </div>
                )}
                {!turn.animate && turn.usedMedia && turn.usedMedia.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-100 pt-2">
                    {turn.usedMedia.map(m => (
                      <span key={m} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                        <Image className="h-3 w-3" />{m}
                      </span>
                    ))}
                  </div>
                )}
                {!turn.animate && turn.attachments && turn.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {turn.attachments.map(a => (
                      <figure key={a.id} className="w-24">
                        <img src={a.mediaUrl} alt={a.title} className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
                        <figcaption className="mt-1 truncate text-center text-[10px] text-gray-500">{a.title}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {typing && (
            <div className="tt-in flex items-end gap-2" aria-live="polite" aria-label={`${agentName} sedang mengetik`}>
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-white">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
                {[0, 0.15, 0.3].map(d => (
                  <span key={d} className="tt-dot h-2 w-2 rounded-full bg-primary" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 bg-white p-3 sm:p-4">
          {full && !typing ? (
            <div className="tt-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Percakapan uji sudah penuh ({MAX_TURNS} pesan). Mulai ulang untuk lanjut menguji.
              </div>
              <button onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-95">
                <RotateCcw className="h-4 w-4" /> Mulai ulang
              </button>
            </div>
          ) : (<>
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 pl-4 transition focus-within:border-primary/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/10">
            <textarea
              ref={inputRef}
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder="Tulis pesan uji..."
              className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            <button
              onClick={send}
              disabled={typing || !testMessage.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              title="Kirim"
              aria-label="Kirim"
            >
              {typing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 flex justify-between px-1 text-[11px] text-gray-400">
            <span>Enter untuk kirim · Shift+Enter baris baru</span>
            {chat.length > 0 && <span>{chat.length}/{MAX_TURNS} pesan</span>}
          </p>
          </>)}
        </div>
      </section>
    </div>
  );
}
