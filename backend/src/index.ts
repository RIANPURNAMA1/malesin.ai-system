import 'dotenv/config';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import routes from './routes';
import { TikTokAuthController } from './modules/social-auth/tiktok-auth.controller';
import { errorHandler, notFound } from './middlewares/error.middleware';
import { initSocket } from './sockets/socket.server';
import { startScheduleChecker } from './queues/schedule.queue';
import logger from './utils/logger';

const app = express();
const server = http.createServer(app);

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, message: 'Too many requests' },
});
app.use('/api', limiter);

// Parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// TikTok OAuth callback (via ngrok — renders profile page)
const tiktokCtrl = new TikTokAuthController();
app.get('/auth/tiktok/callback', tiktokCtrl.callbackGet.bind(tiktokCtrl));

// Routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.IO
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  startScheduleChecker();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
