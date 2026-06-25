import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '../services/index';
import { Avatar, Badge, Spinner, Input } from '../components/ui/index';
import { Button } from '../components/ui/Button';
import { format } from 'date-fns';
import { Search, Users, Edit2, XCircle, Loader2, Smartphone, RefreshCw } from 'lucide-react';
import { useSocketStore } from '../store/socket.store';
import toast from 'react-hot-toast';
import type { Contact } from '../types';

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'WHATSAPP', label: 'WhatsApp Business' },
  { value: 'WHATSAPP_UNOFFICIAL', label: 'WhatsApp Unofficial' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'TIKTOK', label: 'TikTok' },
];

const SOURCE_COLORS: Record<string, string> = {
  WHATSAPP: '#22c55e',
  WHATSAPP_UNOFFICIAL: '#25D366',
  INSTAGRAM: '#e44d8c',
  FACEBOOK: '#1877f2',
  TIKTOK: '#000000',
};

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState('');
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncTotal, setSyncTotal] = useState(0);
  const socket = useSocketStore((s) => s.socket);
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    const onStart = () => { setSyncStatus('syncing'); setSyncTotal(0); };
    const onComplete = ({ total }: { total: number }) => { setSyncStatus('done'); setSyncTotal(total); qc.invalidateQueries({ queryKey: ['contacts'] }); };
    const onError = () => { setSyncStatus('error'); };
    socket.on('wa-unofficial:sync-start', onStart);
    socket.on('wa-unofficial:sync-complete', onComplete);
    socket.on('wa-unofficial:sync-error', onError);
    return () => {
      socket.off('wa-unofficial:sync-start', onStart);
      socket.off('wa-unofficial:sync-complete', onComplete);
      socket.off('wa-unofficial:sync-error', onError);
    };
  }, [socket, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, page, sourceFilter],
    queryFn: () => contactService.list({ search, page, limit: 20, sourceChannel: sourceFilter || undefined }),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Contact> }) => contactService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact updated');
      setEditContact(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update contact'),
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Contacts</h1>
              {syncStatus === 'syncing' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-3 py-1 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
                </span>
              )}
              {syncStatus === 'done' && (
                <span className="text-xs text-green-600 font-medium bg-green-100 px-3 py-1 rounded-full">
                  {syncTotal} contacts synced
                </span>
              )}
              {syncStatus === 'error' && (
                <span className="text-xs text-danger font-medium bg-red-100 px-3 py-1 rounded-full">
                  Sync failed
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {data?.pagination.total || 0} contacts total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
              className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20"
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                placeholder="Search contacts..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full sm:w-56 bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary" /></div>
        ) : !data?.data.length ? (
          <div className="glass-card p-16 text-center !transform-none">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No contacts found</p>
            <p className="text-sm text-gray-400 mt-1">Connect a channel to start receiving contacts</p>
          </div>
        ) : (
          <>
            <div className="glass-card overflow-hidden !transform-none !shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp ID</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">First Contact</th>
                      <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Messages</th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((contact) => (
                      <tr key={contact.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={contact.name} size="sm" />
                            <div>
                              <span className="font-medium text-gray-800 text-sm block leading-tight">{contact.name}</span>
                              {contact.email && <span className="text-xs text-gray-400">{contact.email}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600 font-mono">{contact.phone || '—'}</td>
                        <td className="px-5 py-3.5">
                          {contact.sourceChannel ? (
                            <Badge label={contact.sourceChannel.replace('_', ' ')} color={SOURCE_COLORS[contact.sourceChannel] || '#18a6fc'} />
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 font-mono">
                          {contact.metadata?.whatsappId ? (
                            <span className="text-xs truncate max-w-[180px] inline-block align-middle" title={contact.metadata.whatsappId}>
                              {contact.metadata.whatsappId}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{format(new Date(contact.firstContactDate), 'dd MMM yyyy')}</td>
                        <td className="px-5 py-3.5 text-sm text-center font-medium text-gray-700">{contact.totalMessages}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => setEditContact(contact)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: Math.min(data.pagination.totalPages, 10) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                      page === p ? 'gradient-btn !rounded-xl' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditContact(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="glass-modal w-full max-w-md max-h-[90vh] overflow-y-auto relative animate-slide-up bg-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Edit Contact</h3>
              <button onClick={() => setEditContact(null)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                updateMutation.mutate({ id: editContact.id, payload: { name: editContact.name, phone: editContact.phone, email: editContact.email } });
              }}
              className="px-6 py-5 space-y-5"
            >
              <Input
                label="Name"
                value={editContact.name}
                onChange={e => setEditContact({ ...editContact, name: e.target.value })}
                required
              />
              <Input
                label="Phone"
                value={editContact.phone || ''}
                onChange={e => setEditContact({ ...editContact, phone: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={editContact.email || ''}
                onChange={e => setEditContact({ ...editContact, email: e.target.value })}
              />
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditContact(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" loading={updateMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
