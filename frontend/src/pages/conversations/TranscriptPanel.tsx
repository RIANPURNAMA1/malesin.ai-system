import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, MessageCircle, FileText } from 'lucide-react';
import { convApi, fmtDate, fmtDuration, STATUS_META, SOURCE_META, TranscriptMessage } from './api';

function Bubble({ m }: { m: TranscriptMessage }) {
  const out = m.direction === 'OUTBOUND';
  const src = out ? SOURCE_META[m.metadata?.source ?? (m.sender ? 'AGENT' : 'SYSTEM')] : null;
  const isImage = m.type === 'IMAGE' && m.mediaUrl && /^(https?:|data:)/.test(m.mediaUrl);
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${out ? 'rounded-tr-none bg-[#d9fdd3]' : 'rounded-tl-none bg-white'}`}>
        {src && (
          <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${src.cls}`}>
            {src.label}{m.metadata?.source === 'AGENT' || (!m.metadata?.source && m.sender) ? ` · ${m.sender?.name ?? ''}` : ''}
          </span>
        )}
        {isImage && <img src={m.mediaUrl!} alt="" className="mb-1 max-h-48 rounded" />}
        {m.type === 'DOCUMENT' && <p className="mb-1 flex items-center gap-1 text-xs text-gray-600"><FileText className="h-3.5 w-3.5" />{m.fileName || 'Dokumen'}</p>}
        {!isImage && !['TEXT', 'DOCUMENT'].includes(m.type) && <p className="text-xs italic text-gray-500">[{m.type.toLowerCase()}]</p>}
        {m.content && <p className="whitespace-pre-wrap break-words text-gray-800">{m.content}</p>}
        <p className="mt-1 text-right text-[10px] text-gray-400">
          {new Date(m.sentAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {m.status === 'FAILED' && <span className="ml-1 text-red-500">· gagal</span>}
        </p>
      </div>
    </div>
  );
}

/** Transkrip lengkap (read-only) + info percakapan + tombol ke Inbox. */
export default function TranscriptPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ['conv-transcript', id], queryFn: () => convApi.transcript(id) });
  useEffect(() => { endRef.current?.scrollIntoView(); }, [data]);

  if (isLoading || !data) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  const c = data.conversation;
  const info: [string, string][] = [
    ['Kanal', c.channel.name],
    ['Agen', c.agent?.name ?? 'Belum di-assign'],
    ['Ditangani', c.handledBy === 'AI' ? 'AI' : c.handledBy === 'HUMAN' ? 'Manusia' : '-'],
    ['Dibuat', fmtDate(c.createdAt)],
    ['Respons pertama', fmtDuration(c.firstResponseSec)],
    ['Durasi', c.closedAt ? fmtDuration(c.durationSec) : 'Belum ditutup'],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-gray-900">{c.contact.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[c.status].cls}`}>{STATUS_META[c.status].label}</span>
          </div>
          <p className="text-xs text-gray-500">{c.contact.phone || '-'} · {c.messageCount} pesan</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(`/inbox/${c.id}`)} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
            <MessageCircle className="h-3.5 w-3.5" />Buka di Inbox
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 border-b border-gray-200 px-4 py-3 text-xs">
        {info.map(([k, v]) => (
          <div key={k}><dt className="text-gray-400">{k}</dt><dd className="truncate font-medium text-gray-700">{v}</dd></div>
        ))}
      </dl>
      {c.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-4 py-2">
          {c.labels.map(l => <span key={l.id} className="rounded-full px-2 py-0.5 text-[11px] text-white" style={{ background: l.color }}>{l.name}</span>)}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
        {data.messages.map(m => <Bubble key={m.id} m={m} />)}
        {!data.messages.length && <p className="py-10 text-center text-xs text-gray-500">Belum ada pesan</p>}
        <div ref={endRef} />
      </div>
    </div>
  );
}
