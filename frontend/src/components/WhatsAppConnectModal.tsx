import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelService } from '../services/index';
import { XCircle, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function WhatsAppConnectModal({ onClose }: Props) {
  const [form, setForm] = useState({
    name: 'WhatsApp Business',
    wabaId: '',
    phoneNumberId: '',
    accessToken: '',
    verifyToken: 'malesan_verify_2026',
  });
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      channelService.create({
        type: 'WHATSAPP',
        ...form,
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
      toast.success('WhatsApp berhasil terhubung!');
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Gagal menghubungkan WhatsApp'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wabaId || !form.phoneNumberId || !form.accessToken) {
      toast.error('WABA ID, Phone Number ID, dan Access Token wajib diisi');
      return;
    }
    mutation.mutate();
  };

  const update = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="glass-modal w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin relative animate-slide-up bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Connect WhatsApp Business</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Channel Name</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="e.g. Support WhatsApp"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">WABA ID</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="123456789012345"
              value={form.wabaId}
              onChange={(e) => update('wabaId', e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">WhatsApp Business Account ID dari Meta Business Settings</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Phone Number ID</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Phone Number ID dari Meta"
              value={form.phoneNumberId}
              onChange={(e) => update('phoneNumberId', e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Access Token</label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="EAAP... (WhatsApp Access Token)"
              value={form.accessToken}
              onChange={(e) => update('accessToken', e.target.value)}
            />
            <p className="text-xs text-amber-600 mt-1">Token akan dienkripsi sebelum disimpan di database.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Verify Token</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="malesan_verify_2026"
              value={form.verifyToken}
              onChange={(e) => update('verifyToken', e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Cocokkan dengan Verify Token di Meta Webhook settings.</p>
          </div>

          <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="font-medium text-gray-600">Cara mendapatkan credentials:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Buka <a className="text-primary hover:underline" href="https://developers.facebook.com" target="_blank">Meta Developers</a></li>
              <li>Masuk ke app &rarr; WhatsApp &rarr; API Setup</li>
              <li>Copy <strong>Phone Number ID</strong> dan <strong>WABA ID</strong></li>
              <li>Generate <strong>Access Token</strong> (atau dari System User)</li>
              <li>Set webhook Callback URL ke <code className="bg-gray-200 px-1 rounded">{window.location.origin}/api/webhook</code></li>
            </ol>
          </div>
        </form>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="gradient-btn px-6 py-2 text-sm"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {mutation.isPending ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
