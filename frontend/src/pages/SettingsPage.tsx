import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService, labelService } from '../services/index';
import { Button, Input, Avatar, Badge, Select } from '../components/ui/index';
import { Plus, Trash2, Users, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';

const presetLabels = [
  { name: 'Prospect', color: '#f59e0b' },
  { name: 'Customer', color: '#10b981' },
  { name: 'VIP', color: '#8b5cf6' },
  { name: 'Closing', color: '#ef4444' },
];

const roleColors: Record<string, string> = { OWNER: '#18a6fc', ADMIN: '#0d8be0', AGENT: '#059669' };

export default function SettingsPage() {
  const [tab, setTab] = useState<'users' | 'labels'>('users');

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your workspace settings</p>
        </div>

        <div className="flex gap-1 glass-card rounded-xl p-1 w-fit !transform-none">
          {[
            { key: 'users', icon: Users, label: 'Team Members' },
            { key: 'labels', icon: Tag, label: 'Labels' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'gradient-btn !rounded-lg !text-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' ? <UsersTab /> : <LabelsTab />}
      </div>
    </div>
  );
}

function UsersTab() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT' });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: userService.list });
  const createMutation = useMutation({
    mutationFn: userService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setShowForm(false); setForm({ name: '', email: '', password: '', role: 'AGENT' }); },
  });
  const deleteMutation = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User removed'); },
  });

  const roleOptions = [
    { value: 'OWNER', label: 'Owner' }, { value: 'ADMIN', label: 'Admin' }, { value: 'AGENT', label: 'Agent' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{Array.isArray(users) ? users.length : 0} team members</p>
        {me?.role !== 'AGENT' && (
          <button onClick={() => setShowForm(o => !o)} className="gradient-btn px-4 py-2 text-sm">
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass-card p-5 !transform-none">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <Select label="Role" value={form.role} options={roleOptions} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} className="gradient-btn px-4 py-2 text-sm" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden !transform-none !shadow-none">
        {Array.isArray(users) && users.length > 0 ? users.map((u: any) => (
          <div key={u.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <Avatar name={u.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800">{u.name}</p>
                {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
              </div>
              <p className="text-xs text-gray-400">{u.email}</p>
            </div>
            <Badge label={u.role} color={roleColors[u.role] || '#6b7280'} />
            {me?.role !== 'AGENT' && u.id !== me?.id && (
              <button onClick={() => deleteMutation.mutate(u.id)}
                className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )) : null}
      </div>
    </div>
  );
}

function LabelsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', color: '#18a6fc' });
  const { data: labels } = useQuery({ queryKey: ['labels'], queryFn: labelService.list });
  const createMutation = useMutation({
    mutationFn: labelService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['labels'] }); toast.success('Label created'); setForm({ name: '', color: '#18a6fc' }); },
  });
  const deleteMutation = useMutation({
    mutationFn: labelService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['labels'] }); toast.success('Label deleted'); },
  });

  return (
    <div className="space-y-4">
      <div className="glass-card p-5 !transform-none">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Create Label</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <Input label="Label Name" placeholder="e.g. Prospect" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="flex-1 min-w-[160px]" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <input type="color" value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
          </div>
          <button onClick={() => createMutation.mutate(form)} className="gradient-btn px-4 py-2.5 text-sm" disabled={!form.name || createMutation.isPending}>
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          {presetLabels.map(p => (
            <button key={p.name} onClick={() => setForm(p)}
              className="text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded-full text-gray-500 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden !transform-none !shadow-none">
        {Array.isArray(labels) && labels.length > 0 ? labels.map((label: any) => (
          <div key={label.id} className="flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: label.color }} />
              <Badge label={label.name} color={label.color} />
            </div>
            <button onClick={() => deleteMutation.mutate(label.id)}
              className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )) : (
          <div className="text-center py-12 text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No labels yet — create one above</p>
          </div>
        )}
      </div>
    </div>
  );
}
