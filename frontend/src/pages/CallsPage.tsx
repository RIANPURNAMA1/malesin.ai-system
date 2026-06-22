import { Phone } from 'lucide-react';

export default function CallsPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Calls</h2>
        <p className="text-gray-600 text-sm">Manage your call logs and call center</p>
      </div>
    </div>
  );
}
