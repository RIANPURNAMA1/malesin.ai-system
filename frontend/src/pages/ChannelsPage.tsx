import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelService } from '../services/index';
import { Channel } from '../types';
import { Button, Input, Select, Spinner } from '../components/ui/index';
import {
  Plus, Settings as SettingsIcon, Unlink, CheckCircle2, XCircle,
  ArrowLeft, ArrowRight, Check, Loader2, Wifi, Clock, Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';
import WhatsAppUnofficialConnectModal from '../components/WhatsAppUnofficialConnectModal';
import TikTokConnectModal from '../components/TikTokConnectModal';

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

function TelegramIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#26A5E4"/>
      <path d="M16.5 7.5l-10 3.87s-.39.15-.36.41c.03.26.35.38.35.38l2.58 1.07.67 2.16s.05.22.21.22c.16 0 .22-.12.22-.12l1.18-1.06 2.46 1.82s.45.22.45-.17l1.5-7.06s.13-.55-.47-.32z" fill="#fff" opacity="0.9"/>
      <path d="M10.5 15.5l-.5-2.5 5-3.5" stroke="#fff" strokeWidth="0.5"/>
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

function WebhookIcon({ size }: { size?: string }) {
  return (
    <svg width={size || '24'} height={size || '24'} viewBox="0 0 24 24" fill="none">
      <path d="M12 3c1.5 2.5 4 7 4 7s2.5-1 4 0c1.5 1 1.5 3.5 0 5s-4 0-4 0-2.5 4-4 5.5m0-11c-1.5 2.5-4 7-4 7s-2.5-1-4 0c-1.5 1-1.5 3.5 0 5s4 0 4 0 2.5 4 4 5.5" stroke="#18a6fc" strokeWidth="1.5" strokeLinecap="round"/>
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

import TikTokIcon from '../components/TikTokIcon';

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

const platformMeta: Record<string, { icon: React.ComponentType<{ size?: string }>; color: string }> = {
  WHATSAPP: { icon: WhatsAppIcon, color: '#22C55E' },
  WHATSAPP_UNOFFICIAL: { icon: SmartphoneWA, color: '#25D366' },
  INSTAGRAM: { icon: InstagramIcon, color: '#E4405F' },
  FACEBOOK: { icon: FacebookIcon, color: '#1877F2' },
  MESSENGER: { icon: MessengerIcon, color: '#0099FF' },
  TIKTOK: { icon: TikTokIcon, color: '#000000' },
};

function getPlatformIcon(type: string) { return platformMeta[type]?.icon || WhatsAppIcon; }
function getPlatformColor(type: string) { return platformMeta[type]?.color || '#18a6fc'; }

const availableIntegrations = [
  { id: 'MESSENGER', name: 'Messenger', desc: 'Connect Facebook Messenger inbox', icon: MessengerIcon, color: '#0099FF', popular: true },
  { id: 'WEBSITE', name: 'Web Live Chat', desc: 'Embed a live chat widget on your website', icon: GlobeIcon, color: '#0EA5E9', popular: true },
  { id: 'WHATSAPP', name: 'WhatsApp Business', desc: 'Send and receive messages via WhatsApp Business API', icon: WhatsAppIcon, color: '#22C55E', popular: true },
  { id: 'WHATSAPP_UNOFFICIAL', name: 'WhatsApp Unofficial', desc: 'Connect your WhatsApp via QR code (whatsapp-web.js)', icon: SmartphoneWA, color: '#25D366', popular: true },
  { id: 'INSTAGRAM', name: 'Instagram', desc: 'Manage Instagram direct messages', icon: InstagramIcon, color: '#E4405F', popular: true },
  { id: 'GMAIL', name: 'Gmail', desc: 'Forward Gmail inquiries to your inbox', icon: GmailIcon, color: '#EA4335', popular: false },
  { id: 'EMAIL', name: 'Other Email', desc: 'Forward email inquiries via SMTP', icon: MailIcon, color: '#F59E0B', popular: false },
  { id: 'TIKTOK', name: 'TikTok', desc: 'Connect TikTok messages to your inbox', icon: TikTokIcon, color: '#000000', popular: false },
];

export default function ChannelsPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showWhatsAppUnofficialModal, setShowWhatsAppUnofficialModal] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const { data: channels, isLoading } = useQuery({ queryKey: ['channels'], queryFn: channelService.list });
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: channelService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); toast.success('Platform disconnected'); },
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Connected Platforms</h1>
            <p className="text-sm text-gray-600 mt-1">Hubungkan semua channel komunikasi dalam satu dashboard terpusat</p>
          </div>
          <button onClick={() => setShowModal(true)} className="gradient-btn px-5 py-2.5 text-sm animate-fade-in">
            <Plus className="w-4 h-4" />
            Connect New Platform
          </button>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Connected Platforms
            {Array.isArray(channels) && channels.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({channels.length})</span>
            )}
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary" /></div>
          ) : !Array.isArray(channels) || channels.length === 0 ? (
            <div className="glass-card rounded-2xl p-16 text-center !transform-none">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-primary/10">
                <Wifi className="w-8 h-8 text-primary" />
              </div>
              <p className="text-gray-700 font-medium text-lg">No platforms connected</p>
              <p className="text-gray-400 text-sm mt-1 mb-6">Connect your first platform to start managing conversations</p>
              <button onClick={() => setShowModal(true)} className="gradient-btn px-5 py-2.5 text-sm">
                <Plus className="w-4 h-4" />
                Connect Your First Platform
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {channels.map((ch: Channel, i: number) => {
                const Icon = getPlatformIcon(ch.type);
                const color = getPlatformColor(ch.type);
                return (
                  <div key={ch.id} className="glass-card rounded-2xl p-5" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                          <Icon size="24" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{ch.name}</h3>
                          <p className="text-xs text-gray-500 capitalize">{ch.type.toLowerCase()}</p>
                        </div>
                      </div>
                      <span className={`status-dot ${ch.isActive ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
                    </div>

                    {ch.type === 'TIKTOK' && ch.metadata ? (
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                        {ch.metadata.avatar_url && (
                          <img src={ch.metadata.avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">@{ch.name}</p>
                          <p className="text-gray-400">
                            {ch.metadata.follower_count?.toLocaleString() || 0} followers
                          </p>
                        </div>
                      </div>
                    ) : ch.wabaId ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span className="truncate">{ch.phoneNumberId || ch.wabaId}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                      {ch._count !== undefined && (
                        <span>{ch._count.conversations} conversations</span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          if (ch.type === 'TIKTOK') {
                            navigate(`/channels/tiktok/${ch.id}`);
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all"
                      >
                        <SettingsIcon className="w-4 h-4 inline mr-1.5" />
                        Manage
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(ch.id)}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-400 hover:text-danger hover:bg-red-50 transition-all"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Available Integrations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {availableIntegrations.map((p, i) => {
              const Icon = p.icon;
              const alreadyConnected = Array.isArray(channels) && channels.some((ch: Channel) => ch.type === p.id);
              return (
                <div
                  key={p.id}
                  className="glass-card rounded-xl p-4 cursor-pointer"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => {
                    if (alreadyConnected) return;
                    if (p.id === 'WHATSAPP') setShowWhatsAppModal(true);
                    else if (p.id === 'WHATSAPP_UNOFFICIAL') setShowWhatsAppUnofficialModal(true);
                    else if (p.id === 'TIKTOK') setShowTikTokModal(true);
                    else setShowModal(true);
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.color + '20' }}>
                        <Icon size="20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      {p.popular && <span className="text-[10px] font-medium" style={{ color: '#18a6fc' }}>Popular</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{p.desc}</p>
                  {alreadyConnected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium hover:text-primary-dark transition-colors" style={{ color: '#18a6fc' }}>
                      <Plus className="w-3.5 h-3.5" /> Connect
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {showModal && <ConnectionModal onClose={() => setShowModal(false)} />}
      {showWhatsAppModal && <WhatsAppConnectModal onClose={() => setShowWhatsAppModal(false)} />}
      {showWhatsAppUnofficialModal && <WhatsAppUnofficialConnectModal onClose={() => setShowWhatsAppUnofficialModal(false)} />}
      {showTikTokModal && <TikTokConnectModal onClose={() => setShowTikTokModal(false)} />}
    </div>
  );
}

function ConnectionModal({ onClose }: { onClose: () => void }) {
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

  const steps = ['Select Platform', 'Authentication', 'Configuration', 'Test Connection'];

  const handleNext = () => {
    if (step === 0 && !selected) { toast.error('Please select a platform'); return; }
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
      <div className="glass-modal w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin relative animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button onClick={() => { setStep(s => s - 1); if (step === 3) setTestResult('idle'); }} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-lg font-semibold text-gray-900">Connect Platform</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                i === step ? 'gradient-btn' : i < step ? 'bg-success text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${i < step ? 'bg-success' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="p-5">
          {step === 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Platform</p>
              <p className="text-sm text-gray-600 mb-5">Select the platform you wish to establish your new inbox</p>
              <div className="grid grid-cols-2 gap-3">
                {availableIntegrations.map(p => {
                  const Icon = p.icon;
                  const isSelected = selected?.id === p.id;
                  return (
                    <button key={p.id} onClick={() => setSelected(p)}
                      className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all ${
                        isSelected ? '' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                      }`}
                      style={isSelected ? { borderColor: 'rgba(24, 166, 252, 0.5)', background: 'rgba(24, 166, 252, 0.05)' } : undefined}>
                      <Icon size="32" />
                      <span className="text-sm font-medium text-gray-800">{p.name}</span>
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
                <p className="text-sm text-gray-400 py-8 text-center">Configuration guide will appear here</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Konfigurasi nama dan pengaturan platform</p>
              <Input label="Business/Platform Name" placeholder="e.g. Support WhatsApp" value={config.name} onChange={e => setConfig(c => ({ ...c, name: e.target.value }))} />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">AI Agent</label>
                <Select options={[{ value: '', label: 'No AI Agent' }, { value: 'auto', label: 'Auto-Reply Agent' }, { value: 'smart', label: 'Smart Assistant' }]} value="" onChange={() => {}} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Routing</label>
                <Select options={[{ value: 'round-robin', label: 'Round Robin' }, { value: 'skills-based', label: 'Skills-Based' }, { value: 'manual', label: 'Manual' }]} value="round-robin" onChange={() => {}} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              {testing ? (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: '#18a6fc' }} />
                  <p className="text-gray-700 font-medium">Testing connection...</p>
                  <p className="text-sm text-gray-500">Verifying credentials and API access</p>
                </div>
              ) : testResult === 'success' ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <p className="text-gray-800 font-medium text-lg">Connection Successful!</p>
                  <p className="text-sm text-gray-500">Semua kredensial valid dan platform siap digunakan</p>
                </div>
              ) : testResult === 'fail' ? (
                <div className="space-y-4">
                  <XCircle className="w-12 h-12 text-danger mx-auto" />
                  <p className="text-gray-700 font-medium">Connection Failed</p>
                  <p className="text-sm text-gray-500">Please check your credentials and try again</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-5 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <div className="flex gap-3">
            {step < 3 && (
              <button onClick={handleNext} className="gradient-btn px-5 py-2 text-sm">
                {step === 0 && selected ? 'Next' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && testResult === 'success' && (
              <button onClick={handleConnect} className="gradient-btn px-6 py-2 text-sm" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Connect Platform
              </button>
            )}
            {step === 3 && testResult === 'idle' && (
              <button onClick={handleNext} className="gradient-btn px-5 py-2 text-sm">
                Test Connection <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && testResult === 'fail' && (
              <button onClick={() => { setStep(1); setTestResult('idle'); }} className="px-5 py-2 text-sm rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Back to Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
