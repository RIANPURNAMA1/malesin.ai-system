import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { providerMeta, PROVIDER_ORDER } from '../../constants/aiProviders';
import type { AgentEditor } from './useAgentEditor';

export default function ConfigTab({ ed }: { ed: AgentEditor }) {
  const { id, isEdit, form, errors, showKey, setShowKey, modelOptions, setModelOptions, setConnectionResult, providers, agent, set, loadModelsMutation, keyPlaceholder } = ed;
  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Informasi Dasar</h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Name <span className="text-danger">*</span></label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. CS WhatsApp Assistant"
              className={`w-full rounded-xl border ${errors.name ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
            />
            {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="Deskripsi singkat fungsi AI agent ini"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Provider & Model</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {PROVIDER_ORDER.map(p => {
            const m = providerMeta[p];
            const Icon = m.icon;
            const active = form.provider === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  if (form.provider === p) return;
                  const nextModels = providers?.find(x => x.id === p)?.models ?? [];
                  set('provider', p);
                  setModelOptions(nextModels);
                  // Model lama milik provider sebelumnya tidak berlaku di provider baru.
                  set('model', nextModels[0] ?? '');
                  setConnectionResult(null);
                }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition ${
                  active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <Icon className="w-5 h-5" style={{ color: m.color }} />
                <span className="text-xs font-medium text-gray-700">{m.short}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-gray-700">
            API Key {!isEdit && <span className="text-danger">*</span>}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={e => set('apiKey', e.target.value)}
              placeholder={isEdit ? 'Biarkan kosong untuk memakai key tersimpan' : keyPlaceholder}
              autoComplete="off"
              className={`w-full rounded-xl border ${errors.apiKey ? 'border-danger' : 'border-gray-300'} bg-white pl-3 pr-10 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title={showKey ? 'Sembunyikan' : 'Tampilkan'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.apiKey && <p className="text-xs text-danger">{errors.apiKey}</p>}
          {isEdit && agent?.hasApiKey && !form.apiKey && (
            <p className="text-xs text-gray-400">API key tersimpan dan terenkripsi. Isi hanya jika ingin mengganti.</p>
          )}
        </div>

        <div className="flex flex-col gap-1 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Model <span className="text-danger">*</span></label>
            <button
              type="button"
              onClick={() => loadModelsMutation.mutate()}
              disabled={loadModelsMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadModelsMutation.isPending ? 'animate-spin' : ''}`} />
              Load Models
            </button>
          </div>
          <input
            list="ai-model-options"
            value={form.model}
            onChange={e => set('model', e.target.value)}
            placeholder="Pilih atau ketik nama model"
            className={`w-full rounded-xl border ${errors.model ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
          />
          <datalist id="ai-model-options">
            {modelOptions.map(m => <option key={m} value={m} />)}
          </datalist>
          {errors.model && <p className="text-xs text-danger">{errors.model}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Temperature</label>
            <input
              type="number" step="0.1" min={0} max={2}
              value={form.temperature}
              onChange={e => set('temperature', Number(e.target.value))}
              className={`w-full rounded-xl border ${errors.temperature ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
            />
            <span className="text-xs text-gray-400">0 = deterministik, 2 = paling kreatif</span>
            {errors.temperature && <p className="text-xs text-danger">{errors.temperature}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Max Tokens</label>
            <input
              type="number" step="1" min={1}
              value={form.maxTokens}
              onChange={e => set('maxTokens', Number(e.target.value))}
              className={`w-full rounded-xl border ${errors.maxTokens ? 'border-danger' : 'border-gray-300'} bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20`}
            />
            {errors.maxTokens && <p className="text-xs text-danger">{errors.maxTokens}</p>}
          </div>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">System Prompt</h2>
        <p className="text-xs text-gray-500 mb-3">Atur identitas, perilaku, instruksi, dan aturan AI.</p>
        <textarea
          value={form.systemPrompt}
          onChange={e => set('systemPrompt', e.target.value)}
          rows={7}
          placeholder="You are a helpful customer service assistant for ..."
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 font-mono focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-y"
        />
      </section>

      <section className="glass-card rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Status</h2>
          <p className="text-xs text-gray-500">Agent nonaktif tidak akan melayani pelanggan.</p>
        </div>
        <button
          type="button"
          onClick={() => set('isActive', !form.isActive)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${form.isActive ? 'bg-success' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </section>
    </div>
  );
}

