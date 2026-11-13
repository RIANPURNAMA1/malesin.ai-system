import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelService, whatsappUnofficialService, aiAgentService, userService } from '../services/index';
import ChannelSettingsModal, { readChannelSettings, DISTRIBUTION_LABEL } from '../components/ChannelSettingsModal';
import { Channel } from '../types';
import { Input, Select, Spinner } from '../components/ui/index';
import {
  Plus, Search, Settings as SettingsIcon, Unlink, CheckCircle2, XCircle,
  ArrowLeft, ArrowRight, Check, Loader2, Wifi, RefreshCw, LogOut, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocketStore } from '../store/socket.store';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';
import WhatsAppUnofficialConnectModal from '../components/WhatsAppUnofficialConnectModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import TikTokConnectModal from '../components/TikTokConnectModal';
import TikTokIcon from '../components/TikTokIcon';

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function WhatsAppIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 2.04.61 3.93 1.66 5.51L2 22l4.57-1.62A9.95 9.95 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#25D366"/>
      <path d="M17.28 14.32c-.3.85-1.13 1.4-2.02 1.4-.52 0-1.05-.11-1.55-.34-.36-.17-.72-.38-1.06-.6-1.88-1.24-3.02-3.2-3.36-4.8-.1-.47-.08-.95.06-1.4.14-.46.38-.88.68-1.22.2-.22.28-.54.18-.83-.06-.18-.34-.82-.6-1.28-.28-.5-.7-.92-1.18-1.18-.48-.26-1-.4-1.52-.4-.32 0-.64.06-.94.18-.3.12-.58.29-.82.5A2.92 2.92 0 006 8.2c0 1.61.75 3.53 2.1 5.12 1.35 1.6 3.08 2.7 4.88 3.2.28.08.57.13.87.16.3.03.6.01.9-.04.3-.05.59-.15.87-.3.28-.15.53-.35.74-.58.34-.4.57-.88.65-1.4.06-.4-.14-.8-.5-.98-.36-.18-.78-.12-1.08.08-.2.14-.4.28-.6.4-.2.12-.42.22-.64.3l-.02.01z" fill="#fff"/>
    </svg>
  );
}

function InstagramIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#igGrad)"/>
      <circle cx="12" cy="12" r="5.5" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="17.5" cy="6.5" r="1.5" fill="#fff"/>
      <defs>
        <linearGradient id="igGrad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFDC80"/>
          <stop offset="0.25" stopColor="#F77737"/>
          <stop offset="0.5" stopColor="#E1306C"/>
          <stop offset="0.75" stopColor="#C13584"/>
          <stop offset="1" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function FacebookIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#1877F2"/>
      <path d="M15.5 8.5h-2.5v-1c0-.83.22-1 1-1H15V4h-2.5C10.57 4 9.5 5.07 9.5 7.5V8.5H7.5v2.5h2v9h3v-9h2.5l.5-2.5z" fill="#fff"/>
    </svg>
  );
}

function GlobeIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#0EA5E9" strokeWidth="1.5"/>
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="#0EA5E9" strokeWidth="1.5"/>
      <path d="M3 12h18" stroke="#0EA5E9" strokeWidth="1.5"/>
    </svg>
  );
}

function MailIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="#F59E0B" strokeWidth="1.5"/>
      <path d="M2 7l10 6 10-6" stroke="#F59E0B" strokeWidth="1.5"/>
    </svg>
  );
}

function MessengerIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="10" fill="#0099FF"/>
      <path d="M12 5c-3.87 0-7 2.8-7 6.25 0 1.88.89 3.57 2.33 4.73V19l2.6-1.44c.66.18 1.36.27 2.07.27 3.87 0 7-2.8 7-6.25S15.87 5 12 5z" fill="#fff"/>
      <path d="M9.5 11.5l-2 3 3.5-1.5 2 1.5 2-3-3.5 1.5-2-1.5z" fill="#0099FF"/>
    </svg>
  );
}

function GmailIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#fff"/>
      <path d="M2 6l10 6 10-6" stroke="#EA4335" strokeWidth="1.5"/>
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="#EA4335" strokeWidth="1.5"/>
    </svg>
  );
}

function SmartphoneWA({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="2" width="14" height="20" rx="3" stroke="#25D366" strokeWidth="1.5" fill="#e8f5e9"/>
      <rect x="7" y="4" width="10" height="14" rx="1" fill="#25D366" opacity="0.1"/>
      <circle cx="12" cy="18" r="1" fill="#25D366"/>
      <text x="12" y="13" textAnchor="middle" fontSize="8" fill="#25D366" fontWeight="bold">WA</text>
    </svg>
  );
}

const platformIcons: Record<string, React.ComponentType<{ size?: string }>> = {
  WHATSAPP: WhatsAppIcon,
  WHATSAPP_UNOFFICIAL: SmartphoneWA,
  INSTAGRAM: InstagramIcon,
  FACEBOOK: FacebookIcon,
  MESSENGER: MessengerIcon,
  TIKTOK: TikTokIcon,
};

function getPlatformIcon(type: string) {
  return platformIcons[type] || WhatsAppIcon;
}

function getWaSession(ch: Channel): { status?: string; phone?: string | null; jid?: string | null } | null {
  if (!ch.sessionData) return null;
  try { return JSON.parse(ch.sessionData); } catch { return null; }
}

const availableIntegrations = [
  { id: 'MESSENGER', name: 'Messenger', desc: 'Connect Facebook Messenger inbox', icon: MessengerIcon, popular: true },
  { id: 'WEBSITE', name: 'Web Live Chat', desc: 'Embed a live chat widget on your website', icon: GlobeIcon, popular: true },
  { id: 'WHATSAPP', name: 'WhatsApp Business', desc: 'Send and receive messages via WhatsApp Business API', icon: WhatsAppIcon, popular: true },
  { id: 'WHATSAPP_UNOFFICIAL', name: 'WhatsApp Unofficial', desc: 'Connect your WhatsApp via QR code (Baileys)', icon: SmartphoneWA, popular: true },
  { id: 'INSTAGRAM', name: 'Instagram', desc: 'Manage Instagram direct messages', icon: InstagramIcon, popular: true },
  { id: 'GMAIL', name: 'Gmail', desc: 'Forward Gmail inquiries to your inbox', icon: GmailIcon, popular: false },
  { id: 'EMAIL', name: 'Other Email', desc: 'Forward email inquiries via SMTP', icon: MailIcon, popular: false },
  { id: 'TIKTOK', name: 'TikTok', desc: 'Connect TikTok messages to your inbox', icon: TikTokIcon, popular: false },
];

function platformName(type: string) {
  return availableIntegrations.find(p => p.id === type)?.name ?? type.charAt(0) + type.slice(1).toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */

const ICON_BTN =
  'rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50';

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'success' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
        tone === 'success'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-gray-200 bg-white text-gray-700'
      }`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ChannelsPage() {
  const navigate = useNavigate();
  const socket = useSocketStore(s => s.socket);
  const qc = useQueryClient();
  const [platform, setPlatform] = useState<string>('ALL');
  const [mode, setMode] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showWhatsAppUnofficialModal, setShowWhatsAppUnofficialModal] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<Record<string, string>>({});
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);
  const [reconnectChannel, setReconnectChannel] = useState<{ id: string; name: string } | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<{ id: string; name: string } | null>(null);

  const { data: channels, isLoading } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });
  const { data: agentsData } = useQuery({ queryKey: ['ai-agents'], queryFn: aiAgentService.list });
  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: userService.list });
  const agentList = (Array.isArray(agentsData) ? agentsData : []) as { id: string; name: string }[];
  const userList = (Array.isArray(usersData) ? usersData : []) as { id: string; name: string }[];
  const channelList = (Array.isArray(channels) ? channels : []) as Channel[];

  // Real-time WA Unofficial status
  useEffect(() => {
    if (!socket) return;
    const handler = ({ channelId, status }: { channelId: string; status: string }) => {
      setDeviceStatus(prev => ({ ...prev, [channelId]: status }));
    };
    socket.on('wa-unofficial:status', handler);
    return () => { socket.off('wa-unofficial:status', handler); };
  }, [socket]);

  // Fetch status tiap WA Unofficial channel
  const waUnofficialChannels = useCallback(async () => {
    if (!Array.isArray(channels)) return;
    const statusMap: Record<string, string> = {};
    await Promise.all(
      channels.filter(ch => ch.type === 'WHATSAPP_UNOFFICIAL').map(async ch => {
        try {
          const res = await whatsappUnofficialService.status(ch.id);
          statusMap[ch.id] = res.status;
        } catch { statusMap[ch.id] = 'disconnected'; }
      })
    );
    setDeviceStatus(prev => ({ ...prev, ...statusMap }));
  }, [channels]);

  useEffect(() => {
    waUnofficialChannels();
    // Polling ringan sebagai fallback kalau event socket terlewat.
    const timer = setInterval(waUnofficialChannels, 15000);
    return () => clearInterval(timer);
  }, [waUnofficialChannels]);

  const deleteMutation = useMutation({
    mutationFn: channelService.delete,
    onSuccess: () => {
      // Chat & kontak ikut terhapus: segarkan semua daftar yang menampilkannya.
      ['channels', 'conversations', 'contacts', 'conv-manage', 'conv-stats'].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
      setDeleteChannel(null);
      toast.success('Perangkat beserta chat & kontaknya dihapus');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message || 'Gagal menghapus perangkat'),
  });

  const logoutMutation = useMutation({
    mutationFn: whatsappUnofficialService.logout,
    onSuccess: (_d, id) => {
      setDeviceStatus(prev => ({ ...prev, [id]: 'disconnected' }));
      toast.success('Perangkat logout. Klik "Hubungkan ulang" untuk scan QR lagi.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Logout failed'),
  });

  // Hitungan per platform untuk sidebar
  const platformCounts = useMemo(() => {
    const map = new Map<string, number>();
    channelList.forEach(ch => map.set(ch.type, (map.get(ch.type) ?? 0) + 1));
    return Array.from(map.entries());
  }, [channelList]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channelList.filter(ch => {
      if (platform !== 'ALL' && ch.type !== platform) return false;
      if (mode !== 'ALL' && mode !== 'BASIC') return false; // saat ini semua kanal bermode "Dasar"
      if (q && !`${ch.name} ${platformName(ch.type)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [channelList, platform, mode, search]);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kanal</h1>
          <p className="text-sm text-gray-500">Hubungkan sumber data untuk mendukung dasbor pelanggan Anda</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:w-60"
          >
            <option value="ALL">Semua mode</option>
            <option value="BASIC">Dasar</option>
          </select>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari kanal"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <button onClick={() => setShowModal(true)} className="gradient-btn h-11 flex-shrink-0 px-5 text-sm">
            <Plus className="h-4 w-4" />
            Tambah kanal
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar platform */}
        <aside className="hidden w-[250px] flex-shrink-0 overflow-y-auto border-r border-gray-200 p-3 md:block">
          <button
            onClick={() => setPlatform('ALL')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
              platform === 'ALL' ? 'bg-primary/10 font-semibold text-primary' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Semua platform
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-700">{channelList.length}</span>
          </button>
          <div className="mt-1 space-y-1">
            {platformCounts.map(([type, count]) => {
              const Icon = getPlatformIcon(type);
              const active = platform === type;
              return (
                <button
                  key={type}
                  onClick={() => setPlatform(type)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    active ? 'bg-primary/10 font-semibold text-primary' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size="22" />
                  <span className="flex-1 truncate">{platformName(type)}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Daftar kanal */}
        <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin bg-gray-50/40 p-4">
          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-primary" /></div>
          ) : channelList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Wifi className="h-6 w-6 text-primary" />
              </div>
              <p className="text-lg font-semibold text-gray-900">Belum ada kanal</p>
              <p className="mb-6 mt-1 text-sm text-gray-500">Tambahkan kanal pertama Anda untuk mulai mengelola percakapan</p>
              <button onClick={() => setShowModal(true)} className="gradient-btn px-5 py-2.5 text-sm">
                <Plus className="h-4 w-4" />
                Tambah kanal
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
              Tidak ada kanal yang cocok dengan filter atau pencarian Anda.
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map(ch => {
                const Icon = getPlatformIcon(ch.type);
                const waSession = getWaSession(ch);
                const waStatus = deviceStatus[ch.id] || waSession?.status;
                const isOn = ch.type === 'WHATSAPP_UNOFFICIAL' ? waStatus === 'connected' : ch.isActive;

                const subtitle =
                  ch.type === 'WHATSAPP_UNOFFICIAL' ? waSession?.phone
                  : ch.type === 'TIKTOK' ? `${ch.metadata?.follower_count?.toLocaleString() || 0} followers`
                  : ch.phoneNumberId || ch.wabaId || null;

                const st = readChannelSettings(ch);
                const aiName = st.aiValue === 'off' ? 'Nonaktif'
                  : st.aiValue ? (agentList.find(a => a.id === st.aiValue)?.name ?? 'Agent dihapus')
                  : 'Otomatis';
                const agentNames = st.agentIds.map(id => userList.find(u => u.id === id)?.name).filter(Boolean);

                return (
                  <div key={ch.id} className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                          {ch.type === 'TIKTOK' && ch.metadata?.avatar_url ? (
                            <img src={ch.metadata.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <Icon size="24" />
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${isOn ? 'bg-success' : 'bg-gray-300'}`}
                            title={isOn ? 'Terhubung' : 'Terputus'}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-gray-900">{ch.name}</h3>
                          <p className="truncate text-xs text-gray-500">
                            {platformName(ch.type)}
                            {subtitle ? <> <span className="mx-1 text-gray-300">|</span> {subtitle}</> : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2">
                        {ch.type === 'WHATSAPP_UNOFFICIAL' ? (
                          <>
                            <button
                              onClick={() => setReconnectChannel({ id: ch.id, name: ch.name })}
                              className={ICON_BTN}
                              title="Hubungkan ulang"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => logoutMutation.mutate(ch.id)}
                              disabled={logoutMutation.isPending}
                              className={`${ICON_BTN} hover:text-orange-600`}
                              title="Logout"
                            >
                              <LogOut className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteChannel({ id: ch.id, name: ch.name })}
                              className={`${ICON_BTN} hover:text-danger`}
                              title="Hapus perangkat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {ch.type === 'TIKTOK' && (
                              <button
                                onClick={() => navigate(`/channels/tiktok/${ch.id}`)}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                              >
                                Kelola
                              </button>
                            )}
                            <button
                              onClick={() => deleteMutation.mutate(ch.id)}
                              className={`${ICON_BTN} hover:text-danger`}
                              title="Putuskan"
                            >
                              <Unlink className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSettingsChannel(ch)}
                          className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-semibold text-primary transition hover:text-primary-dark"
                        >
                          <SettingsIcon className="h-4 w-4" />
                          Pengaturan kanal
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Chip>Mode: Dasar</Chip>
                      <Chip>AI Agent: {aiName}</Chip>
                      <Chip>Agen: {agentNames.length ? agentNames.join(', ') : 'Belum diatur'}</Chip>
                      <Chip tone="success">Distribusi chat: {DISTRIBUTION_LABEL[st.distribution]}</Chip>
                      <Chip>Maks. percakapan: {st.maxPerAgent || 'Belum diatur'}</Chip>
                      <Chip>Agen pilihan: {st.preferredAgent ? 'Aktif' : 'Belum diatur'}</Chip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <ConnectionModal
          onClose={() => setShowModal(false)}
          onSelectSpecial={id => {
            if (id === 'WHATSAPP') setShowWhatsAppModal(true);
            else if (id === 'WHATSAPP_UNOFFICIAL') setShowWhatsAppUnofficialModal(true);
            else if (id === 'TIKTOK') setShowTikTokModal(true);
          }}
        />
      )}
      {showWhatsAppModal && <WhatsAppConnectModal onClose={() => setShowWhatsAppModal(false)} />}
      {showWhatsAppUnofficialModal && <WhatsAppUnofficialConnectModal onClose={() => setShowWhatsAppUnofficialModal(false)} />}
      <ConfirmDialog
        open={!!deleteChannel}
        title={`Hapus perangkat "${deleteChannel?.name ?? ''}"?`}
        description="Data berikut akan dihapus permanen dan tidak bisa dikembalikan:"
        items={[
          'Semua chat & pesan dari perangkat ini',
          'Kontak yang hanya chat lewat perangkat ini, beserta deal di Pipeline',
          'Sesi login WhatsApp di perangkat ini',
        ]}
        note="Kontak yang juga pernah chat lewat kanal lain tetap disimpan."
        confirmText={deleteChannel?.name}
        confirmLabel="Hapus permanen"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteChannel && deleteMutation.mutate(deleteChannel.id)}
        onClose={() => setDeleteChannel(null)}
      />
      {reconnectChannel && (
        <WhatsAppUnofficialConnectModal
          reconnect={reconnectChannel}
          onClose={() => { setReconnectChannel(null); waUnofficialChannels(); }}
        />
      )}
      {showTikTokModal && <TikTokConnectModal onClose={() => setShowTikTokModal(false)} />}
      {settingsChannel && <ChannelSettingsModal channel={settingsChannel} onClose={() => setSettingsChannel(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tambah kanal (wizard)                                               */
/* ------------------------------------------------------------------ */

const SPECIAL_PLATFORMS = ['WHATSAPP', 'WHATSAPP_UNOFFICIAL', 'TIKTOK'];

function ConnectionModal({
  onClose,
  onSelectSpecial,
}: {
  onClose: () => void;
  onSelectSpecial: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<typeof availableIntegrations[0] | null>(null);
  const [config, setConfig] = useState({ name: '', wabaId: '', phoneNumberId: '', accessToken: '', verifyToken: '' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: typeof config) => channelService.create({ ...data, type: selected?.id } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] });
      toast.success(`Successfully connected ${selected?.name}!`);
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to connect'),
  });

  const steps = ['Pilih platform', 'Autentikasi', 'Konfigurasi', 'Uji koneksi'];

  const handleNext = () => {
    if (step === 0 && !selected) { toast.error('Please select a platform'); return; }
    // Platform dengan alur khusus langsung membuka modalnya sendiri
    if (step === 0 && selected && SPECIAL_PLATFORMS.includes(selected.id)) {
      onClose();
      onSelectSpecial(selected.id);
      return;
    }
    if (step === 1 && selected?.id === 'WHATSAPP' && !config.accessToken) { toast.error('Access token is required'); return; }
    if (step === 2 && !config.name) { toast.error('Platform name is required'); return; }
    if (step === 3) {
      setTesting(true);
      setTimeout(() => { setTesting(false); setTestResult('success'); }, 1500);
      return;
    }
    setStep(s => Math.min(s + 1, 3));
  };

  const handleConnect = () => mutation.mutate(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl scrollbar-thin animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => { setStep(s => s - 1); if (step === 3) setTestResult('idle'); }}
                className="text-gray-800 transition hover:text-primary"
                aria-label="Kembali"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h3 className="text-lg font-bold text-gray-900">Tambah kanal</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 transition hover:text-gray-700" aria-label="Tutup">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-2 last:flex-none">
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                    i === step ? 'bg-primary text-white' : i < step ? 'bg-success text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${i < step ? 'bg-success' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-gray-500">{steps[step]}</p>
        </div>

        {/* Isi */}
        <div className="p-6">
          {step === 0 && (
            <div>
              <h4 className="text-base font-semibold text-gray-900">Pilih platform</h4>
              <p className="mb-5 mt-1 text-sm text-gray-500">Pilih platform untuk inbox baru Anda</p>
              <div className="grid grid-cols-2 gap-3">
                {availableIntegrations.map(p => {
                  const Icon = p.icon;
                  const isSelected = selected?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className={`flex flex-col items-center gap-2.5 rounded-xl border p-4 transition ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                        <Icon size="26" />
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-800'}`}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && selected && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Masukkan kredensial autentikasi untuk {selected.name}</p>
              {selected.id === 'WHATSAPP' && (
                <>
                  <Input label="WABA ID" placeholder="123456789012345" value={config.wabaId} onChange={e => setConfig(c => ({ ...c, wabaId: e.target.value }))} />
                  <Input label="Phone Number ID" placeholder="Phone Number ID from Meta" value={config.phoneNumberId} onChange={e => setConfig(c => ({ ...c, phoneNumberId: e.target.value }))} />
                  <Input label="Verify Token" placeholder="Webhook verification token" value={config.verifyToken} onChange={e => setConfig(c => ({ ...c, verifyToken: e.target.value }))} />
                  <Input label="Access Token" placeholder="EAAxxxxx..." type="password" value={config.accessToken} onChange={e => setConfig(c => ({ ...c, accessToken: e.target.value }))} />
                </>
              )}
              {selected.id === 'INSTAGRAM' && <Input label="Instagram Access Token" placeholder="IG Access Token" type="password" />}
              {selected.id === 'FACEBOOK' && <Input label="Facebook Page Access Token" placeholder="FB Page Token" type="password" />}
              {!['WHATSAPP', 'INSTAGRAM', 'FACEBOOK'].includes(selected.id) && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center text-sm text-gray-500">
                  Panduan konfigurasi akan muncul di sini
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Konfigurasi nama dan pengaturan platform</p>
              <Input label="Business/Platform Name" placeholder="e.g. Support WhatsApp" value={config.name} onChange={e => setConfig(c => ({ ...c, name: e.target.value }))} />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">AI Agent</label>
                <Select options={[{ value: '', label: 'No AI Agent' }, { value: 'auto', label: 'Auto-Reply Agent' }, { value: 'smart', label: 'Smart Assistant' }]} value="" onChange={() => {}} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-900">Routing</label>
                <Select options={[{ value: 'round-robin', label: 'Round Robin' }, { value: 'skills-based', label: 'Skills-Based' }, { value: 'manual', label: 'Manual' }]} value="round-robin" onChange={() => {}} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-8 text-center">
              {testing ? (
                <div className="space-y-4">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                  <p className="font-semibold text-gray-900">Menguji koneksi...</p>
                  <p className="text-sm text-gray-500">Memverifikasi kredensial dan akses API</p>
                </div>
              ) : testResult === 'success' ? (
                <div className="animate-fade-in space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Koneksi berhasil</p>
                  <p className="text-sm text-gray-500">Semua kredensial valid dan platform siap digunakan</p>
                </div>
              ) : testResult === 'fail' ? (
                <div className="space-y-4">
                  <XCircle className="mx-auto h-12 w-12 text-danger" />
                  <p className="font-semibold text-gray-900">Koneksi gagal</p>
                  <p className="text-sm text-gray-500">Periksa kredensial Anda lalu coba lagi</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Batal
          </button>
          <div className="flex gap-3">
            {step < 3 && (
              <button onClick={handleNext} className="gradient-btn px-5 py-2.5 text-sm">
                {step === 0 && selected ? 'Lanjut' : 'Lanjutkan'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 3 && testResult === 'success' && (
              <button onClick={handleConnect} className="gradient-btn px-6 py-2.5 text-sm disabled:opacity-50" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Tambah kanal
              </button>
            )}
            {step === 3 && testResult === 'idle' && (
              <button onClick={handleNext} className="gradient-btn px-5 py-2.5 text-sm">
                Uji koneksi <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {step === 3 && testResult === 'fail' && (
              <button
                onClick={() => { setStep(1); setTestResult('idle'); }}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Kembali ke pengaturan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}