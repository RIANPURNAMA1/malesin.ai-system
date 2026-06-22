import { useState } from 'react';
import { Search, Bot, Plus, X } from 'lucide-react';

const templates = [
  {
    id: 'customer-service',
    name: 'Customer Service AI',
    description: 'This AI agent is designed to help you with customer support and sales inquiries for your business.',
  },
];

export default function AIAgentsPage() {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('rian');
  const [selectedTemplate, setSelectedTemplate] = useState('customer-service');

  return (
    <div className="h-full p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">AI Agents</h1>
        <p className="text-gray-600 mb-6">
          This is the page where you can revisit the AI agents you created earlier.
          <br />
          Feel free to make changes and create as many chatbots as you want anytime!
        </p>

        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search AI agents..."
            className="w-full bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="glass-card p-12 text-center">
          <Bot className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No AI Agents Found</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            You haven't created any AI agents yet. Create your first one to get started!
          </p>
          <button className="gradient-btn px-6 py-2.5 text-sm" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Create Your First Agent
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative glass-modal w-full max-w-lg mx-4 animate-slide-up">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Create New AI Agent</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Template</label>
                <div className="space-y-2.5">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedTemplate === t.id ? '' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      style={selectedTemplate === t.id ? { borderColor: 'rgba(24, 166, 252, 0.4)', background: 'rgba(24, 166, 252, 0.05)' } : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                          selectedTemplate === t.id ? '' : 'border-gray-300'
                        }`}
                        style={selectedTemplate === t.id ? { borderColor: '#18a6fc' } : undefined}>
                          {selectedTemplate === t.id && (
                            <div className="w-2 h-2 rounded-full m-0.5" style={{ background: '#18a6fc' }} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Cancel
              </button>
              <button className="gradient-btn px-5 py-2 text-sm">
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
