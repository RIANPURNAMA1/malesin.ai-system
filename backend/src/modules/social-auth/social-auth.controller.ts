import { Request, Response, NextFunction } from 'express';
import { SocialAuthService } from './social-auth.service';
import { success } from '../../utils/response';

const socialAuthService = new SocialAuthService();
const STATE_COOKIE = 'fb_oauth_state';

export class SocialAuthController {
  async facebookLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const state = Math.random().toString(36).substring(2, 15);
      res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 * 1000 });
      const url = socialAuthService.getFacebookOAuthUrl(state);
      res.redirect(url);
    } catch (err) {
      next(err);
    }
  }

  async facebookCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;
      const savedState = req.cookies?.[STATE_COOKIE];

      if (state !== savedState) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=state_mismatch`);
      }

      res.clearCookie(STATE_COOKIE);

      if (!code || typeof code !== 'string') {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=no_code`);
      }

      const result = await socialAuthService.handleFacebookCallback(code);

      const html = `
<!DOCTYPE html>
<html>
<head><title>Login successful</title></head>
<body>
<script>
  window.opener.postMessage({
    type: 'FACEBOOK_OAUTH',
    success: true,
    accessToken: '${result.accessToken}',
    refreshToken: '${result.refreshToken}',
    user: ${JSON.stringify(result.user)},
    isNew: ${result.isNew},
  }, '${process.env.FRONTEND_URL || 'http://localhost:5173'}');
  window.close();
</script>
<p>Login successful! You may close this window.</p>
</body>
</html>`;
      res.send(html);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Facebook login failed';
      const html = `
<!DOCTYPE html>
<html>
<head><title>Login failed</title></head>
<body>
<script>
  window.opener.postMessage({
    type: 'FACEBOOK_OAUTH',
    success: false,
    error: '${errorMsg.replace(/'/g, "\\'")}',
  }, '${process.env.FRONTEND_URL || 'http://localhost:5173'}');
  window.close();
</script>
<p>Login failed: ${errorMsg}. You may close this window.</p>
</body>
</html>`;
      res.send(html);
    }
  }
}
