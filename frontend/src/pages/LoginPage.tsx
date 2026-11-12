import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Input, Button } from '../components/ui/index';
import { Eye, EyeOff, Zap, CalendarCheck, Headset, ShoppingBag, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

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
    <div className="min-h-screen flex w-full bg-white">
      {/* Left - Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <img src="/logoM.png" alt="malesin.AI" className="h-9 w-9 object-contain" />
            <span className="font-bold text-2xl text-primary">malesin.AI</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Selamat datang kembali di malesin.AI</h1>
            <p className="text-gray-500 mt-3">Masuk ke akun Anda</p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" />
            </svg>
            Lanjutkan dengan Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400">Atau lanjutkan dengan email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="Masukkan email Anda"
                value={form.email}
                onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))}
                error={errors.email}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Kata sandi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi Anda"
                  value={form.password}
                  onChange={(e: any) => setForm(f => ({ ...f, password: e.target.value }))}
                  error={errors.password}
                  className="!pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Link
                to="/forgot-password"
                className="inline-block mt-2 text-sm text-gray-500 underline hover:text-primary transition-colors"
              >
                Lupa kata sandi?
              </Link>
            </div>

            <Button
              type="submit"
              loading={isLoading}
              className="w-full !py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-all"
            >
              Lanjutkan
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Belum punya akun? Hubungi admin workspace kamu.
          </p>

          <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
            Dengan masuk, Anda menyetujui{' '}
            <Link to="/terms" className="underline hover:text-primary">Ketentuan Layanan</Link> dan{' '}
            <Link to="/privacy" className="underline hover:text-primary">Kebijakan Privasi</Link>{' '}
            malesin.AI mengenai cara kami memproses data pribadi Anda.
          </p>
        </div>
      </div>

      {/* Right - Hero panel (rounded card) */}
      <div className="hidden lg:flex w-1/2 p-6">
        <div className="relative w-full rounded-3xl bg-primary overflow-hidden flex flex-col justify-between p-10">
          {/* decorative glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 -left-16 w-72 h-72 rounded-full bg-white/5 blur-3xl" />

          {/* Mockup */}
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-md space-y-3">
              <div className="bg-white rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <img src="/logoM.png" alt="" className="h-5 w-5 object-contain" />
                  <span className="text-sm font-semibold text-gray-900">AI Agent</span>
                </div>
                <div className="inline-block bg-gray-100 text-gray-700 text-xs rounded-xl px-3 py-2 mb-2">
                  Saya mau pesan 3 pcs ya
                </div>
                <div className="flex justify-end mb-3">
                  <div className="bg-primary text-white text-xs rounded-xl px-3 py-2 max-w-[75%]">
                    Siap! Total Rp267.000. Ini link pembayarannya.
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Pembayaran diterima</p>
                    <p className="text-[11px] text-gray-500">Rp267.000 · Order #1042 lunas</p>
                  </div>
                </div>
              </div>

              <div className="flex items-stretch gap-3">
                <div className="flex-1 bg-white/95 rounded-2xl p-3 shadow-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">N</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900">Nadia</p>
                    <p className="text-[11px] text-gray-500 truncate">Serum ini aman untuk ibu hamil?</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-lg">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <TrendingUp className="w-3 h-3" /> Omzet minggu ini
                  </div>
                  <p className="text-sm font-bold text-gray-900 mt-1">
                    Rp48,2 jt <span className="text-[11px] font-medium text-green-600">+32%</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="relative z-10 mt-8">
            <h2 className="text-2xl font-bold text-white leading-snug">
              Kelola semua percakapan customer dalam satu platform
            </h2>
            <p className="text-sm text-white/80 mt-3 max-w-lg">
              Hubungkan WhatsApp, Instagram, CRM, dan order dalam satu dashboard, dengan AI Agent
              yang melayani customer 24/7.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              {[
                { icon: Zap, label: 'Setup 10 menit' },
                { icon: CalendarCheck, label: 'Uji coba gratis 14 hari' },
                { icon: Headset, label: 'Konsultasi 1-on-1' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/40 text-white text-sm font-medium"
                >
                  <Icon className="w-4 h-4" />
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