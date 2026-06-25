import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, MoreVertical, CheckCheck, Check, Clock, X, UserPlus, ChevronDown, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useInboxStore } from '../../store/inbox.store';
import { useMessages, useSendMessage, useUpdateStatus, useConversation } from '../../hooks/useConversation';
import { Avatar, Spinner } from '../ui/index';
import { Message, Conversation } from '../../types';
import { useSocketStore } from '../../store/socket.store';

interface Props { conversationId: string; onOpenDetail: () => void; onBack?: () => void; }

export default function ChatWindow({ conversationId, onOpenDetail, onBack }: Props) {
  const { messages } = useInboxStore();
  const { socket } = useSocketStore();
  const { isLoading: loadingMsgs } = useMessages(conversationId);
  const { data: conversation } = useConversation(conversationId);
  const sendMutation = useSendMessage(conversationId);
  const updateStatus = useUpdateStatus(conversationId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const convMessages = messages[conversationId] || [];

  useEffect(() => { socket?.emit('conversation:join', conversationId); return () => { socket?.emit('conversation:leave', conversationId); }; }, [conversationId, socket]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [convMessages.length]);

  const handleSend = async () => {
    if (!text.trim()) return; const content = text.trim(); setText('');
    try { await sendMutation.mutateAsync({ type: 'TEXT', content }); } catch { setText(content); }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  if (!conversation) return <div className="flex-1 flex items-center justify-center bg-gray-50"><Spinner /></div>;
  const conv = conversation as Conversation;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 lg:px-5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button onClick={onBack} className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <Avatar name={conv.contact.name} size="sm" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">{conv.contact.name}</p>
            <p className="text-xs text-gray-400">{(conv.contact as any).metadata?.whatsappId || conv.contact.phone} · {conv.channel.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusDropdown current={conv.status} onUpdate={s => updateStatus.mutate(s)} />
          <button onClick={onOpenDetail} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><UserPlus className="w-4 h-4" /></button>
          <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
        {loadingMsgs ? <div className="flex justify-center mt-10"><Spinner /></div>
          : convMessages.length === 0 ? <div className="text-center text-gray-400 text-sm mt-16">No messages yet</div>
          : convMessages.map((msg, i) => <MessageBubble key={msg.id} message={msg} showDate={i === 0 || !isSameDay(convMessages[i - 1].sentAt, msg.sentAt)} />)}
        <div ref={bottomRef} />
      </div>

      {conv.status !== 'CLOSED' ? (
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-end gap-3 bg-gray-50 rounded-xl border border-gray-200 p-2 focus-within:border-primary/30 focus-within:bg-white transition-all">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0"><Paperclip className="w-5 h-5" /></button>
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send)" rows={1} style={{ maxHeight: 120 }}
              className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none scrollbar-thin" />
            <button onClick={handleSend} disabled={!text.trim() || sendMutation.isPending}
              className="p-2 rounded-lg flex-shrink-0 transition-all gradient-btn disabled:opacity-40">
              {sendMutation.isPending ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0 text-center">
          <p className="text-sm text-gray-500">This conversation is closed.</p>
          <button onClick={() => updateStatus.mutate('OPEN')} className="text-primary text-sm font-medium hover:underline mt-1">Reopen conversation</button>
        </div>
      )}
    </div>
  );
}

function isSameDay(a: string, b: string) { return format(new Date(a), 'yyyy-MM-dd') === format(new Date(b), 'yyyy-MM-dd'); }

function MessageBubble({ message: m, showDate }: { message: Message; showDate: boolean }) {
  const isOut = m.direction === 'OUTBOUND';
  return (
    <>
      {showDate && (
        <div className="flex justify-center my-3">
          <span className="text-xs bg-white border border-gray-200 text-gray-400 rounded-full px-3 py-1">{format(new Date(m.sentAt), 'MMMM d, yyyy')}</span>
        </div>
      )}
      <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className={`max-w-[72%] ${isOut ? 'items-end' : 'items-start'} flex flex-col`}>
          {m.sender && !isOut && <span className="text-xs text-gray-400 mb-1 ml-1">{m.sender.name}</span>}
          <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
            isOut ? 'text-white rounded-br-sm bg-primary' : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
          }`}>
            {m.type === 'REACTION' ? <span className="text-2xl">{m.reactionEmoji}</span>
              : m.type === 'IMAGE' ? <div>{m.mediaUrl && <img src={m.mediaUrl} alt="image" className="max-w-xs rounded-lg mb-1" />}{m.content && <p>{m.content}</p>}</div>
              : <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content || m.fileName || 'Media'}</p>}
          </div>
          <div className={`flex items-center gap-1 mt-1 ${isOut ? 'flex-row-reverse' : ''}`}>
            <span className="text-[10px] text-gray-400">{format(new Date(m.sentAt), 'HH:mm')}</span>
            {isOut && <MessageStatusIcon status={m.status} />}
          </div>
        </div>
      </div>
    </>
  );
}

function MessageStatusIcon({ status }: { status: string }) {
  if (status === 'FAILED') return <X className="w-3 h-3 text-danger" />;
  if (status === 'READ') return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (status === 'DELIVERED') return <CheckCheck className="w-3 h-3 text-gray-400" />;
  if (status === 'SENT') return <Check className="w-3 h-3 text-gray-400" />;
  return <Clock className="w-3 h-3 text-gray-400" />;
}

function StatusDropdown({ current, onUpdate }: { current: string; onUpdate: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const statusColors: Record<string, string> = { OPEN: 'text-green-600 bg-green-50', PENDING: 'text-yellow-600 bg-yellow-50', CLOSED: 'text-gray-600 bg-gray-100' };
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusColors[current]}`}>
        <span className="capitalize">{current.toLowerCase()}</span><ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-36 py-1">
          {['OPEN', 'PENDING', 'CLOSED'].map(s => (
            <button key={s} onClick={() => { onUpdate(s); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${current === s ? 'font-medium text-primary' : 'text-gray-700'}`}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
