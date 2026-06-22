import { MessageSquare } from 'lucide-react';

export default function ConversationsPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Conversations</h2>
        <p className="text-gray-600 text-sm">View all your conversations across channels</p>
      </div>
    </div>
  );
}
