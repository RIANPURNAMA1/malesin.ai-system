import { useState } from 'react';
import { LOST_REASONS } from './api';

/** Pindah ke tahap kalah wajib memilih alasan (dipakai laporan). */
export default function LostReasonModal({ stageName, onConfirm, onCancel }: {
  stageName: string; onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [other, setOther] = useState('');
  const final = reason === 'Lainnya' ? other.trim() : reason;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900">Pindah ke “{stageName}”</h3>
        <p className="mb-3 text-xs text-gray-500">Pilih alasan kalah</p>
        <div className="space-y-1.5">
          {LOST_REASONS.map(r => (
            <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={reason === r} onChange={() => setReason(r)} />{r}
            </label>
          ))}
        </div>
        {reason === 'Lainnya' && (
          <input autoFocus value={other} onChange={e => setOther(e.target.value)} placeholder="Tulis alasan"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Batal</button>
          <button disabled={!final} onClick={() => onConfirm(final)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Pindahkan</button>
        </div>
      </div>
    </div>
  );
}
