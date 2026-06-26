import { formatDistanceToNow } from 'date-fns';
import { Search, MessageCircle } from 'lucide-react';
import { Conversation, ConversationStatus } from '../../types';
import { Avatar, Badge, Spinner } from '../ui/index';
import { useInboxStore } from '../../store/inbox.store';
import { useConversations } from '../../hooks/useConversation';

interface Props { onSelect: (id: string) => void; selectedId?: string; }

const statusTabs: { value: ConversationStatus | ''; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CLOSED', label: 'Closed' },
  { value: '', label: 'All' },
];

export default function ConversationList({ onSelect, selectedId }: Props) {
  const { conversations, filters, setFilters } = useInboxStore();
  const { isLoading } = useConversations({
    status: filters.status || undefined,
    search: filters.search || undefined,
    channelId: filters.channelId || undefined,
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-[320px] flex-shrink-0">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-3">Conversations</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="Search conversations..." value={filters.search} onChange={e => setFilters({ search: e.target.value })} />
        </div>
      </div>

      <div className="flex border-b border-gray-100 px-1">
        {statusTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilters({ status: tab.value as ConversationStatus | '' })}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              filters.status === tab.value ? 'border-transparent' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={filters.status === tab.value ? { color: '#18a6fc', borderBottomColor: '#18a6fc' } : undefined}>{tab.label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Spinner /></div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No conversations</p>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationItem key={conv.id} conversation={conv} isActive={conv.id === selectedId} onClick={() => onSelect(conv.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conversation: c, isActive, onClick }: { conversation: Conversation; isActive: boolean; onClick: () => void }) {
  const unread = c._count?.messages || 0;
  const displayPhone = ((c.contact as any).metadata?.whatsappId as string || c.contact.phone || '').replace(/@(c\.us|s\.whatsapp\.net|lid|g\.us|broadcast)$/, '');
  const hasName = /\p{L}/u.test(c.contact.name) && c.contact.name !== displayPhone;

  return (
    <div onClick={onClick} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 ${
      isActive ? 'border-l-2' : 'hover:bg-gray-50'
    }`}
    style={isActive ? { background: 'rgba(24, 166, 252, 0.05)', borderLeftColor: '#18a6fc' } : undefined}>
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar name={hasName ? c.contact.name : displayPhone} size="md" />
        {c.channel.type === 'WHATSAPP' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success rounded-full flex items-center justify-center">
            <MessageCircle className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-medium text-gray-900 truncate">{hasName ? c.contact.name : displayPhone}</span>
          <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
            {c.lastMessageAt ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: false }) : ''}
          </span>
        </div>
        {hasName && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-mono truncate">{displayPhone}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 truncate">{c.lastMessage || 'No messages yet'}</p>
          {unread > 0 && <span className="ml-1 flex-shrink-0 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-medium">{unread > 9 ? '9+' : unread}</span>}
        </div>
        {c.labels.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {c.labels.slice(0, 2).map(({ label }) => <Badge key={label.id} label={label.name} color={label.color} />)}
          </div>
        )}
      </div>
    </div>
  );
}
