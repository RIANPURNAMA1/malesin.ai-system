import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Input, Button } from '../components/ui/index';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Sign in</h2>
        <p className="text-sm text-gray-600 mt-1">Enter your credentials to continue</p>
      </div>
      <Input
        label="Email"
        type="email"
        placeholder="you@company.com"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        error={errors.email}
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        error={errors.password}
      />
      <Button type="submit" loading={isLoading} className="w-full gradient-btn !rounded-xl !text-sm">
        Sign In
      </Button>
      <p className="text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary font-medium hover:text-primary-dark transition-colors">
          Create one
        </Link>
      </p>
    </form>
  );
}
