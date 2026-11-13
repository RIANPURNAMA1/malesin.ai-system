import { CrmTabs } from './PipelinePage';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactService } from '../services/index';
import { Avatar, Badge, Spinner, Input } from '../components/ui/index';
import { Button } from '../components/ui/Button';
import { format } from 'date-fns';
import { Search, Edit2, X, RefreshCw, ArrowLeft, ArrowRight, SlidersHorizontal } from 'lucide-react';
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

const COLUMNS = [
  { label: 'Contact', cls: 'text-left' },
  { label: 'Phone', cls: 'text-left' },
  { label: 'Source', cls: 'text-left' },
  { label: 'WhatsApp ID', cls: 'text-left' },
  { label: 'First Contact', cls: 'text-left' },
  { label: 'Messages', cls: 'text-center' },
  { label: 'Action', cls: 'text-right' },
];

const controlCls =
  'h-10 rounded-md border border-gray-200 bg-white text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

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

  const total = data?.pagination.total || 0;
  const totalPages = data?.pagination.totalPages || 0;
  const rows = data?.data ?? [];

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <CrmTabs />
          <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
          {syncStatus === 'syncing' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <RefreshCw className="h-3 w-3 animate-spin" /> Syncing...
            </span>
          )}
          {syncStatus === 'done' && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {syncTotal} contacts synced
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
              Sync failed
            </span>
          )}
        </div>
      </div>

      <div className="bg-white px-4 pb-5 sm:px-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 py-4">
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <select
              aria-label="Filter source"
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
              className={`${controlCls} pl-9 pr-8`}
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search contacts..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className={`${controlCls} w-full pl-9 pr-3 placeholder-gray-400`}
            />
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-gray-900">
                {COLUMNS.map(c => (
                  <th key={c.label} className={`px-3 py-2.5 font-semibold ${c.cls}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12"><Spinner className="mx-auto h-6 w-6 text-primary" /></td></tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-gray-700">
                    <p>No contacts found</p>
                    <p className="mt-1 text-xs text-gray-500">Connect a channel to start receiving contacts</p>
                  </td>
                </tr>
              ) : rows.map(contact => (
                <tr key={contact.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={contact.name} size="sm" />
                      <div className="min-w-0">
                        <span className="block font-medium leading-tight text-gray-900">{contact.name}</span>
                        {contact.email && <span className="text-xs text-gray-500">{contact.email}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-gray-700">{contact.phone || '—'}</td>
                  <td className="px-3 py-3">
                    {contact.sourceChannel ? (
                      <Badge label={contact.sourceChannel.replace('_', ' ')} color={SOURCE_COLORS[contact.sourceChannel] || '#0E3F96'} />
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {contact.metadata?.whatsappId ? (
                      <span className="inline-block max-w-[180px] truncate align-middle text-xs" title={contact.metadata.whatsappId}>
                        {contact.metadata.whatsappId}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">{format(new Date(contact.firstContactDate), 'dd MMM yyyy')}</td>
                  <td className="px-3 py-3 text-center tabular-nums text-gray-700">{contact.totalMessages}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => setEditContact(contact)}
                      aria-label={`Edit ${contact.name}`}
                      className="rounded-md p-2 text-gray-500 transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer paginasi */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span>Page</span>
            <span className="flex h-9 min-w-[48px] items-center justify-center rounded-md border border-gray-200 bg-white px-3 tabular-nums">{page}</span>
            <span>of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span>Per page: 20</span>
            <span>Total: {total.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Modal edit */}
      {editContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditContact(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Edit Contact</h3>
              <button onClick={() => setEditContact(null)} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                updateMutation.mutate({ id: editContact.id, payload: { name: editContact.name, phone: editContact.phone, email: editContact.email } });
              }}
              className="space-y-4 px-5 py-5"
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
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditContact(null)}
                  className="h-10 rounded-md border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
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