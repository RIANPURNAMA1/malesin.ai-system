import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Heart, Video, UserCheck, ExternalLink, Trash2 } from 'lucide-react';
import { channelService } from '../services/index';
import { Spinner } from '../components/ui/index';
import TikTokIcon from '../components/TikTokIcon';
import toast from 'react-hot-toast';

export default function TikTokDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: channel, isLoading } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => channelService.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Channel not found</p>
      </div>
    );
  }

  const meta = channel.metadata || {};
  const stats = [
    { label: 'Followers', value: meta.follower_count ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Following', value: meta.following_count ?? 0, icon: UserCheck, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Likes', value: meta.likes_count ?? 0, icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Videos', value: meta.video_count ?? 0, icon: Video, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
        <button
          onClick={() => navigate('/channels')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Channels
        </button>

        {/* Profile Header */}
        <div className="glass-card rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative">
              {meta.avatar_url ? (
                <img
                  src={meta.avatar_url}
                  alt={channel.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-100 flex items-center justify-center">
                  <TikTokIcon size="32" />
                </div>
              )}
              {meta.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#fe2c55] rounded-full flex items-center justify-center shadow">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{channel.name}</h1>
                {meta.is_verified && (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#fe2c55] flex-shrink-0">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                )}
              </div>
              {meta.bio_description && (
                <p className="text-sm text-gray-500 mt-1 max-w-lg">{meta.bio_description}</p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-4 text-sm text-gray-400">
                <a
                  href={`https://www.tiktok.com/@${channel.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#fe2c55] transition-colors"
                >
                  @{channel.name}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="glass-card rounded-2xl p-4 lg:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Account Details */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Account Details</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">Display Name</span>
              <span className="text-sm font-medium text-gray-800">{channel.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">Username</span>
              <span className="text-sm font-medium text-gray-800">@{channel.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">Bio</span>
              <span className="text-sm font-medium text-gray-800">{meta.bio_description || '-'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">Verified</span>
              <span className={`text-sm font-medium ${meta.is_verified ? 'text-[#fe2c55]' : 'text-gray-400'}`}>
                {meta.is_verified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">User ID (Open ID)</span>
              <span className="text-sm font-mono text-gray-600 truncate max-w-[200px]">{channel.wabaId || '-'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">Connected Since</span>
              <span className="text-sm font-medium text-gray-800">
                {channel.createdAt ? new Date(channel.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-card rounded-2xl p-6 border border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Disconnect TikTok</h3>
              <p className="text-sm text-gray-500 mt-1">Remove this TikTok connection from your account. This action cannot be undone.</p>
            </div>
            <button
              onClick={async () => {
                if (window.confirm('Are you sure you want to disconnect TikTok?')) {
                  try {
                    await channelService.delete(channel.id);
                    toast.success('TikTok disconnected');
                    navigate('/channels');
                  } catch {
                    toast.error('Failed to disconnect');
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
