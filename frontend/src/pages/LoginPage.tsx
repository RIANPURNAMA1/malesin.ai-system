import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Input, Button } from '../components/ui/index';
import {
  Eye, EyeOff, Zap, ShoppingBag, TrendingUp,
  Send, Megaphone, MessageCircle, BadgeCheck, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ---------- Ilustrasi kecil untuk panel kanan (dekoratif saja) ---------- */

const BARS = [28, 40, 34, 52, 46, 64, 58, 92];

function RevenueCard() {
  return (
    <div className="w-[176px] shrink-0 rounded-2xl bg-white p-3.5 shadow-[0_12px_32px_-8px_rgba(2,12,40,0.45)]">
      <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <TrendingUp className="h-3.5 w-3.5 text-primary" /> Omzet minggu ini
      </p>
      <p className="mt-1 text-[17px] font-bold tabular-nums text-gray-900">
        Rp48,2 jt <span className="align-middle text-[10px] font-semibold text-emerald-600">+32%</span>
      </p>
      <div className="mt-2.5 flex h-9 items-end gap-1">
        {BARS.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className={`flex-1 rounded-sm ${i === BARS.length - 1 ? 'bg-primary' : 'bg-primary/15'}`}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({ icon: Icon, tone, title, sub }: { icon: typeof Send; tone: string; title: string; sub: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 shadow-[0_8px_24px_-8px_rgba(2,12,40,0.5)] backdrop-blur">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4 text-white" />
      </span>
      <div className="leading-tight">
        <p className="text-[12px] font-semibold text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-500">{sub}</p>
      </div>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="grid grid-cols-[1.35fr_1fr] gap-4">
        {/* Kartu chat AI Agent */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_20px_48px_-12px_rgba(2,12,40,0.55)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logoM.png" alt="" className="h-5 w-5 object-contain" />
              <span className="text-[13px] font-semibold text-gray-900">AI Agent</span>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
            </span>
          </div>
          <div className="mb-2 inline-block rounded-2xl rounded-bl-md bg-gray-100 px-3 py-2 text-[12px] text-gray-700">
            Saya mau pesan 3 pcs ya
          </div>
          <div className="mb-3 flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[12px] leading-snug text-white">
              Siap! Total Rp267.000. Ini link pembayarannya.
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-gray-900">Pembayaran diterima</p>
              <p className="text-[11px] text-gray-500">Rp267.000 · Order #1042 lunas</p>
            </div>
          </div>
        </div>

        {/* Kartu profil pemilik toko */}
        <div className="relative flex flex-col justify-end overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-white/20 via-white/[0.07] to-white/[0.03] p-3">
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-white text-3xl font-bold text-primary shadow-lg ring-4 ring-white/20">
              R
            </div>
          </div>
          <div className="relative rounded-xl bg-black/25 px-3 py-2 backdrop-blur-sm">
            <p className="flex items-center gap-1 text-[12px] font-semibold text-white">
              Rani <BadgeCheck className="h-3.5 w-3.5 text-sky-300" />
            </p>
            <p className="text-[11px] text-white/70">Owner, Rani Boutique</p>
          </div>
        </div>
      </div>

      {/* Baris chip kanal, memudar di kedua sisi */}
      <div
        className="relative -mx-10 mt-4 overflow-hidden px-10"
        style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-3">
            <Chip icon={MessageCircle} tone="bg-emerald-500" title="Nadia" sub="Serum ini aman untuk ibu hamil?" />
            <div className="flex gap-3">
              <Chip icon={Send} tone="bg-sky-500" title="Telegram" sub="128 chat baru hari ini" />
              <Chip icon={Megaphone} tone="bg-pink-500" title="Instagram Ads" sub="1.240 klik hari ini" />
            </div>
          </div>
          <RevenueCard />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Halaman --------------------------------- */

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.email) errs.email = 'Email wajib diisi';
    if (!form.password) errs.password = 'Kata sandi wajib diisi';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      await login(form);
      navigate('/inbox');
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed');
    }
  };

  const handleGoogle = () => {
    // TODO: sambungkan ke alur login Google
    toast('Login Google belum tersedia');
  };

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Kiri - Form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-[440px]">
          {/* Logo */}
          <div className="mb-10 flex items-center justify-center gap-2">
            <img src="/logoM.png" alt="malesin.AI" className="h-9 w-9 object-contain" />
            <span className="text-2xl font-bold tracking-tight text-primary">malesin.AI</span>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900 sm:text-[30px]">
              Selamat datang kembali di malesin.AI
            </h1>
            <p className="mt-2.5 text-[15px] text-gray-500">Masuk ke akun Anda</p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white font-medium text-gray-800 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99]"
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Lanjutkan dengan Google
          </button>

          {/* Divider */}
          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm text-gray-400">Atau lanjutkan dengan email</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="Masukkan email Anda"
                value={form.email}
                onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))}
                error={errors.email}
                autoComplete="email"
                autoFocus
                className="!h-12 !rounded-xl"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Kata sandi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi Anda"
                  value={form.password}
                  onChange={(e: any) => setForm(f => ({ ...f, password: e.target.value }))}
                  error={errors.password}
                  autoComplete="current-password"
                  className="!h-12 !rounded-xl !pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-2 top-6 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
              <Link
                to="/forgot-password"
                className="mt-2.5 inline-block text-sm text-gray-600 underline underline-offset-2 transition-colors hover:text-primary"
              >
                Lupa kata sandi?
              </Link>
            </div>

            <Button
              type="submit"
              loading={isLoading}
              className="!h-12 w-full rounded-xl bg-primary font-semibold text-white shadow-[0_8px_20px_-8px_rgb(var(--color-primary-rgb,24_86_200)/0.7)] transition-all hover:bg-primary-dark active:scale-[0.99]"
            >
              Lanjutkan
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Belum punya akun? <span className="font-semibold text-gray-900">Hubungi admin workspace kamu.</span>
          </p>

          <p className="mx-auto mt-10 max-w-[420px] text-center text-xs leading-relaxed text-gray-400">
            Dengan masuk, Anda menyetujui{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-primary">Ketentuan Layanan</Link> dan{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">Kebijakan Privasi</Link>{' '}
            malesin.AI mengenai cara kami memproses data pribadi Anda.
          </p>
        </div>
      </div>

      {/* Kanan - Panel hero */}
      <div className="hidden w-1/2 items-center p-6 lg:flex xl:p-10">
        <div className="relative flex w-full flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-primary via-[#0f3a8c] to-[#071a45] px-10 pb-10 pt-12 shadow-2xl">
          {/* Dekorasi: grid halus + glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '36px 36px',
              maskImage: 'radial-gradient(ellipse at 50% 30%, #000 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, #000 30%, transparent 75%)',
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative z-10">
            <HeroMockup />
          </div>

          {/* Copy */}
          <div className="relative z-10 mt-12">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" /> AI Agent 24/7
            </span>
            <h2 className="text-[26px] font-bold leading-snug tracking-tight text-white">
              Kelola semua percakapan customer dalam satu platform
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/75">
              Hubungkan WhatsApp, Instagram, CRM, dan order dalam satu dashboard, dengan AI Agent
              yang melayani customer 24/7.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {[
                { icon: Zap, label: 'Setup 10 menit' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-white/35 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}