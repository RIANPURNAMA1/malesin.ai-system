import { Queue, Worker } from 'bullmq';
import redis, { redisAvailable } from '../config/redis';
import logger from '../utils/logger';
import prisma from '../config/database';
import { InstagramPublishService } from '../modules/publish/instagram-publish.service';
import { TikTokPublishService } from '../modules/social-auth/tiktok-publish.service';

const igPublish = new InstagramPublishService();
const tiktokPublish = new TikTokPublishService();

export const scheduleQueue = redisAvailable
  ? new Queue('schedules', { connection: redis })
  : null;

export const scheduleWorker = redisAvailable
  ? new Worker('schedules', async (job) => {
      const { postId, companyId, platform } = job.data;
      logger.info(`Publishing scheduled ${platform} post ${postId}`);

      try {
        let result;
        if (platform === 'TIKTOK') {
          result = await tiktokPublish.publishPost(companyId, postId);
        } else {
          result = await igPublish.publishPost(companyId, postId);
        }
        logger.info(`Post ${postId} published: ${result.publish_id || result.id}`);
        return result;
      } catch (err: any) {
        await prisma.post.update({
          where: { id: postId },
          data: { status: 'FAILED' },
        });
        logger.error(`Post ${postId} failed: ${err.message}`);
        throw err;
      }
    }, {
      connection: redis,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })
  : null;

if (scheduleWorker) {
  scheduleWorker.on('completed', (job) => logger.info(`Schedule job ${job.id} completed`));
  scheduleWorker.on('failed', (job, err) => logger.error(`Schedule job ${job?.id} failed`, err));
}

export async function checkScheduledPosts() {
  if (!scheduleQueue) {
    logger.warn('Schedule checker skipped — Redis unavailable');
    return;
  }

  logger.info('Checking scheduled posts...');
  const now = new Date();

  const posts = await prisma.post.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
  });

  for (const post of posts) {
    await prisma.post.update({ where: { id: post.id }, data: { status: 'PUBLISHING' } });
    await scheduleQueue.add('publish', {
      postId: post.id,
      companyId: post.companyId,
      platform: post.platform,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    logger.info(`Queued ${post.platform} post ${post.id} for publishing`);
  }
}

let interval: NodeJS.Timeout | null = null;

export function startScheduleChecker() {
  if (!redisAvailable) {
    logger.warn('Schedule checker not started — Redis unavailable');
    return;
  }
  if (interval) return;
  interval = setInterval(checkScheduledPosts, 60_000);
  logger.info('Schedule checker started (every 60s)');
}

export function stopScheduleChecker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
