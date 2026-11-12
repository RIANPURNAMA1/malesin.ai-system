import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, UserPlus, CheckCircle2, Megaphone, Sparkles, CheckCheck, Trash2, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotificationStore, notificationLink, NotificationItem } from '../store/notification.store';

const TYPE_META: Record<NotificationItem['type'], { icon: typeof Bell; cls: string }> = {
  NEW_MESSAGE: { icon: MessageCircle, cls: 'bg-primary/10 text-primary' },
  ASSIGNED: { icon: UserPlus, cls: 'bg-emerald-50 text-emerald-600' },
  CLOSED: { icon: CheckCircle2, cls: 'bg-gray-100 text-gray-500' },
  BROADCAST_PAUSED: { icon: Megaphone, cls: 'bg-amber-50 text-amber-600' },
  DEAL_SUGGESTION: { icon: Sparkles, cls: 'bg-violet-50 text-violet-600' },
};

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Lonceng notifikasi di header: badge belum dibaca + panel daftar notifikasi. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { items, desktop, markRead, markAllRead, clear, setDesktop } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const unread = items.filter(i => !i.read).length;
  const list = onlyUnread ? items.filter(i => !i.read) : items;

  const openItem = (n: NotificationItem) => {
    markRead(n.id);
    setOpen(false);
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  const toggleDesktop = async () => {
    if (desktop) return setDesktop(false);
    if (!('Notification' in window)) return toast.error('Browser tidak mendukung notifikasi desktop');
    const perm = window.Notification.permission === 'granted' ? 'granted' : await window.Notification.requestPermission();
    if (perm !== 'granted') return toast.error('Izin notifikasi ditolak di browser');
    setDesktop(true);
    toast.success('Notifikasi desktop aktif');
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={`Notifikasi${unread ? ` (${unread} belum dibaca)` : ''}`} aria-expanded={open}
        className={`relative rounded-lg p-2 transition ${open ? 'bg-white text-gray-900' : 'text-gray-500 hover:bg-white hover:text-gray-900'}`}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Tutup notifikasi" />
          <div className="absolute right-0 top-full z-50 mt-1 flex max-h-[70vh] w-[360px] max-w-[calc(100vw-1rem)] flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">Notifikasi</p>
              <button onClick={markAllRead} disabled={!unread} className="flex items-center gap-1 text-xs text-primary hover:underline disabled:text-gray-300 disabled:no-underline">
                <CheckCheck className="h-3.5 w-3.5" />Tandai semua dibaca
              </button>
            </div>
            <div className="flex gap-1 px-4 pt-2">
              {[[false, `Semua ${items.length}`], [true, `Belum dibaca ${unread}`]].map(([v, label]) => (
                <button key={String(v)} onClick={() => setOnlyUnread(v as boolean)}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${onlyUnread === v ? 'bg-primary/10 font-medium text-primary' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {label as string}
                </button>
              ))}
            </div>

            <ul className="flex-1 overflow-y-auto py-1">
              {list.map(n => {
                const meta = TYPE_META[n.type] ?? TYPE_META.NEW_MESSAGE;
                return (
                  <li key={n.id}>
                    <button onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 ${n.read ? '' : 'bg-primary/[0.03]'}`}>
                      <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${meta.cls}`}><meta.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${n.read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                          {n.title}{n.count > 1 && <span className="ml-1 font-normal text-gray-400">· {n.count} pesan</span>}
                        </span>
                        <span className="block truncate text-xs text-gray-500">{n.body}</span>
                        <span className="text-[11px] text-gray-400">{ago(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                    </button>
                  </li>
                );
              })}
              {!list.length && (
                <li className="flex flex-col items-center py-10 text-center text-gray-400">
                  <Bell className="mb-2 h-8 w-8 opacity-40" />
                  <span className="text-xs">{onlyUnread ? 'Semua notifikasi sudah dibaca' : 'Belum ada notifikasi'}</span>
                </li>
              )}
            </ul>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
              <button onClick={toggleDesktop} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900">
                <BellRing className={`h-3.5 w-3.5 ${desktop ? 'text-primary' : ''}`} />
                Notifikasi desktop: <b className={desktop ? 'text-primary' : 'text-gray-400'}>{desktop ? 'Aktif' : 'Mati'}</b>
              </button>
              <button onClick={clear} disabled={!items.length} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" />Hapus semua
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
