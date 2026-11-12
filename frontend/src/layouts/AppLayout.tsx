import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageCircle, Bot, Radio, Workflow, BarChart3, Settings,
  LogOut, Menu, X, ShoppingCart, Megaphone, MessageSquare, Users, Calendar,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useSocketStore } from '../store/socket.store';
import { useSocket } from '../hooks/useSocket';
import { Avatar } from '../components/ui/index';
import NotificationBell from '../components/NotificationBell';
import { useNotificationStore } from '../store/notification.store';
import { UserRound, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

/** Menu sidebar, dikelompokkan dengan pemisah di antara grup. */
const navGroups = [
  [
    { to: '/inbox', icon: MessageCircle, label: 'Chat' },
    { to: '/contacts', icon: Users, label: 'Contacts' },
  ],
  [
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
    { to: '/broadcasts', icon: Megaphone, label: 'Broadcasts' },
    { to: '/schedule', icon: Calendar, label: 'Schedule' },
  ],
  [
    { to: '/ai-agents', icon: Bot, label: 'AI Agents' },
    { to: '/channels', icon: Radio, label: 'Connected Platforms' },
  ],
];

const navItems = navGroups.flat();

/** Label rail: tersembunyi saat sidebar ciut, muncul halus saat di-hover. */
const LABEL_CLS =
  "whitespace-nowrap text-sm font-medium opacity-0 -translate-x-2 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100";

/** Item rail: saat sidebar melebar (hover), item aktif jadi pill putih + kotak ikon biru. */
const railItemCls = (isActive: boolean) =>
  `relative flex h-10 w-full items-center rounded-lg transition-all duration-200 ${
    isActive
      ? "text-gray-900 group-hover:bg-white group-hover:shadow-sm"
      : "text-gray-500 hover:text-gray-900 group-hover:hover:bg-white/60"
  }`;

/** Kotak ikon: biru saat aktif, polos saat tidak aktif. */
const iconBoxCls = (isActive: boolean) =>
  `relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
    isActive ? "bg-primary text-white" : ""
  }`;

const headerNavItems = [
  { to: '/inbox', icon: MessageCircle, label: 'Chat' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/contacts', icon: Users, label: 'CRM' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing' },
  { to: '/automation', icon: Workflow, label: 'Automation' },
];

export default function AppLayout() {
  useSocket();
  const { user, logout } = useAuthStore();
  const { connected } = useSocketStore();
  const unreadChats = useNotificationStore(s => s.items.some(i => !i.read && i.type === 'NEW_MESSAGE'));
  const bindNotifications = useNotificationStore(s => s.bindUser);
  useEffect(() => { bindNotifications(user?.id ?? null); }, [user?.id, bindNotifications]);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const hasNotif = unreadChats;

  return (
    <div className="flex h-screen bg-primary/5">
      {/* ===== Desktop: icon rail, melebar saat hover (overlay, konten tidak bergeser) ===== */}
      <div className="relative z-30 hidden w-14 flex-shrink-0 lg:block">
        <aside className="group absolute inset-y-0 left-0 flex w-14 flex-col overflow-hidden py-3 transition-[width,background-color,box-shadow] duration-300 ease-in-out hover:w-52 hover:bg-gradient-to-b hover:from-[#eef2fb] hover:via-[#eef2fb] hover:to-[#e4e0f7] hover:shadow-xl">
          <NavLink to="/inbox" aria-label="malesin.AI" className="mb-4 flex h-10 items-center px-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
              <img src="/logoM.png" alt="malesin.AI" className="h-7 w-7 object-contain" />
            </span>
            <span className={LABEL_CLS + " ml-2 text-base font-bold text-gray-900"}>malesin.AI</span>
          </NavLink>

          <nav className="flex w-full flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 scrollbar-none">
            {navGroups.map((group, gi) => (
              <div key={gi} className="flex w-full flex-col gap-1">
                {gi > 0 && (
                  <div className="my-2 h-px w-full bg-gray-300/70 transition-colors duration-300 group-hover:bg-gray-300" />
                )}
                {group.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} aria-label={label} className={({ isActive }) => railItemCls(isActive)}>
                    {({ isActive }) => (
                      <>
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                          <span className={iconBoxCls(isActive)}>
                            <Icon className="h-[18px] w-[18px]" />
                            {to === "/inbox" && hasNotif && (
                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse-dot rounded-full bg-danger ring-2 ring-white" />
                            )}
                          </span>
                        </span>
                        <span className={LABEL_CLS + " ml-1 " + (isActive ? "font-semibold" : "")}>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Bawah: pengaturan + status koneksi */}
          <div className="flex w-full flex-col gap-1 px-2 pt-2">
            <NavLink to="/settings" aria-label="Settings" className={({ isActive }) => railItemCls(isActive)}>
              {({ isActive }) => (
                <>
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                    <span className={iconBoxCls(isActive)}>
                      <Settings className="h-[18px] w-[18px]" />
                    </span>
                  </span>
                  <span className={LABEL_CLS + " ml-1 " + (isActive ? "font-semibold" : "")}>Settings</span>
                </>
              )}
            </NavLink>
            <div className="flex h-8 items-center" title={connected ? "Connected" : "Disconnected"}>
              <span className="flex w-10 flex-shrink-0 justify-center">
                <span className={`h-2 w-2 rounded-full ${connected ? "animate-pulse-dot bg-success" : "bg-danger"}`} />
              </span>
              <span className={LABEL_CLS + " ml-1 text-xs text-gray-400"}>{connected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ===== Area kanan ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar bergaya tab */}
        <header className="z-10 flex h-12 flex-shrink-0 items-end justify-between gap-2 px-2 lg:px-0 lg:pr-3">
          <div className="flex min-w-0 items-end gap-1">
            <button
              className="mb-1.5 rounded-lg p-2 text-gray-500 transition-colors hover:text-gray-700 active:bg-white lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav className="scrollbar-none flex min-w-0 items-end gap-1 overflow-x-auto">
              {headerNavItems.map(({ to, icon: Icon, label }) => {
                // Menu CRM juga aktif di halaman Pipeline.
                const isActive = location.pathname.startsWith(to) || (to === '/contacts' && location.pathname.startsWith('/pipeline'));
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-4 text-sm transition ${
                      isActive
                        ? 'bg-white font-semibold text-primary'
                        : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="relative flex flex-shrink-0 items-center gap-1 pb-1.5">
            <NotificationBell />

            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition hover:bg-white"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="relative">
                <Avatar name={user?.name || 'User'} src={user?.avatar} size="sm" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    connected ? 'bg-success' : 'bg-gray-300'
                  }`}
                />
              </span>
              <span className="hidden text-sm font-semibold text-gray-700 sm:block">{user?.name}</span>
            </button>

            {profileOpen && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setProfileOpen(false)}
                  aria-label="Tutup menu profil"
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-2">
                    <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="truncate text-xs text-gray-400">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <UserRound className="h-4 w-4" />
                    Profil saya
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/profile?tab=password'); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <KeyRound className="h-4 w-4" />
                    Ubah password
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-red-50 hover:text-danger"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Konten */}
        <main className="flex-1 overflow-hidden bg-white">
          <Outlet />
        </main>
      </div>

      {/* ===== Mobile drawer ===== */}
      <div className={`fixed inset-0 z-50 transition-all duration-300 ease-in-out lg:hidden ${mobileOpen ? 'visible' : 'invisible'}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`absolute bottom-0 left-0 top-0 w-[260px] bg-white shadow-xl transition-transform duration-300 ease-in-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-gray-200 px-5">
            <div className="flex items-center gap-2">
              <img src="/logoM.png" alt="malesin.AI" className="h-8 w-8 object-contain" />
              <span className="text-lg font-bold text-gray-900">malesin.AI</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:text-gray-700 active:bg-gray-100"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="h-[calc(100%-3.5rem)] overflow-y-auto scrollbar-thin">
            <nav className="space-y-1 px-3 py-4">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{label}</span>
                  {to === '/inbox' && hasNotif && (
                    <span className="ml-auto h-2 w-2 animate-pulse-dot rounded-full bg-danger" />
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-gray-100 px-3 py-3">
              <NavLink
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </NavLink>
            </div>

            <div className="space-y-2 border-t border-gray-100 p-3">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse-dot bg-success' : 'bg-danger'}`} />
                <span className="text-xs text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
              </div>
              {user && (
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={user.name} src={user.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{user.name}</p>
                    <p className="truncate text-xs text-gray-400">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}