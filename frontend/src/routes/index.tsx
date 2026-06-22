import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import InboxPage from '../pages/InboxPage';
import DashboardPage from '../pages/DashboardPage';
import ContactsPage from '../pages/ContactsPage';
import ChannelsPage from '../pages/ChannelsPage';
import SettingsPage from '../pages/SettingsPage';
import AIAgentsPage from '../pages/AIAgentsPage';
import AutomationPage from '../pages/AutomationPage';
import AnalyticsPage from '../pages/AnalyticsPage';
import OrdersPage from '../pages/OrdersPage';
import MarketingPage from '../pages/MarketingPage';
import TicketsPage from '../pages/TicketsPage';
import CallsPage from '../pages/CallsPage';
import ConversationsPage from '../pages/ConversationsPage';
import BroadcastsPage from '../pages/BroadcastsPage';
import SchedulePage from '../pages/SchedulePage';
import FlowPage from '../pages/FlowPage';
import LegalPage from '../pages/LegalPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user) return <Navigate to="/inbox" replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<RequireGuest><AuthLayout /></RequireGuest>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/:conversationId" element={<InboxPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ai-agents" element={<AIAgentsPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/marketing" element={<MarketingPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/calls" element={<CallsPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/broadcasts" element={<BroadcastsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/flow" element={<FlowPage />} />
      </Route>
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/" element={<Navigate to="/inbox" replace />} />
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
