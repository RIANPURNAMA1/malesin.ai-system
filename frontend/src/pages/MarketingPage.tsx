import { Megaphone, Sparkles } from 'lucide-react';

export default function MarketingPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        <div className="glass-card rounded-2xl p-16 text-center !transform-none">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-primary/10">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Marketing</h2>
          <p className="text-gray-500 text-sm mb-6">Create and manage marketing campaigns</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm">
            <Sparkles className="w-4 h-4 text-warning" />
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
