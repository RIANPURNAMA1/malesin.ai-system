import { MessageCircle, Instagram, Facebook } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { channelService } from '../../services/index';
import { Channel } from '../../types';
import { useInboxStore } from '../../store/inbox.store';

const channelIcons: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageCircle className="w-4 h-4" />,
  INSTAGRAM: <Instagram className="w-4 h-4" />,
  FACEBOOK: <Facebook className="w-4 h-4" />,
};

const channelColors: Record<string, string> = {
  WHATSAPP: 'bg-green-100 text-green-700',
  INSTAGRAM: 'bg-pink-100 text-pink-700',
  FACEBOOK: 'bg-blue-100 text-blue-700',
};

export default function ChannelSidebar() {
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });
  const { filters, setFilters } = useInboxStore();

  return (
    <div className="w-[200px] flex-shrink-0 bg-gray-50 border-r border-gray-200 p-3 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-3">Channels</p>
      <button
        onClick={() => setFilters({ channelId: '' })}
        className={`flex items-center gap-2 w-full px-2 py-2.5 rounded-lg text-sm transition-all ${
          !filters.channelId ? 'font-medium border' : 'text-gray-600 hover:bg-white hover:text-gray-800'
        }`}
        style={!filters.channelId ? { background: 'rgba(24, 166, 252, 0.1)', color: '#18a6fc', borderColor: 'rgba(24, 166, 252, 0.2)' } : undefined}
      >
        <span className="w-6 h-6 bg-gray-200 rounded-md flex items-center justify-center text-gray-500">
          <MessageCircle className="w-3.5 h-3.5" />
        </span>
        All Channels
      </button>
      {Array.isArray(channels) && channels.map((ch: Channel) => (
        <button key={ch.id} onClick={() => setFilters({ channelId: ch.id })}
          className={`flex items-center gap-2 w-full px-2 py-2.5 rounded-lg text-sm transition-all ${
            filters.channelId === ch.id ? 'font-medium border' : 'text-gray-600 hover:bg-white hover:text-gray-800'
          }`}
          style={filters.channelId === ch.id ? { background: 'rgba(24, 166, 252, 0.1)', color: '#18a6fc', borderColor: 'rgba(24, 166, 252, 0.2)' } : undefined}>
          <span className={`w-6 h-6 rounded-md flex items-center justify-center ${channelColors[ch.type] || 'bg-gray-200 text-gray-500'}`}>
            {channelIcons[ch.type]}
          </span>
          <span className="truncate">{ch.name}</span>
          {ch._count && <span className="ml-auto text-xs text-gray-400">{ch._count.conversations}</span>}
        </button>
      ))}
    </div>
  );
}
