import { Megaphone } from 'lucide-react';

export default function BroadcastsPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 px-6">
      <Megaphone className="w-16 h-16 mb-4 opacity-40" />
      <h2 className="text-xl font-semibold text-gray-500 mb-1">Broadcasts</h2>
      <p className="text-sm text-gray-400 text-center max-w-sm">Manage your broadcast campaigns and bulk messaging here.</p>
    </div>
  );
}
