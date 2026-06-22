import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageCircle, Bot, Radio, Workflow, BarChart3, Settings,
  LogOut, Menu, ShoppingCart, Megaphone, Ticket, Phone, MessageSquare, Users, Calendar
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useSocketStore } from '../store/socket.store';
import { useSocket } from '../hooks/useSocket';
import { Avatar } from '../components/ui/index';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/inbox', icon: MessageCircle, label: 'Chat' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/calls', icon: Phone, label: 'Calls' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/broadcasts', icon: Megaphone, label: 'Broadcasts' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/ai-agents', icon: Bot, label: 'AI Agents' },
  { to: '/channels', icon: Radio, label: 'Connected Platforms' },
  { to: '/flow', icon: Workflow, label: 'Flow' },
];

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
  const { connected, notifications } = useSocketStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const sidebar = (
    <aside className="h-full flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
      <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#18a6fc' }}>
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-gray-900">Malesan.AI</span>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{label}</span>
                {to === '/inbox' && notifications.length > 0 && (
                  <span className="ml-auto w-2 h-2 bg-danger rounded-full animate-pulse-dot" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/settings"
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          `nav-link border-t border-gray-100 rounded-none ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
        }
      >
        {({ isActive }) => (
          <>
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>Settings</span>
          </>
        )}
      </NavLink>

      <div className="border-t border-gray-100 p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse-dot' : 'bg-danger'}`} />
          <span className="text-xs text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={user.name} src={user.avatar} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top row: brand + header nav */}
      <div className="flex flex-shrink-0 z-10">
        <div className="hidden lg:flex w-[240px] items-center gap-3 px-5 h-16 bg-white border-r border-gray-200 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#18a6fc' }}>
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">Malesan.AI</span>
        </div>

        <header className="flex-1 flex items-center gap-1 px-4 lg:px-6 h-16 bg-white border-b border-gray-200">
          <button className="lg:hidden p-2 text-gray-500 hover:text-gray-700" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <nav className="flex items-center gap-1">
            {headerNavItems.map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive ? '' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  style={isActive ? { background: 'rgba(24, 166, 252, 0.1)', color: '#18a6fc' } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto relative">
            <button onClick={() => setProfileOpen(o => !o)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all text-sm">
              <Avatar name={user?.name || 'User'} size="sm" />
              <span className="hidden sm:block text-sm font-bold text-gray-700">{user?.name}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">Profile</p>
                  <p className="text-xs text-gray-400 truncate">{user?.name}</p>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-600 hover:text-danger hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
      </div>

      {/* Bottom row: sidebar nav + content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex flex-col w-[240px] flex-shrink-0 bg-white border-r border-gray-200">
          <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{label}</span>
                    {to === '/inbox' && notifications.length > 0 && (
                      <span className="ml-auto w-2 h-2 bg-danger rounded-full animate-pulse-dot" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <NavLink
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `nav-link border-t border-gray-100 rounded-none ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
            }
          >
            {({ isActive }) => (
              <>
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[260px] animate-slide-up">
              {sidebar}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
