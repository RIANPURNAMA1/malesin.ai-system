import { useState, useRef, useEffect } from 'react';
import ChatMenu from './ChatMenu';
import { Send, Paperclip, CheckCheck, Check, Clock, X, UserPlus, ChevronDown, ChevronLeft, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { conversationService } from '../../services/conversation.service';
import { useInboxStore } from '../../store/inbox.store';
import { useMessages, useSendMessage, useUpdateStatus, useConversation } from '../../hooks/useConversation';
import { Avatar, Spinner } from '../ui/index';
import { Message, Conversation } from '../../types';
import { useSocketStore } from '../../store/socket.store';
import { useNotificationStore } from '../../store/notification.store';

interface Props { conversationId: string; onOpenDetail: () => void; onBack?: () => void; }

export default function ChatWindow({ conversationId, onOpenDetail, onBack }: Props) {
  const { messages, typing } = useInboxStore();
  const { socket } = useSocketStore();
  const { isLoading: loadingMsgs } = useMessages(conversationId);
  const { data: conversation } = useConversation(conversationId);
  const sendMutation = useSendMessage(conversationId);
  const updateStatus = useUpdateStatus(conversationId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const convMessages = messages[conversationId] || [];
  const isTyping = !!typing[conversationId];

  // Chat yang sedang dibuka → notifikasinya dianggap sudah dibaca.
  const markNotifRead = useNotificationStore(s => s.markConversationRead);
  useEffect(() => { markNotifRead(conversationId); }, [conversationId, convMessages.length, markNotifRead]);

  useEffect(() => { socket?.emit('conversation:join', conversationId); return () => { socket?.emit('conversation:leave', conversationId); }; }, [conversationId, socket]);

  // --- Human takeover: status AI per percakapan ---
  const qc = useQueryClient();
  const lastTypingEmit = useRef(0);
  useEffect(() => {
    if (!socket) return;
    const onAiStatus = (e: { conversationId: string }) => {
      if (e.conversationId === conversationId) qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
    };
    socket.on('conversation:ai-status', onAiStatus);
    return () => { socket.off('conversation:ai-status', onAiStatus); };
  }, [socket, conversationId]);
  const toggleAi = useMutation({
    mutationFn: (paused: boolean) => conversationService.setAiPaused(conversationId, paused),
    onSuccess: (_r, paused) => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      toast.success(paused ? 'AI dijeda untuk percakapan ini' : 'AI aktif kembali');
    },
    onError: () => toast.error('Gagal mengubah status AI'),
  });
  // Agen mengetik → beri tahu server (maks. tiap 3 detik) supaya AI berhenti membalas.
  const handleTextChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value.trim() && now - lastTypingEmit.current > 3000) {
      lastTypingEmit.current = now;
      socket?.emit('typing:start', { conversationId });
    }
  };
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [convMessages.length, isTyping]);

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
            <p className="text-xs text-gray-400 font-mono">{((conv.contact as any).metadata?.whatsappId as string || conv.contact.phone || '').replace(/@(c\.us|s\.whatsapp\.net|lid|g\.us|broadcast)$/, '')} · {conv.channel.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const until = (conv as any).metadata?.aiPausedUntil as string | null | undefined;
            const aiPaused = until === 'manual' || (!!until && new Date(until).getTime() > Date.now());
            const title = aiPaused
              ? until === 'manual' ? 'AI dijeda sampai diaktifkan lagi. Klik untuk mengaktifkan.' : `AI dijeda sampai ${format(new Date(until!), 'HH:mm')}. Klik untuk mengaktifkan.`
              : 'AI membalas otomatis. Klik untuk menjeda.';
            return (
              <button
                onClick={() => toggleAi.mutate(!aiPaused)}
                disabled={toggleAi.isPending}
                title={title}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  aiPaused ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-primary/10 text-primary hover:bg-primary/15'
                }`}
              >
                <Bot className="w-3.5 h-3.5" /> {aiPaused ? 'AI dijeda' : 'AI aktif'}
              </button>
            );
          })()}
          <StatusDropdown current={conv.status} onUpdate={s => updateStatus.mutate(s)} />
          <button onClick={onOpenDetail} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><UserPlus className="w-4 h-4" /></button>
          <ChatMenu
            conversationId={conversationId}
            contactId={conv.contact.id}
            phone={((conv.contact as any).metadata?.whatsappId as string || conv.contact.phone || '').replace(/@(c\.us|s\.whatsapp\.net|lid|g\.us|broadcast)$/, '')}
            onOpenDetail={onOpenDetail}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
        {loadingMsgs ? <div className="flex justify-center mt-10"><Spinner /></div>
          : convMessages.length === 0 ? <div className="text-center text-gray-400 text-sm mt-16">No messages yet</div>
          : convMessages.map((msg, i) => <MessageBubble key={msg.id} message={msg} showDate={i === 0 || !isSameDay(convMessages[i - 1].sentAt, msg.sentAt)} />)}
        {isTyping && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {conv.status !== 'CLOSED' ? (
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-end gap-3 bg-gray-50 rounded-xl border border-gray-200 p-2 focus-within:border-primary/30 focus-within:bg-white transition-all">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0"><Paperclip className="w-5 h-5" /></button>
            <textarea value={text} onChange={e => handleTextChange(e.target.value)} onKeyDown={handleKeyDown}
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

function TypingBubble() {
  return (
    <div className="flex justify-start mb-1">
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}

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
