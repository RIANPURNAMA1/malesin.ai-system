import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

const OPENER_ORIGIN = window.location.origin;

export default function TikTokCallbackPage() {
  const [params] = useSearchParams();

  useEffect(() => {
    const success = params.get('success');
    const error = params.get('error');
    const code = params.get('code');
    const state = params.get('state');

    // Case 1: Redirected from backend after successful processing (ngrok flow)
    if (success === 'true') {
      window.opener?.postMessage({
        type: 'TIKTOK_OAUTH',
        success: true,
        user: {
          display_name: params.get('display_name') || 'TikTok User',
          avatar_url_100: params.get('avatar_url') || '',
          follower_count: Number(params.get('follower_count')) || 0,
        },
      }, OPENER_ORIGIN);
      setTimeout(() => window.close(), 1500);
      return;
    }

    // Case 2: Redirected from backend with error
    if (error) {
      window.opener?.postMessage({
        type: 'TIKTOK_OAUTH',
        success: false,
        error,
      }, OPENER_ORIGIN);
      setTimeout(() => window.close(), 2000);
      return;
    }

    // Case 3: Direct callback from TikTok (code + state) — POST to backend
    if (!code || !state) {
      window.opener?.postMessage({
        type: 'TIKTOK_OAUTH',
        success: false,
        error: 'Missing code or state parameter',
      }, OPENER_ORIGIN);
      setTimeout(() => window.close(), 2000);
      return;
    }

    api.post('/social-auth/tiktok/callback', { code, state })
      .then((res) => {
        window.opener?.postMessage({
          type: 'TIKTOK_OAUTH',
          success: true,
          channel: res.data.channel,
          user: res.data.user,
        }, OPENER_ORIGIN);
        setTimeout(() => window.close(), 1500);
      })
      .catch((err) => {
        window.opener?.postMessage({
          type: 'TIKTOK_OAUTH',
          success: false,
          error: err?.response?.data?.error || 'Failed to connect TikTok',
        }, OPENER_ORIGIN);
        setTimeout(() => window.close(), 2000);
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Connecting TikTok account...</p>
        <p className="text-sm text-gray-400 mt-1">Please wait while we complete the setup.</p>
      </div>
    </div>
  );
}
