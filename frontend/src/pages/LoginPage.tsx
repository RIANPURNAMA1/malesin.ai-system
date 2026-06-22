import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Input, Button } from '../components/ui/index';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Welcome Back</h2>
        <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="Enter your email"
          value={form.email}
          onChange={(e: any) => setForm(f => ({ ...f, email: e.target.value }))}
          error={errors.email}
          icon={<Mail className="w-4 h-4" />}
          autoFocus
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={form.password}
            onChange={(e: any) => setForm(f => ({ ...f, password: e.target.value }))}
            error={errors.password}
            icon={<Lock className="w-4 h-4" />}
            className="!pr-10"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPassword ? 'Hide' : 'Show'}
            </button>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:text-primary-dark transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          loading={isLoading}
          className="w-full !py-2.5 mt-2"
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <Link
          to="/register"
          className="text-primary font-semibold hover:text-primary-dark transition-colors"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}