import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
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
import { startBroadcastEngine } from './modules/broadcast/broadcast.engine';
import { startPipelineAutomation } from './modules/crm/pipeline.automation';
import { whatsAppUnofficialService } from './modules/channel/whatsapp-unofficial.service';
import logger from './utils/logger';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Serve uploaded files (dipakai juga sebagai URL publik media Knowledge Base).
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res) => {
    // Supaya gambar bisa ditampilkan lintas origin di dashboard dan diambil
    // oleh WhatsApp gateway/provider AI.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // File upload hanya untuk ditampilkan, jangan pernah dieksekusi sebagai script.
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
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
  startBroadcastEngine();
  startPipelineAutomation();

  // Pulihkan sesi WhatsApp Unofficial yang kredensialnya masih tersimpan di
  // disk, supaya device yang sudah terhubung tidak tampil disconnected
  // setelah backend restart.
  void whatsAppUnofficialService
    .restoreAll()
    .catch((err) => logger.error('Gagal memulihkan sesi WhatsApp Unofficial', err));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
