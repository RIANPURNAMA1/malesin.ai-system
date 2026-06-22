import IORedis from 'ioredis';
import logger from '../utils/logger';

const isEnabled = process.env.REDIS_ENABLED !== 'false';

if (!isEnabled) {
  logger.info('Redis disabled via REDIS_ENABLED env');
}

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: () => null,
};

export const redis = new IORedis(redisConfig);

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', () => {/* suppressed */});

redis.connect().catch(() => {/* suppressed */});

export const redisAvailable = isEnabled;
export default redis;
