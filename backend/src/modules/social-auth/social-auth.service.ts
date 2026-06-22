import axios from 'axios';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { createError } from '../../middlewares/error.middleware';

interface FacebookUser {
  id: string;
  name: string;
  email: string;
  picture?: { data: { url: string } };
}

export class SocialAuthService {
  getFacebookOAuthUrl(state: string): string {
    const appId = process.env.FACEBOOK_APP_ID!;
    const redirectUri = process.env.FACEBOOK_CALLBACK_URL!;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: 'email,public_profile',
      response_type: 'code',
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  async handleFacebookCallback(code: string): Promise<{ accessToken: string; refreshToken: string; user: any; isNew: boolean }> {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = process.env.FACEBOOK_CALLBACK_URL!;

    const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    const fbAccessToken = tokenRes.data.access_token;

    const profileRes = await axios.get<FacebookUser>('https://graph.facebook.com/v18.0/me', {
      params: {
        fields: 'id,name,email,picture',
        access_token: fbAccessToken,
      },
    });

    const fbUser = profileRes.data;
    if (!fbUser.email) throw createError('Facebook account must have a verified email', 400);

    let isNew = false;
    let user = await prisma.user.findUnique({ where: { facebookId: fbUser.id }, include: { company: true } });

    if (!user) {
      user = await prisma.user.findFirst({ where: { email: fbUser.email }, include: { company: true } });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { facebookId: fbUser.id, facebookAccessToken: fbAccessToken, authProvider: 'FACEBOOK', avatar: fbUser.picture?.data?.url ?? user.avatar },
          include: { company: true },
        });
      } else {
        isNew = true;
        const companySlug = `fb-${fbUser.id}-${Date.now()}`;
        const company = await prisma.company.create({
          data: {
            name: `${fbUser.name}'s Company`,
            slug: companySlug,
            email: `fb-${fbUser.id}@placeholder.com`,
          },
        });

        const hashedPassword = await bcrypt.hash(uuidv4(), 12);
        user = await prisma.user.create({
          data: {
            companyId: company.id,
            name: fbUser.name,
            email: fbUser.email,
            password: hashedPassword,
            role: 'OWNER',
            facebookId: fbUser.id,
            facebookAccessToken: fbAccessToken,
            authProvider: 'FACEBOOK',
            avatar: fbUser.picture?.data?.url ?? null,
          },
          include: { company: true },
        });
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { facebookAccessToken: fbAccessToken, avatar: fbUser.picture?.data?.url ?? user.avatar, lastLoginAt: new Date() },
        include: { company: true },
      });
    }

    const payload = { userId: user.id, companyId: user.companyId, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    const { password, refreshToken: _rt, facebookAccessToken: _fat, ...safeUser } = user;
    void password;
    void _rt;
    void _fat;

    return { accessToken, refreshToken, user: safeUser, isNew };
  }
}
