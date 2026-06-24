import { useState, useEffect, useCallback } from 'react';
import { XCircle, Loader2, CheckCircle2, Music } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import TikTokIcon from './TikTokIcon';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function TikTokConnectModal({ onClose }: Props) {
  const { user } = useAuthStore();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<Record<string, any> | null>(null);

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === 'TIKTOK_OAUTH') {
      if (e.data.success) {
        setConnected(true);
        setUserInfo(e.data.user);
        toast.success('TikTok account connected!');
      } else {
        toast.error(e.data.error || 'Failed to connect TikTok');
        setConnecting(false);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleConnect = async () => {
    setConnecting(true);
    const companyId = user?.companyId || '';
    try {
      const resp = await fetch(`/api/social-auth/tiktok/oauth-url?companyId=${encodeURIComponent(companyId)}`);
      const data = await resp.json();
      if (!data.success || !data.url) {
        throw new Error(data.error || 'Failed to get OAuth URL');
      }
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.url,
        'TikTok Login',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );
      if (!popup) {
        toast.error('Popup blocked. Please allow popups for this site.');
        setConnecting(false);
      }
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setConnecting(false);
        }
      }, 500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="glass-modal w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin relative animate-slide-up bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">TikTok</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-8 space-y-6">
          {connected && userInfo ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h4 className="font-semibold text-gray-900 text-lg">Connected!</h4>
              <div className="flex items-center justify-center gap-3">
                {userInfo.avatar_url_100 && (
                  <img src={userInfo.avatar_url_100} alt="" className="w-12 h-12 rounded-full" />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-900">@{userInfo.display_name}</p>
                  <p className="text-sm text-gray-500">
                    {userInfo.follower_count?.toLocaleString()} followers
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-gray-900">{userInfo.following_count?.toLocaleString() || '-'}</p>
                  <p className="text-gray-400 text-xs">Following</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-gray-900">{userInfo.follower_count?.toLocaleString() || '-'}</p>
                  <p className="text-gray-400 text-xs">Followers</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-gray-900">{userInfo.likes_count?.toLocaleString() || '-'}</p>
                  <p className="text-gray-400 text-xs">Likes</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-[#fe2c55]/10 flex items-center justify-center mx-auto">
                <TikTokIcon size="36" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-lg">Connect your TikTok account</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Link your TikTok account to manage content and view analytics from your dashboard.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2">
                <p className="font-medium text-gray-700">What you'll get:</p>
                <ul className="space-y-1.5 text-gray-500">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    View your TikTok profile and stats
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    See follower count, following, and likes
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Schedule and publish TikTok videos
                  </li>
                </ul>
              </div>

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-black hover:bg-gray-900 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-black/20"
              >
                {connecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <img src="/logotk.png" alt="" className="w-7 h-7 object-contain" />
                )}
                {connecting ? 'Opening TikTok...' : 'Connect with TikTok'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {connected ? 'Done' : 'Cancel'}
          </button>
          {connected && (
            <button
              onClick={onClose}
              className="gradient-btn px-6 py-2 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
