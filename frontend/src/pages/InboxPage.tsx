import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { channelService } from '../services/index';
import { Channel } from '../types';
import ChannelSidebar from '../components/inbox/ChannelSidebar';
import ConversationList from '../components/inbox/ConversationList';
import ChatWindow from '../components/inbox/ChatWindow';
import ContactDetailPanel from '../components/inbox/ContactDetailPanel';
import { ExternalLink, MessageCircle, Instagram, Facebook, ChevronLeft } from 'lucide-react';
import { useInboxStore } from '../store/inbox.store';

const steps = [
  { to: '/channels', img: 'https://chat.cekat.ai/assets/images/3dInbox.png', title: '1. Connect platforms', desc: 'Start receiving messages from WhatsApp, IG, and FB!' },
  { to: '/ai-agents', img: 'https://chat.cekat.ai/assets/images/3dAI.png', title: '2. Create an AI agent', desc: 'Answer incoming messages with your AI agent' },
  { to: '/settings', img: 'https://chat.cekat.ai/assets/images/3dAgent.png', title: '3. Invite human agents', desc: 'Invite your team to help answer chats' },
  { to: '/channels', img: 'https://chat.cekat.ai/assets/images/3dLink.png', title: '4. Connect AI agent to inbox', desc: 'Connect your AI agent and human agents to your platforms' },
];

const channelIcons: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageCircle className="w-3.5 h-3.5" />,
  INSTAGRAM: <Instagram className="w-3.5 h-3.5" />,
  FACEBOOK: <Facebook className="w-3.5 h-3.5" />,
};

const channelColors: Record<string, string> = {
  WHATSAPP: 'bg-green-100 text-green-700',
  INSTAGRAM: 'bg-pink-100 text-pink-700',
  FACEBOOK: 'bg-blue-100 text-blue-700',
};

export default function InboxPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [showDetail, setShowDetail] = useState(false);
  const { filters, setFilters } = useInboxStore();
  const { data: channels } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });

  const handleSelect = (id: string) => {
    navigate(`/inbox/${id}`);
    setShowDetail(false);
  };

  const goBackToList = () => {
    navigate('/inbox');
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Channel sidebar - desktop only */}
      <div className="hidden lg:block">
        <ChannelSidebar />
      </div>

      {/* Mobile channel bar */}
      <div className="lg:hidden flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200 overflow-x-auto scrollbar-none flex-shrink-0">
        <button onClick={() => setFilters({ channelId: '' })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            !filters.channelId ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
          }`}
          style={!filters.channelId ? { background: '#18a6fc' } : undefined}>
          <MessageCircle className="w-3.5 h-3.5" />
          All
        </button>
        {Array.isArray(channels) && channels.map((ch: Channel) => (
          <button key={ch.id} onClick={() => setFilters({ channelId: ch.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filters.channelId === ch.id ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
            style={filters.channelId === ch.id ? { background: '#18a6fc' } : undefined}>
            <span className={`w-5 h-5 rounded-md flex items-center justify-center ${channelColors[ch.type] || 'bg-gray-200 text-gray-500'}`}>
              {channelIcons[ch.type]}
            </span>
            {ch.name}
            {ch._count && <span className="text-xs opacity-70">{ch._count.conversations}</span>}
          </button>
        ))}
      </div>

      {/* Main content row - desktop side-by-side, mobile stacked */}
      <div className="flex-1 flex flex-row min-h-0">
        {/* Conversation list - mobile: full width when no conv selected; desktop: fixed width */}
        <div className={`${conversationId ? 'hidden' : 'flex'} lg:flex flex-col h-full w-full lg:w-[320px] bg-white border-r border-gray-200 flex-shrink-0`}>
          <ConversationList onSelect={handleSelect} selectedId={conversationId} />
        </div>

        {conversationId ? (
          <div className={`${!conversationId ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0`}>
            <ChatWindow
              conversationId={conversationId}
              onOpenDetail={() => setShowDetail(o => !o)}
              onBack={goBackToList}
            />
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-white px-6">
            <div className="max-w-lg w-full">
              <h1 className="text-2xl font-semibold text-gray-800 mb-8 text-center">
                Welcome back to <span style={{ color: '#18a6fc' }}>malesin.AI</span>!
              </h1>

              <div className="space-y-3">
                {steps.map((s, i) => (
                  <div key={i} onClick={() => navigate(s.to)} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-50 overflow-hidden">
                      <img src={s.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <a href="#" onClick={e => e.preventDefault()} className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: '#18a6fc' }}>
                  Need more help? Watch our YouTube tutorials
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ContactDetailPanel - desktop side panel */}
        {showDetail && conversationId && (
          <div className="hidden lg:block">
            <ContactDetailPanel conversationId={conversationId} onClose={() => setShowDetail(false)} />
          </div>
        )}
      </div>

      {/* ContactDetailPanel - mobile overlay */}
      {showDetail && conversationId && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDetail(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white shadow-xl">
            <ContactDetailPanel conversationId={conversationId} onClose={() => setShowDetail(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
