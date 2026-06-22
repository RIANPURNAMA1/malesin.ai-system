import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contactService } from '../services/index';
import { Avatar, Badge, Spinner } from '../components/ui/index';
import { format } from 'date-fns';
import { Search, Users } from 'lucide-react';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, page],
    queryFn: () => contactService.list({ search, page }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-600 mt-1">
              {data?.pagination.total || 0} contacts total
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="Search contacts..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full sm:w-64 bg-gray-100 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-primary" /></div>
        ) : !data?.data.length ? (
          <div className="glass-card p-16 text-center !transform-none">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No contacts found</p>
          </div>
        ) : (
          <>
            <div className="glass-card overflow-hidden !transform-none !shadow-none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">First Contact</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Messages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((contact) => (
                    <tr key={contact.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={contact.name} size="sm" />
                          <span className="font-medium text-gray-800 text-sm">{contact.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{contact.phone || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{contact.email || '—'}</td>
                      <td className="px-5 py-3.5">
                        {contact.sourceChannel ? (
                          <Badge label={contact.sourceChannel} color={contact.sourceChannel === 'WHATSAPP' ? '#22c55e' : '#18a6fc'} />
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">
                        {format(new Date(contact.firstContactDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-right font-medium text-gray-700">
                        {contact.totalMessages}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map(p => (
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
    </div>
  );
}
