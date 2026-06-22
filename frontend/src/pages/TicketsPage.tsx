import { Ticket } from 'lucide-react';

export default function TicketsPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Tickets</h2>
        <p className="text-gray-600 text-sm">Manage support tickets from all channels</p>
      </div>
    </div>
  );
}
