import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import prisma from '../../config/database';
import { ChannelService } from '../channel/channel.service';
import { createError } from '../../middlewares/error.middleware';
import logger from '../../utils/logger';

const channelService = new ChannelService();

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id: string;
  token_type: string;
}

interface TikTokUserResponse {
  data: {
    user: {
      open_id: string;
      union_id?: string;
      avatar_url?: string;
      avatar_url_100?: string;
      display_name?: string;
      bio_description?: string;
      is_verified?: boolean;
      follower_count?: number;
      following_count?: number;
      likes_count?: number;
      video_count?: number;
    };
  };
  error?: { code: string; message: string };
}

export class TikTokAuthService {
  private get clientKey() {
    return process.env.TIKTOK_CLIENT_KEY || '';
  }

  private get clientSecret() {
    return process.env.TIKTOK_CLIENT_SECRET || '';
  }

  private get redirectUri() {
    return process.env.TIKTOK_REDIRECT_URI || '';
  }

  generateCodeVerifier(): string {
    return crypto.randomBytes(64)
      .toString('base64')
      .replace(/[^a-zA-Z0-9\-._~]/g, '')
      .substring(0, 128);
  }

  generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  getOAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      scope: 'user.info.basic,video.upload',
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<TikTokTokenResponse> {
    const tokenRes = await axios.post<TikTokTokenResponse>(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
      }
    );

    if (!tokenRes.data.access_token) {
      logger.error(`[TikTokExchangeCode] No access_token in response: ${JSON.stringify(tokenRes.data)}`);
      throw createError('Failed to get TikTok access token', 400);
    }

    logger.info(`[TikTokExchangeCode] Token obtained, open_id=${tokenRes.data.open_id}`);

    return tokenRes.data;
  }

  async getUserInfo(accessToken: string) {
    const userRes = await axios.get<TikTokUserResponse>(
      'https://open.tiktokapis.com/v2/user/info/',
      {
        params: {
          fields: 'open_id,union_id,avatar_url,avatar_url_100,display_name,bio_description,is_verified,follower_count,following_count,likes_count,video_count',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (userRes.data.error && userRes.data.error.code !== 'ok') {
      logger.error(`[TikTokGetUserInfo] Error response: ${JSON.stringify(userRes.data.error)}`);
      throw createError(`TikTok API error: ${userRes.data.error.message || userRes.data.error.code || 'unknown'}`, 400);
    }

    return userRes.data.data.user;
  }

  async connectChannel(
    companyId: string,
    code: string,
    codeVerifier: string
  ): Promise<{ channel: any; user: any }> {
    const tokenData = await this.exchangeCode(code, codeVerifier);
    const userInfo = await this.getUserInfo(tokenData.access_token);

    const metadata: Prisma.InputJsonValue = {
      union_id: userInfo.union_id,
      avatar_url: userInfo.avatar_url_100 || userInfo.avatar_url,
      bio_description: userInfo.bio_description,
      follower_count: userInfo.follower_count,
      following_count: userInfo.following_count,
      likes_count: userInfo.likes_count,
      video_count: userInfo.video_count,
      is_verified: userInfo.is_verified,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
    } as any;

    const existingChannel = await prisma.channel.findFirst({
      where: { companyId, type: 'TIKTOK', wabaId: userInfo.open_id },
    });

    let channel;
    if (existingChannel) {
      channel = await channelService.update(companyId, existingChannel.id, {
        name: userInfo.display_name || 'TikTok',
        accessToken: tokenData.access_token,
        metadata,
      });
    } else {
      channel = await channelService.create(companyId, {
        name: userInfo.display_name || 'TikTok',
        type: 'TIKTOK',
        wabaId: userInfo.open_id,
        phoneNumberId: userInfo.union_id,
        accessToken: tokenData.access_token,
        metadata,
      });
    }

    return { channel, user: userInfo };
  }
}
