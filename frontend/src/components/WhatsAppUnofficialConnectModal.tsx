import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, Loader2, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSocketStore } from '../store/socket.store';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Props {
  onClose: () => void;
  /** Isi untuk menghubungkan ulang perangkat yang sudah ada (langsung ke langkah QR). */
  reconnect?: { id: string; name: string };
}

export default function WhatsAppUnofficialConnectModal({ onClose, reconnect }: Props) {
  const [name, setName] = useState(reconnect?.name ?? 'WhatsApp Unofficial');
  const [step, setStep] = useState<'form' | 'qr' | 'connected' | 'error'>(reconnect ? 'qr' : 'form');
  const [qrCode, setQrCode] = useState('');
  const [channelId, setChannelId] = useState(reconnect?.id ?? '');
  const [errorMsg, setErrorMsg] = useState('');
  const qc = useQueryClient();
  const { socket } = useSocketStore();
  const channelIdRef = useRef(reconnect?.id ?? '');

  useEffect(() => {
    if (!socket) return;

    const onReady = (data: { channelId: string }) => {
      if (data.channelId === channelIdRef.current) {
        setStep('connected');
        qc.invalidateQueries({ queryKey: ['channels'] });
        toast.success('WhatsApp Unofficial berhasil terhubung!');
      }
    };

    const onError = (data: { channelId: string; error: string }) => {
      if (data.channelId === channelIdRef.current) {
        setErrorMsg(data.error);
        setStep('error');
      }
    };

    // QR di-refresh Baileys tiap ~20 detik; tanpa ini QR yang tampil jadi kedaluwarsa
    const onQr = (data: { channelId: string; qr: string }) => {
      if (data.channelId === channelIdRef.current) {
        setQrCode(data.qr);
      }
    };

    socket.on('wa-unofficial:ready', onReady);
    socket.on('wa-unofficial:error', onError);
    socket.on('wa-unofficial:qr', onQr);

    return () => {
      socket.off('wa-unofficial:ready', onReady);
      socket.off('wa-unofficial:error', onError);
      socket.off('wa-unofficial:qr', onQr);
    };
  }, [socket, qc]);

  // Fallback REST: kalau event socket terlewat (socket putus / token expired),
  // modal tetap tahu kapan WhatsApp sudah benar-benar connected.
  useEffect(() => {
    if (step !== 'qr' || !channelId) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await api.get(`/whatsapp-unofficial/${channelId}/status`);
        const status = res.data?.data?.status;
        if (!cancelled && status === 'connected') {
          setStep('connected');
          qc.invalidateQueries({ queryKey: ['channels'] });
          toast.success('WhatsApp Unofficial berhasil terhubung!');
        }
      } catch {
        /* diamkan, coba lagi di interval berikutnya */
      }
    };

    const timer = setInterval(check, 2000);
    void check();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [step, channelId, qc]);

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/whatsapp-unofficial/init', { channelName: name });
      return res.data.data;
    },
    onSuccess: (data) => {
      const channel = data.channel || data;
      const qr = data.qr;
      setChannelId(channel.id);
      channelIdRef.current = channel.id;
      if (qr) {
        setQrCode(qr);
        setStep('qr');
        toast.success('Scan QR code dengan WhatsApp Anda!');
      } else {
        // Session sudah ada dan langsung login tanpa QR
        setStep('connected');
        qc.invalidateQueries({ queryKey: ['channels'] });
        toast.success('WhatsApp Unofficial berhasil terhubung!');
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || 'Gagal inisialisasi');
      setStep('error');
    },
  });

  // Hubungkan ulang: sesi lama tidak valid (mis. logout) → backend memberi QR baru.
  const reconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/whatsapp-unofficial/${reconnect!.id}/reconnect`);
      return res.data.data as { qr: string | null };
    },
    onSuccess: ({ qr }) => {
      if (qr) {
        setQrCode(qr);
        setStep('qr');
      } else {
        // Kredensial masih valid: langsung tersambung tanpa scan.
        setStep('connected');
        qc.invalidateQueries({ queryKey: ['channels'] });
        toast.success('WhatsApp berhasil terhubung kembali!');
      }
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || 'Gagal menghubungkan ulang');
      setStep('error');
    },
  });

  const startReconnect = () => {
    setQrCode('');
    setStep('qr');
    reconnectMutation.mutate();
  };

  useEffect(() => {
    if (reconnect) startReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nama channel wajib diisi');
      return;
    }
    setStep('qr');
    initMutation.mutate();
  };

  const handleClose = () => {
    // Jangan putuskan sesi kalau sudah connected — cukup tutup modal.
    // Mode hubungkan ulang: hanya hentikan bila QR sudah tampil (sesi lama memang
    // tidak valid); jangan logout sesi yang mungkin masih tersambung ulang.
    if (channelId && step !== 'connected' && (!reconnect || qrCode)) {
      api.post(`/whatsapp-unofficial/${channelId}/logout`).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin relative animate-slide-up bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {reconnect ? `Hubungkan ulang "${reconnect.name}"` : 'Connect WhatsApp Unofficial'}
          </h3>
          <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Smartphone className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Menggunakan <strong>Baileys</strong>. Scan QR code dengan WhatsApp Anda untuk menghubungkan.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Channel Name</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="e.g. WhatsApp Marketing"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="font-medium text-gray-600">Cara menghubungkan:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Masukkan nama channel</li>
                <li>Scan QR code yang muncul dengan WhatsApp Anda</li>
                <li>Tunggu hingga status berubah menjadi "Connected"</li>
              </ol>
            </div>

            <button type="submit" className="w-full gradient-btn py-2.5 text-sm">
              <Smartphone className="w-4 h-4" />
              Connect Now
            </button>
          </form>
        )}

        {step === 'qr' && (
          <div className="px-6 py-8 text-center space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                {qrCode ? (
                  <img src={qrCode} alt="QR Code" className="w-64 h-64 border-2 border-gray-200 rounded-xl p-2" />
                ) : (
                  <div className="w-64 h-64 border-2 border-dashed border-gray-200 rounded-xl p-2 flex items-center justify-center bg-gray-50">
                    <div className="text-center space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-gray-400">Menyiapkan QR code...</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-gray-700">Scan QR code ini dengan WhatsApp Anda</p>
              <p className="text-xs text-gray-400">
                Buka WhatsApp {'>'} Settings {'>'} Linked Devices {'>'} Link a Device
              </p>
              <div className="flex items-center justify-center gap-1 text-xs text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Menunggu scan...
              </div>
            </div>
          </div>
        )}

        {step === 'connected' && (
          <div className="px-6 py-8 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <p className="text-gray-800 font-medium text-lg">WhatsApp Connected!</p>
            <p className="text-sm text-gray-500">WhatsApp unofficial berhasil terhubung dan siap digunakan</p>
            <button onClick={onClose} className="gradient-btn px-6 py-2.5 text-sm mt-2">
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <p className="text-gray-800 font-medium">Connection Failed</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <button onClick={() => (reconnect ? startReconnect() : setStep('form'))} className="gradient-btn px-6 py-2.5 text-sm mt-2">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
