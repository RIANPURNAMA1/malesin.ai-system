import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Input, Button } from '../components/ui/index';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '', companyEmail: '', name: '', email: '', password: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(form);
      navigate('/inbox');
      toast.success('Account created!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Create workspace</h2>
        <p className="text-sm text-gray-600 mt-1">Get started with OmniDesk</p>
      </div>
      <Input label="Company Name" placeholder="Acme Corp" value={form.companyName} onChange={set('companyName')} required />
      <Input label="Company Email" type="email" placeholder="hello@acme.com" value={form.companyEmail} onChange={set('companyEmail')} required />
      <div className="border-t border-gray-200 pt-5">
        <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wide">Owner Account</p>
        <div className="space-y-4">
          <Input label="Your Name" placeholder="John Doe" value={form.name} onChange={set('name')} required />
          <Input label="Email" type="email" placeholder="john@acme.com" value={form.email} onChange={set('email')} required />
          <Input label="Password" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required minLength={8} />
        </div>
      </div>
      <Button type="submit" loading={isLoading} className="w-full gradient-btn !rounded-xl !text-sm">
        Create Workspace
      </Button>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-medium hover:text-primary-dark transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}
