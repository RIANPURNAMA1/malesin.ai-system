import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/LoginPage';
import InboxPage from '../pages/InboxPage';
import DashboardPage from '../pages/DashboardPage';
import ContactsPage from '../pages/ContactsPage';
import ChannelsPage from '../pages/ChannelsPage';
import TikTokDashboardPage from '../pages/TikTokDashboardPage';
import SettingsPage from '../pages/SettingsPage';
import AIAgentsPage from '../pages/AIAgentsPage';
import AIAgentEditorPage from '../pages/AIAgentEditorPage';
import AutomationPage from '../pages/AutomationPage';
import AnalyticsPage from '../pages/AnalyticsPage';
import OrdersPage from '../pages/OrdersPage';
import MarketingPage from '../pages/MarketingPage';
import TicketsPage from '../pages/TicketsPage';
import CallsPage from '../pages/CallsPage';
import ConversationsPage from '../pages/ConversationsPage';
import PipelinePage from '../pages/PipelinePage';
import ProfilePage from '../pages/ProfilePage';
import BroadcastsPage from '../pages/BroadcastsPage';
import SchedulePage from '../pages/SchedulePage';
import FlowPage from '../pages/FlowPage';
import LegalPage from '../pages/LegalPage';
import TikTokCallbackPage from '../pages/TikTokCallbackPage';

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <img src="/logoM.png" alt="malesin.AI" className="h-10 w-10 object-contain animate-pulse" />
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

/**
 * Validasi sesi sekali saat aplikasi dibuka. Selama proses ini berjalan,
 * route apa pun (termasuk /inbox) belum dirender, sehingga user yang belum
 * login tidak akan pernah "nyangkut" di halaman protected.
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!isInitialized) return <FullScreenLoader />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();
  if (user && accessToken) return <Navigate to="/inbox" replace />;
  return <>{children}</>;
}

/** Landing page untuk sementara disembunyikan: / langsung ke login (atau inbox jika sudah login). */
function HomeRedirect() {
  const { user, accessToken } = useAuthStore();
  return <Navigate to={user && accessToken ? '/inbox' : '/login'} replace />;
}

export default function AppRouter() {
  return (
    <AuthBootstrap>
      <Routes>
        <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
        {/* Pendaftaran ditutup: akun dibuat oleh admin di Settings → Team Members. */}
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/:conversationId" element={<InboxPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/channels/tiktok/:id" element={<TikTokDashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai-agents" element={<AIAgentsPage />} />
          <Route path="/ai-agents/new" element={<AIAgentEditorPage />} />
          <Route path="/ai-agents/:id" element={<AIAgentEditorPage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/broadcasts" element={<BroadcastsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/flow" element={<FlowPage />} />
        </Route>
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />
        <Route path="/auth/tiktok/callback" element={<TikTokCallbackPage />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthBootstrap>
  );
}
