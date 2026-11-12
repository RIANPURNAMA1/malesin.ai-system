import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, KanbanSquare, PlusCircle, UserPlus, FileText, Copy, MailOpen, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { conversationService } from '../../services/conversation.service';
import { crmApi } from '../../pages/crm/api';

interface Props {
  conversationId: string;
  contactId: string;
  phone: string;
  onOpenDetail: () => void;
}

const ITEM = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50';

/** Menu ⋮ di header chat: CRM, assign, transkrip, salin nomor, tandai belum dibaca. */
export default function ChatMenu({ conversationId, contactId, phone, onOpenDetail }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Deal kontak hanya dicek saat menu dibuka.
  const { data: deal, isLoading: dealLoading } = useQuery({
    queryKey: ['contact-deal', contactId],
    queryFn: () => crmApi.dealForContact(contactId),
    enabled: open,
  });

  const createDeal = useMutation({
    mutationFn: () => crmApi.createDeal({ contactId }),
    onSuccess: d => { toast.success('Deal dibuat di Pipeline'); navigate(`/pipeline?deal=${d.id}`); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message || 'Gagal membuat deal'),
  });
  const markUnread = useMutation({
    mutationFn: () => conversationService.markUnread(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Ditandai belum dibaca');
      navigate('/inbox'); // tutup chat supaya tidak langsung terbaca lagi
    },
    onError: () => toast.error('Gagal menandai belum dibaca'),
  });

  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  const copyPhone = () =>
    navigator.clipboard.writeText(phone).then(() => toast.success('Nomor disalin'), () => toast.error('Gagal menyalin'));

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Menu percakapan" aria-haspopup="menu" aria-expanded={open}
        className={`rounded-lg p-2 transition-colors ${open ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} aria-label="Tutup menu" />
          <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-60 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            {dealLoading ? (
              <div className={`${ITEM} text-gray-400`}><Loader2 className="h-4 w-4 animate-spin" />Memuat deal…</div>
            ) : deal ? (
              <button className={ITEM} onClick={run(() => navigate(`/pipeline?deal=${deal.id}`))}>
                <KanbanSquare className="h-4 w-4 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">Lihat di Pipeline</span>
                <span className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: deal.stage.color }}>{deal.stage.name}</span>
              </button>
            ) : (
              <button className={ITEM} disabled={createDeal.isPending} onClick={run(() => createDeal.mutate())}>
                <PlusCircle className="h-4 w-4 text-gray-400" />Buat deal di Pipeline
              </button>
            )}
            <button className={ITEM} onClick={run(onOpenDetail)}><UserPlus className="h-4 w-4 text-gray-400" />Assign ke agen</button>
            <button className={ITEM} onClick={run(() => navigate(`/conversations?open=${conversationId}`))}>
              <FileText className="h-4 w-4 text-gray-400" />Lihat transkrip lengkap
            </button>
            <button className={ITEM} disabled={!phone} onClick={run(copyPhone)}><Copy className="h-4 w-4 text-gray-400" />Salin nomor</button>
            <div className="my-1 border-t border-gray-100" />
            <button className={ITEM} disabled={markUnread.isPending} onClick={run(() => markUnread.mutate())}>
              <MailOpen className="h-4 w-4 text-gray-400" />Tandai belum dibaca
            </button>
          </div>
        </>
      )}
    </div>
  );
}
