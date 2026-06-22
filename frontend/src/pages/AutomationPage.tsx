import { Workflow, Sparkles } from 'lucide-react';

export default function AutomationPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        <div className="glass-card rounded-2xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(6,214,160,0.15)' }}>
            <Workflow className="w-8 h-8 text-accent-cyan" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Automation</h2>
          <p className="text-gray-400 text-sm mb-6">Build automated workflows to streamline your operations</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-surface text-gray-300 text-sm">
            <Sparkles className="w-4 h-4 text-warning" />
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
