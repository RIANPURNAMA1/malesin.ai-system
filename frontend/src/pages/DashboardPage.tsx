import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/index';
import { MessageCircle, CheckCircle, Clock, TrendingUp, Users, Radio } from 'lucide-react';
import { Avatar, Spinner } from '../components/ui/index';

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: analyticsService.overview,
    refetchInterval: 30000,
  });
  const { data: agents } = useQuery({ queryKey: ['analytics-agents'], queryFn: analyticsService.agents });
  const { data: channelData } = useQuery({ queryKey: ['analytics-channels'], queryFn: analyticsService.channels });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Overview of your customer service performance</p>
        </div>

        {loadingOverview ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary" /></div>
        ) : overview && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={<MessageCircle className="w-5 h-5 text-blue-600" />} label="Total Chats" value={overview.total} color="bg-blue-50" />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} label="Open" value={overview.open} color="bg-green-50" />
            <StatCard icon={<Clock className="w-5 h-5 text-yellow-600" />} label="Pending" value={overview.pending} color="bg-yellow-50" />
            <StatCard icon={<CheckCircle className="w-5 h-5 text-gray-500" />} label="Closed" value={overview.closed} color="bg-gray-100" />
            <StatCard icon={<Radio className="w-5 h-5 text-primary" />} label="Today" value={overview.today} color="bg-blue-50" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-gray-800">Agent Performance</h2>
            </div>
            {Array.isArray(agents) && agents.length > 0 ? (
              <div className="space-y-2">
                {(agents as any[]).map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <Avatar name={agent.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{agent.name}</p>
                      <p className="text-xs text-gray-400">{agent.assignedConversations} assigned · {agent.closedConversations} closed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700">{agent.closedConversations}</p>
                      <p className="text-xs text-gray-400">resolved</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No agent data available</p>
            )}
          </div>

          <div className="glass-card p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-gray-800">Channel Analytics</h2>
            </div>
            {Array.isArray(channelData) && channelData.length > 0 ? (
              <div className="space-y-4">
                {(channelData as any[]).map((ch) => {
                  const total = channelData.reduce((s: number, c: any) => s + c._count.conversations, 0);
                  const pct = total > 0 ? Math.round((ch._count.conversations / total) * 100) : 0;
                  return (
                    <div key={ch.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{ch.name}</span>
                        <span className="text-gray-600">{ch._count.conversations} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#18a6fc' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No channel data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
