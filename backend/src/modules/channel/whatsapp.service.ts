import axios from 'axios';
import prisma from '../../config/database';
import { decrypt } from '../../utils/encryption';

const WA_BASE = process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com';
const WA_VERSION = process.env.WHATSAPP_API_VERSION || 'v25.0';

export class WhatsAppService {
  private async getClient(channelId: string) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');
    if (!channel.accessToken) throw new Error('Channel token not configured');
    const token = decrypt(channel.accessToken);
    return { channel, token };
  }

  async sendTextMessage(channelId: string, to: string, text: string) {
    const { channel, token } = await this.getClient(channelId);
    const res = await axios.post(
      `${WA_BASE}/${WA_VERSION}/${channel.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  async sendImageMessage(channelId: string, to: string, imageUrl: string, caption?: string) {
    const { channel, token } = await this.getClient(channelId);
    const res = await axios.post(
      `${WA_BASE}/${WA_VERSION}/${channel.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: { link: imageUrl, caption },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  async sendDocumentMessage(channelId: string, to: string, documentUrl: string, filename: string, caption?: string) {
    const { channel, token } = await this.getClient(channelId);
    const res = await axios.post(
      `${WA_BASE}/${WA_VERSION}/${channel.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: { link: documentUrl, filename, caption },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  async sendTemplateMessage(channelId: string, to: string, templateName: string, languageCode: string, components?: unknown[]) {
    const { channel, token } = await this.getClient(channelId);
    const res = await axios.post(
      `${WA_BASE}/${WA_VERSION}/${channel.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  }

  async markAsRead(channelId: string, messageId: string) {
    const { channel, token } = await this.getClient(channelId);
    await axios.post(
      `${WA_BASE}/${WA_VERSION}/${channel.phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}
