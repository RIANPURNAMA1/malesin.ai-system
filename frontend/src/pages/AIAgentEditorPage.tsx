import { ArrowLeft, Save, Eye, CheckCircle2, Loader2 } from 'lucide-react';
import { Spinner } from '../components/ui/index';
import { Tab } from './ai-agent-editor/types';
import { useAgentEditor } from './ai-agent-editor/useAgentEditor';
import BehaviorTab from './ai-agent-editor/BehaviorTab';
import ConfigTab from './ai-agent-editor/ConfigTab';
import KnowledgeTab from './ai-agent-editor/KnowledgeTab';
import TestTab from './ai-agent-editor/TestTab';
import PlaceholderTabs from './ai-agent-editor/PlaceholderTabs';

export default function AIAgentEditorPage() {
  const ed = useAgentEditor();
  const { navigate, isEdit, tab, setTab, form, savedFlash, loadingAgent, handleCancel, saveMutation, handleSave, navItems } = ed;

  if (isEdit && loadingAgent) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
  <div className="flex h-full flex-col bg-white">
    {/* Header */}
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-8 py-5">
      <div className="flex min-w-0 items-center gap-4">
        <button
          onClick={() => navigate('/ai-agents')}
          aria-label="Kembali ke AI Agents"
          className="text-gray-800 transition hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-2xl font-bold text-gray-900">
          {isEdit ? form.name || 'AI Agent' : 'Buat AI Agent baru'}
        </h1>
      </div>
      {savedFlash && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" /> Tersimpan
        </span>
      )}
    </div>

    {/* Tab horizontal */}
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-8">
      <nav className="flex gap-2 overflow-x-auto">
        {navItems.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-semibold transition ${
                active ? 'border-primary text-primary' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <button
        onClick={() => setTab('test')}
        className="gradient-btn flex-shrink-0 px-4 py-2 text-sm"
      >
        <Eye className="h-4 w-4" /> Pratinjau
      </button>
    </div>

    {/* Body (scroll) */}
    <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60">
      <div className={`mx-auto px-8 py-6 ${tab === 'behavior' ? 'max-w-7xl' : 'max-w-4xl'}`}>

        {tab === 'behavior' && <BehaviorTab ed={ed} />}
        <PlaceholderTabs tab={tab} />
        {tab === 'config' && <ConfigTab ed={ed} />}
        {tab === 'knowledge' && <KnowledgeTab ed={ed} />}
        {tab === 'test' && <TestTab ed={ed} />}
      </div>
    </div>

    {/* Bar bawah */}
    <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-8 py-4">
      <button
        onClick={handleCancel}
        disabled={saveMutation.isPending}
        className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
      >
        Batalkan edit
      </button>
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="gradient-btn px-6 py-2.5 text-sm disabled:opacity-50"
      >
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isEdit ? 'Simpan' : 'Buat Agent'}
      </button>
    </div>
  </div>
  );
}

