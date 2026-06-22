import { Queue, Worker } from 'bullmq';
import redis, { redisAvailable } from '../config/redis';
import logger from '../utils/logger';
import { WhatsAppService } from '../modules/channel/whatsapp.service';

const whatsappService = new WhatsAppService();

export const messageQueue = redisAvailable
  ? new Queue('messages', { connection: redis })
  : null;

export const webhookQueue = redisAvailable
  ? new Queue('webhooks', { connection: redis })
  : null;

export const messageWorker = redisAvailable
  ? new Worker('messages', async (job) => {
      const { channelId, to, type, content, mediaUrl, fileName, templateName, languageCode } = job.data;
      logger.info(`Processing message job ${job.id}`);

      if (type === 'TEXT') return whatsappService.sendTextMessage(channelId, to, content);
      if (type === 'IMAGE') return whatsappService.sendImageMessage(channelId, to, mediaUrl, content);
      if (type === 'DOCUMENT') return whatsappService.sendDocumentMessage(channelId, to, mediaUrl, fileName, content);
      if (type === 'TEMPLATE') return whatsappService.sendTemplateMessage(channelId, to, templateName, languageCode);
    }, {
      connection: redis,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })
  : null;

if (messageWorker) {
  messageWorker.on('completed', (job) => logger.info(`Message job ${job.id} completed`));
  messageWorker.on('failed', (job, err) => logger.error(`Message job ${job?.id} failed`, err));
}

export async function addMessageJob(data: Record<string, unknown>) {
  if (!messageQueue) {
    logger.warn('Message queue unavailable — Redis not configured');
    return;
  }
  return messageQueue.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}

export async function addWebhookJob(data: Record<string, unknown>) {
  if (!webhookQueue) {
    logger.warn('Webhook queue unavailable — Redis not configured');
    return;
  }
  return webhookQueue.add('process', data, { attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
}
