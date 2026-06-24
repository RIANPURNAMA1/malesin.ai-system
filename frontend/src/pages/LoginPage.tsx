import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Input, Button } from '../components/ui/index';
import { Eye, EyeOff } from 'lucide-react';
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
    if (!form.email) errs.email = 'Email required';
    if (!form.password) errs.password = 'Password required';
    if (Object.keys(errs).length) return setErrors(errs);

    try {
      await login(form);
      navigate('/inbox');
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white">
      {/* Left - Hero */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-center px-16 py-12 bg-primary"
      >
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
              <img src="/logoM.png" alt="malesin.AI" className="h-6 w-6 object-contain" />
            </div>
            <span className="text-xl font-bold text-white">malesin.AI</span>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-6">
            Kelola Semua Percakapan Customer dalam Satu Platform
          </h1>

          <ul className="space-y-4">
            {[
              'Integrasi WhatsApp, Instagram, dan berbagai channel',
              'AI Agent otomatis 24/7 untuk customer service',
              'CRM dan manajemen order dalam satu dashboard',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-white/80 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-12 flex items-center gap-4 text-white/60 text-xs">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-white/20 flex items-center justify-center text-[10px] font-bold text-white/80">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span>Dipercaya 3.000+ bisnis di Indonesia</span>
          </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-2 mb-10">
            <img src="/logoM.png" alt="malesin.AI" className="h-8 w-8 object-contain" />
            <span className="font-bold text-lg text-gray-900">malesin.AI</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Login to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email}
              autoFocus
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e: any) => setForm(f => ({ ...f, password: e.target.value }))}
                  error={errors.password}
                  className="!pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={isLoading}
              className="w-full !py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-xl transition-all"
            >
              Log in
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-gray-900 font-semibold hover:text-primary transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
