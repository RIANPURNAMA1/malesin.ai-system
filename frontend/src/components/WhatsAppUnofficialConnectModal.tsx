import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, Loader2, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { channelService } from '../services/index';
import { useSocketStore } from '../store/socket.store';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Props {
  onClose: () => void;
}

export default function WhatsAppUnofficialConnectModal({ onClose }: Props) {
  const [name, setName] = useState('WhatsApp Unofficial');
  const [step, setStep] = useState<'form' | 'qr' | 'connected' | 'error'>('form');
  const [qrCode, setQrCode] = useState('');
  const [channelId, setChannelId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const qc = useQueryClient();
  const { socket } = useSocketStore();
  const socketRef = useRef(socket);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (!socket || !channelId) return;

    const onQr = (data: { channelId: string; qr: string }) => {
      if (data.channelId === channelId) {
        setQrCode(data.qr);
        setStep('qr');
      }
    };

    const onAuthenticated = (data: { channelId: string }) => {
      if (data.channelId === channelId) {
        toast.success('WhatsApp authenticated!');
      }
    };

    const onReady = (data: { channelId: string }) => {
      if (data.channelId === channelId) {
        setStep('connected');
        qc.invalidateQueries({ queryKey: ['channels'] });
        toast.success('WhatsApp Unofficial berhasil terhubung!');
      }
    };

    const onError = (data: { channelId: string; error: string }) => {
      if (data.channelId === channelId) {
        setErrorMsg(data.error);
        setStep('error');
      }
    };

    socket.on('wa-unofficial:qr', onQr);
    socket.on('wa-unofficial:authenticated', onAuthenticated);
    socket.on('wa-unofficial:ready', onReady);
    socket.on('wa-unofficial:error', onError);

    return () => {
      socket.off('wa-unofficial:qr', onQr);
      socket.off('wa-unofficial:authenticated', onAuthenticated);
      socket.off('wa-unofficial:ready', onReady);
      socket.off('wa-unofficial:error', onError);
    };
  }, [socket, channelId, qc]);

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/whatsapp-unofficial/init', { channelName: name });
      return res.data.data;
    },
    onSuccess: (data) => {
      setChannelId(data.id);
      toast.success('Menghubungkan ke WhatsApp... Scan QR code!');
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || 'Gagal inisialisasi');
      setStep('error');
    },
  });

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
    if (channelId) {
      api.post(`/whatsapp-unofficial/${channelId}/logout`).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin relative animate-slide-up bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Connect WhatsApp Unofficial</h3>
          <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Smartphone className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Menggunakan <strong>whatsapp-web.js</strong>. Scan QR code dengan WhatsApp Anda untuk menghubungkan.
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
            {initMutation.isPending ? (
              <div className="space-y-4 py-8">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <p className="text-gray-700 font-medium">Initializing WhatsApp client...</p>
                <p className="text-sm text-gray-400">Mempersiapkan browser untuk generate QR code</p>
              </div>
            ) : qrCode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64 border-2 border-gray-200 rounded-xl p-2" />
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
            ) : (
              <div className="space-y-4 py-8">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <p className="text-gray-700 font-medium">Waiting for QR code...</p>
              </div>
            )}
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
            <button onClick={() => setStep('form')} className="gradient-btn px-6 py-2.5 text-sm mt-2">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
