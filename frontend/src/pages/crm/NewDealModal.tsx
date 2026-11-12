import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { contactService } from '../../services/index';
import { crmApi, Pipeline, errMsg } from './api';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary/50 focus:outline-none';

export default function NewDealModal({ pipeline, stageId, users, isAdmin, onClose }: {
  pipeline: Pipeline; stageId?: string; users: { id: string; name: string }[]; isAdmin: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [contact, setContact] = useState<{ id: string; name: string; phone?: string } | null>(null);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState(stageId ?? pipeline.stages.find(s => s.kind === 'OPEN')?.id ?? '');
  const [ownerId, setOwnerId] = useState('');

  useEffect(() => { const t = setTimeout(() => setQ(search), 300); return () => clearTimeout(t); }, [search]);
  const { data, isFetching } = useQuery({ queryKey: ['contacts-pick', q], queryFn: () => contactService.list({ search: q, limit: 8 }), enabled: !contact });

  const create = useMutation({
    mutationFn: () => crmApi.createDeal({
      contactId: contact!.id, pipelineId: pipeline.id, stageId: stage, title: title || contact!.name,
      value: Number(value) || 0, ...(isAdmin && ownerId ? { ownerId } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-board'] }); toast.success('Deal dibuat'); onClose(); },
    onError: e => toast.error(errMsg(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Deal baru · {pipeline.name}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div className="text-xs font-medium text-gray-600">Kontak
            {contact ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                <span className="text-sm text-gray-800">{contact.name} <span className="text-xs text-gray-400">{contact.phone}</span></span>
                <button onClick={() => setContact(null)} className="text-xs text-primary hover:underline">Ganti</button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor" className={`${INPUT} pl-9`} />
                </div>
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                  {isFetching && <li className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></li>}
                  {data?.data.map(c => (
                    <li key={c.id}>
                      <button onClick={() => { setContact({ id: c.id, name: c.name, phone: c.phone ?? undefined }); setTitle(c.name); }}
                        className="w-full px-3 py-2 text-left text-sm font-normal text-gray-700 hover:bg-gray-50">
                        {c.name} <span className="text-xs text-gray-400">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                  {!isFetching && !data?.data.length && <li className="px-3 py-3 text-center font-normal text-gray-400">Kontak tidak ditemukan</li>}
                </ul>
              </>
            )}
          </div>
          <label className="block text-xs font-medium text-gray-600">Judul deal<input value={title} onChange={e => setTitle(e.target.value)} placeholder="mis. Kelas Bisnis Online" className={`${INPUT} mt-1`} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-600">Nilai (Rp)
              <input inputMode="numeric" value={value ? Number(value).toLocaleString('id-ID') : ''} onChange={e => setValue(e.target.value.replace(/\D/g, ''))} placeholder="0" className={`${INPUT} mt-1`} />
            </label>
            <label className="text-xs font-medium text-gray-600">Tahap
              <select value={stage} onChange={e => setStage(e.target.value)} className={`${INPUT} mt-1`}>
                {pipeline.stages.filter(s => s.kind === 'OPEN').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          {isAdmin && (
            <label className="block text-xs font-medium text-gray-600">Pemilik
              <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className={`${INPUT} mt-1`}>
                <option value="">Saya sendiri</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Batal</button>
          <button disabled={!contact || create.isPending} onClick={() => create.mutate()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Buat deal
          </button>
        </div>
      </div>
    </div>
  );
}
