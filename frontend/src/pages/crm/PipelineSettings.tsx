import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { crmApi, Pipeline, Stage, AutoMode, AUTO_MODE_LABEL, AUTO_RULE_LABEL, errMsg } from './api';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none';
type Draft = Partial<Stage> & { key: string };

/** Pengaturan pipeline: nama, mode otomasi, auto-batal, dan editor tahap. */
export default function PipelineSettings({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(pipeline.name);
  const [autoMode, setAutoMode] = useState<AutoMode>(pipeline.autoMode);
  const [autoCreate, setAutoCreate] = useState(pipeline.autoCreateDeals);
  const [lostDays, setLostDays] = useState(pipeline.lostAfterDays);
  const [isDefault, setIsDefault] = useState(pipeline.isDefault);
  const [stages, setStages] = useState<Draft[]>(pipeline.stages.map(s => ({ ...s, key: s.id })));

  const save = useMutation({
    mutationFn: async () => {
      await crmApi.updatePipeline(pipeline.id, { name, autoMode, autoCreateDeals: autoCreate, lostAfterDays: lostDays, ...(isDefault ? { isDefault: true } : {}) });
      await crmApi.saveStages(pipeline.id, stages.map(({ key, ...s }) => { void key; return s; }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-pipelines'] });
      qc.invalidateQueries({ queryKey: ['crm-board'] });
      toast.success('Pipeline disimpan');
      onClose();
    },
    onError: e => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => crmApi.deletePipeline(pipeline.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-pipelines'] }); onClose(); },
    onError: e => toast.error(errMsg(e)),
  });

  const patch = (key: string, p: Partial<Stage>) => setStages(list => list.map(s => (s.key === key ? { ...s, ...p } : s)));
  const moveStage = (i: number, dir: -1 | 1) => setStages(list => {
    const n = [...list]; const j = i + dir;
    if (j < 0 || j >= n.length) return list;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const usedRules = new Set(stages.map(s => s.autoRule).filter(Boolean));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Pengaturan pipeline</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">Nama pipeline<input value={name} onChange={e => setName(e.target.value)} className={`${INPUT} mt-1`} /></label>
            <label className="text-xs font-medium text-gray-600">Batal otomatis bila tidak aktif (hari, 0 = mati)
              <input type="number" min={0} max={365} value={lostDays} onChange={e => setLostDays(Number(e.target.value))} className={`${INPUT} mt-1`} />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-600">Mode otomasi</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(AUTO_MODE_LABEL) as AutoMode[]).map(m => (
                <button key={m} type="button" onClick={() => setAutoMode(m)}
                  className={`rounded-lg border p-2.5 text-left transition ${autoMode === m ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <p className={`text-sm font-medium ${autoMode === m ? 'text-primary' : 'text-gray-800'}`}>{AUTO_MODE_LABEL[m].label}</p>
                  <p className="text-[11px] text-gray-500">{AUTO_MODE_LABEL[m].hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoCreate} onChange={e => setAutoCreate(e.target.checked)} />Buat deal otomatis saat kontak baru chat pertama kali</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={isDefault} disabled={pipeline.isDefault} onChange={e => setIsDefault(e.target.checked)} />Pipeline default (dipakai otomasi chat masuk)</label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">Tahap (urutan kiri → kanan)</p>
              <button type="button" onClick={() => setStages(l => {
                const idx = l.findIndex(s => s.kind !== 'OPEN');
                const n = [...l];
                n.splice(idx < 0 ? n.length : idx, 0, { key: `new-${Date.now()}`, name: 'Tahap baru', color: '#64748b', kind: 'OPEN', autoRule: null, aiHint: '' });
                return n;
              })} className="flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" />Tambah tahap</button>
            </div>
            <ul className="space-y-2">
              {stages.map((s, i) => (
                <li key={s.key} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <input type="color" value={s.color ?? '#0E3F96'} onChange={e => patch(s.key, { color: e.target.value })} className="h-8 w-8 flex-shrink-0 cursor-pointer rounded border border-gray-200" />
                    <input value={s.name ?? ''} onChange={e => patch(s.key, { name: e.target.value })} className={INPUT} />
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.kind === 'WON' ? 'bg-emerald-50 text-emerald-600' : s.kind === 'LOST' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                      {s.kind === 'WON' ? 'Menang' : s.kind === 'LOST' ? 'Kalah' : 'Terbuka'}
                    </span>
                    <button type="button" onClick={() => moveStage(i, -1)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => moveStage(i, 1)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><ArrowDown className="h-3.5 w-3.5" /></button>
                    {s.kind === 'OPEN' && (
                      <button type="button" onClick={() => setStages(l => l.filter(x => x.key !== s.key))} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr]">
                    {s.kind === 'OPEN' ? (
                      <select value={s.autoRule ?? ''} onChange={e => patch(s.key, { autoRule: e.target.value || null })} className={`${INPUT} text-xs`}>
                        <option value="">Tanpa aturan sistem</option>
                        {Object.entries(AUTO_RULE_LABEL).map(([k, label]) => (
                          <option key={k} value={k} disabled={usedRules.has(k) && s.autoRule !== k}>{label}</option>
                        ))}
                      </select>
                    ) : <span className="self-center text-[11px] text-gray-400">{s.kind === 'WON' ? 'AI hanya menyarankan; agen mengonfirmasi' : 'Wajib alasan; otomatis via timer tidak aktif'}</span>}
                    <input value={s.aiHint ?? ''} onChange={e => patch(s.key, { aiHint: e.target.value })} placeholder="Definisi untuk AI: kapan pelanggan dianggap di tahap ini" className={`${INPUT} text-xs`} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          {!pipeline.isDefault ? (
            <button onClick={() => confirm('Hapus pipeline beserta semua deal-nya?') && del.mutate()} className="text-xs text-red-500 hover:underline">Hapus pipeline</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Batal</button>
            <button disabled={save.isPending} onClick={() => save.mutate()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
