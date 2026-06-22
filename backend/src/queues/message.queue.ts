import { Queue, Worker, QueueEvents } from 'bullmq';
import redis from '../config/redis';
import logger from '../utils/logger';
import { WhatsAppService } from '../modules/channel/whatsapp.service';

const connection = redis;
const whatsappService = new WhatsAppService();

// Message sending queue
export const messageQueue = new Queue('messages', { connection });

// Webhook processing queue
export const webhookQueue = new Queue('webhooks', { connection });

// Message worker
export const messageWorker = new Worker('messages', async (job) => {
  const { channelId, to, type, content, mediaUrl, fileName, templateName, languageCode } = job.data;
  logger.info(`Processing message job ${job.id}`);

  if (type === 'TEXT') return whatsappService.sendTextMessage(channelId, to, content);
  if (type === 'IMAGE') return whatsappService.sendImageMessage(channelId, to, mediaUrl, content);
  if (type === 'DOCUMENT') return whatsappService.sendDocumentMessage(channelId, to, mediaUrl, fileName, content);
  if (type === 'TEMPLATE') return whatsappService.sendTemplateMessage(channelId, to, templateName, languageCode);
}, {
  connection,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
});

messageWorker.on('completed', (job) => logger.info(`Message job ${job.id} completed`));
messageWorker.on('failed', (job, err) => logger.error(`Message job ${job?.id} failed`, err));

export async function addMessageJob(data: Record<string, unknown>) {
  return messageQueue.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}

export async function addWebhookJob(data: Record<string, unknown>) {
  return webhookQueue.add('process', data, { attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
}
