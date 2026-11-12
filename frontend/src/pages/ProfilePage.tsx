import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Eye, EyeOff, UserRound, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { Avatar } from '../components/ui/index';

const INPUT = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20';
const ROLE_LABEL: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', AGENT: 'Agent' };
const TABS = [
  { id: 'profile', label: 'Profil', icon: UserRound },
  { id: 'password', label: 'Ubah password', icon: KeyRound },
] as const;
type TabId = (typeof TABS)[number]['id'];
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Terjadi kesalahan';

/** Halaman Profil saya: ubah nama & email, dan ganti password. */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'password' ? 'password' : 'profile';
  const { user, setUser, setTokens } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);

  // Sinkron bila data user selesai dimuat setelah halaman dibuka.
  useEffect(() => { if (user) { setName(user.name); setEmail(user.email); } }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = useMutation({
    mutationFn: () => authService.updateProfile({ name: name.trim(), email: email.trim() }),
    onSuccess: u => { setUser({ ...user!, ...u }); toast.success('Profil diperbarui'); },
    onError: e => toast.error(errMsg(e)),
  });

  const savePassword = useMutation({
    mutationFn: () => authService.changePassword({ currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: t => {
      setTokens(t.accessToken, t.refreshToken);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password diubah. Sesi di perangkat lain telah keluar.');
    },
    onError: e => toast.error(errMsg(e)),
  });

  if (!user) return null;
  const profileDirty = name.trim() !== user.name || email.trim().toLowerCase() !== user.email.toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwError =
    pw.next && pw.next.length < 8 ? 'Minimal 8 karakter'
      : pw.confirm && pw.next !== pw.confirm ? 'Konfirmasi password tidak sama'
        : pw.next && pw.next === pw.current ? 'Harus berbeda dari password saat ini' : '';
  const pwReady = pw.current && pw.next && pw.confirm && !pwError;

  const pwInput = (k: keyof typeof pw, label: string) => (
    <label className="block text-xs font-medium text-gray-600">{label}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={pw[k]}
          onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))}
          autoComplete={k === 'current' ? 'current-password' : 'new-password'}
          className={`${INPUT} pr-10`}
        />
        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-2xl space-y-5 p-4 lg:p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" />Kembali
        </button>

        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
          <Avatar name={user.name} src={user.avatar} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900">{user.name}</h1>
            <p className="truncate text-sm text-gray-500">{user.email}</p>
            <p className="mt-0.5 text-xs text-gray-400">{ROLE_LABEL[user.role] ?? user.role}{user.company?.name ? ` · ${user.company.name}` : ''}</p>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setParams(id === 'profile' ? {} : { tab: id }, { replace: true })}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          {tab === 'profile' ? (
            <form onSubmit={e => { e.preventDefault(); saveProfile.mutate(); }}>
              <div className="space-y-4 p-5">
                <label className="block text-xs font-medium text-gray-600">Nama
                  <input value={name} onChange={e => setName(e.target.value)} maxLength={100} className={INPUT} />
                </label>
                <label className="block text-xs font-medium text-gray-600">Email
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
                  {email && !emailValid && <span className="mt-1 block text-[11px] text-red-500">Format email tidak valid</span>}
                  <span className="mt-1 block text-[11px] font-normal text-gray-400">Email ini dipakai untuk login.</span>
                </label>
                <div className="text-xs font-medium text-gray-600">Role akses
                  <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-sm font-normal text-gray-700">{ROLE_LABEL[user.role] ?? user.role}</p>
                  <span className="mt-1 block text-[11px] font-normal text-gray-400">Role diatur oleh Owner/Admin di menu Settings.</span>
                </div>
              </div>
              <div className="flex justify-end border-t border-gray-200 px-5 py-3">
                <button type="submit" disabled={!profileDirty || !name.trim() || !emailValid || saveProfile.isPending}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {saveProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Simpan perubahan
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (pwReady) savePassword.mutate(); }}>
              <div className="space-y-4 p-5">
                {pwInput('current', 'Password saat ini')}
                {pwInput('next', 'Password baru')}
                {pwInput('confirm', 'Ulangi password baru')}
                {pwError ? <p className="text-xs text-red-500">{pwError}</p>
                  : <p className="text-xs text-gray-400">Minimal 8 karakter. Setelah diubah, sesi di perangkat lain otomatis keluar.</p>}
              </div>
              <div className="flex justify-end border-t border-gray-200 px-5 py-3">
                <button type="submit" disabled={!pwReady || savePassword.isPending}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {savePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Ubah password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
