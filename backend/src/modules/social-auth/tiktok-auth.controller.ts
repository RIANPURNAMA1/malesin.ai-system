import { Request, Response, NextFunction } from 'express';
import { TikTokAuthService } from './tiktok-auth.service';
import logger from '../../utils/logger';

const tiktokAuthService = new TikTokAuthService();

interface OAuthState {
  companyId: string;
  codeVerifier: string;
  expiresAt: number;
}

const oauthStateMap = new Map<string, OAuthState>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStateMap.entries()) {
    if (val.expiresAt < now) {
      oauthStateMap.delete(key);
    }
  }
}, 60_000);

export class TikTokAuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      if (!companyId) {
        return res.status(400).send('Missing companyId parameter');
      }

      const state = Math.random().toString(36).substring(2, 15);
      const codeVerifier = tiktokAuthService.generateCodeVerifier();
      const codeChallenge = tiktokAuthService.generateCodeChallenge(codeVerifier);

      oauthStateMap.set(state, {
        companyId,
        codeVerifier,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const url = tiktokAuthService.getOAuthUrl(state, codeChallenge);
      res.redirect(url);
    } catch (err) {
      next(err);
    }
  }

  async getOAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      if (!companyId) {
        return res.status(400).json({ success: false, error: 'Missing companyId parameter' });
      }

      const state = Math.random().toString(36).substring(2, 15);
      const codeVerifier = tiktokAuthService.generateCodeVerifier();
      const codeChallenge = tiktokAuthService.generateCodeChallenge(codeVerifier);

      oauthStateMap.set(state, {
        companyId,
        codeVerifier,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const url = tiktokAuthService.getOAuthUrl(state, codeChallenge);
      res.json({ success: true, url, state });
    } catch (err) {
      next(err);
    }
  }

  async callback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = req.body?.code || req.query?.code || '';
      const state = req.body?.state || req.query?.state || '';

      if (typeof state !== 'string' || !state) {
        return res.status(400).json({ success: false, error: 'Missing state parameter' });
      }

      const stored = oauthStateMap.get(state);
      if (!stored) {
        return res.status(400).json({ success: false, error: 'Invalid or expired state. Please try again.' });
      }

      oauthStateMap.delete(state);

      if (typeof code !== 'string' || !code) {
        return res.status(400).json({ success: false, error: 'Missing authorization code' });
      }

      const result = await tiktokAuthService.connectChannel(stored.companyId, code, stored.codeVerifier);
      return res.json({ success: true, channel: result.channel, user: result.user });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'TikTok connection failed';
      return res.status(400).json({ success: false, error: errorMsg });
    }
  }

  async callbackGet(req: Request, res: Response, next: NextFunction) {
    try {
      const code = (req.query.code as string) || '';
      const state = (req.query.state as string) || '';

      logger.info(`[TikTokCallback] state=${state} code.length=${code.length}`);

      if (!state || !code) {
        logger.warn('[TikTokCallback] Missing code or state');
        return res.status(400).send('Missing code or state parameter');
      }

      const stored = oauthStateMap.get(state);
      if (!stored) {
        logger.warn(`[TikTokCallback] State not found: ${state}`);
        return res.status(400).send('Invalid or expired state');
      }

      oauthStateMap.delete(state);
      logger.info(`[TikTokCallback] State found, exchanging code for companyId=${stored.companyId}`);

      const result = await tiktokAuthService.connectChannel(stored.companyId, code, stored.codeVerifier);
      const user = result.user;

      const avatarUrl = user.avatar_url_100 || user.avatar_url || '';
      const displayName = user.display_name || 'TikTok User';
      const followerCount = user.follower_count ?? 0;
      const followingCount = user.following_count ?? 0;
      const likesCount = user.likes_count ?? 0;
      const videoCount = user.video_count ?? 0;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TikTok Connected</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center; padding: 40px 32px;
      max-width: 360px; width: 100%;
    }
    .check {
      width: 56px; height: 56px;
      background: #10b981; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .check svg { width: 28px; height: 28px; stroke: #fff; stroke-width: 2.5; fill: none; }
    h1 { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .sub { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
    .avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto 12px; border: 3px solid #fe2c55; }
    .name { font-size: 18px; font-weight: 600; color: #111; }
    .stats {
      display: flex; justify-content: center; gap: 24px;
      margin: 20px 0 28px;
    }
    .stat { text-align: center; }
    .stat-num { font-size: 18px; font-weight: 700; color: #111; }
    .stat-label { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .btn {
      display: inline-block; padding: 12px 32px;
      background: #fe2c55; color: #fff; border: none; border-radius: 999px;
      font-size: 15px; font-weight: 600; cursor: pointer;
      transition: opacity .15s;
    }
    .btn:hover { opacity: .85; }
    .error-icon { width: 56px; height: 56px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .error-icon svg { width: 28px; height: 28px; stroke: #fff; stroke-width: 2.5; fill: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h1>TikTok Connected!</h1>
    <p class="sub">Your account has been linked successfully.</p>
    <img class="avatar" src="${avatarUrl}" alt="${displayName}" />
    <div class="name">${displayName}</div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${followerCount.toLocaleString()}</div>
        <div class="stat-label">Followers</div>
      </div>
      <div class="stat">
        <div class="stat-num">${followingCount.toLocaleString()}</div>
        <div class="stat-label">Following</div>
      </div>
      <div class="stat">
        <div class="stat-num">${likesCount.toLocaleString()}</div>
        <div class="stat-label">Likes</div>
      </div>
    </div>
    <button class="btn" onclick="closePopup()">Done</button>
  </div>
  <script>
    function closePopup() {
      try {
        window.opener?.postMessage({ type: 'TIKTOK_OAUTH', success: true, user: ${JSON.stringify({
          display_name: displayName,
          avatar_url_100: avatarUrl,
          follower_count: followerCount,
        })}}, '${process.env.FRONTEND_URL || 'http://localhost:5173'}');
      } catch (e) {}
      window.close();
    }
    // auto-close after 3s and notify opener
    setTimeout(closePopup, 3000);
  </script>
</body>
</html>`;
      res.set('Content-Security-Policy', "script-src 'unsafe-inline' 'self'");
      res.type('html').send(html);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'TikTok connection failed';
      logger.error(`[TikTokCallback] Error: ${errorMsg}`);
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TikTok Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card { text-align: center; padding: 40px 32px; max-width: 360px; width: 100%; }
    .error-icon { width: 56px; height: 56px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .error-icon svg { width: 28px; height: 28px; stroke: #fff; stroke-width: 2.5; fill: none; }
    h1 { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px; }
    p { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
    .btn {
      display: inline-block; padding: 12px 32px;
      background: #111; color: #fff; border: none; border-radius: 999px;
      font-size: 15px; font-weight: 600; cursor: pointer;
    }
    .btn:hover { opacity: .85; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
    <h1>Connection Failed</h1>
    <p>${errorMsg}</p>
    <button class="btn" onclick="closePopup()">Close</button>
  </div>
  <script>
    function closePopup() {
      try {
        window.opener?.postMessage({ type: 'TIKTOK_OAUTH', success: false, error: '${errorMsg.replace(/'/g, "\\'")}' }, '${process.env.FRONTEND_URL || 'http://localhost:5173'}');
      } catch (e) {}
      window.close();
    }
  </script>
</body>
</html>`;
      res.status(400).type('html').send(html);
    }
  }
}
