import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChannelSidebar from '../components/inbox/ChannelSidebar';
import ConversationList from '../components/inbox/ConversationList';
import ChatWindow from '../components/inbox/ChatWindow';
import ContactDetailPanel from '../components/inbox/ContactDetailPanel';
import { ExternalLink } from 'lucide-react';

const steps = [
  { to: '/channels', img: 'https://chat.cekat.ai/assets/images/3dInbox.png', title: '1. Connect platforms', desc: 'Start receiving messages from WhatsApp, IG, and FB!' },
  { to: '/ai-agents', img: 'https://chat.cekat.ai/assets/images/3dAI.png', title: '2. Create an AI agent', desc: 'Answer incoming messages with your AI agent' },
  { to: '/settings', img: 'https://chat.cekat.ai/assets/images/3dAgent.png', title: '3. Invite human agents', desc: 'Invite your team to help answer chats' },
  { to: '/channels', img: 'https://chat.cekat.ai/assets/images/3dLink.png', title: '4. Connect AI agent to inbox', desc: 'Connect your AI agent and human agents to your platforms' },
];

export default function InboxPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [showDetail, setShowDetail] = useState(false);

  const handleSelect = (id: string) => {
    navigate(`/inbox/${id}`);
    setShowDetail(false);
  };

  return (
    <div className="h-full flex">
      <ChannelSidebar />
      <ConversationList onSelect={handleSelect} selectedId={conversationId} />
      {conversationId ? (
        <>
          <ChatWindow conversationId={conversationId} onOpenDetail={() => setShowDetail(o => !o)} />
          {showDetail && <ContactDetailPanel conversationId={conversationId} onClose={() => setShowDetail(false)} />}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white px-6">
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
    </div>
  );
}
