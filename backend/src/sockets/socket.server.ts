import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import logger from '../utils/logger';

let io: Server;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      // FRONTEND_URL boleh berisi beberapa origin dipisah koma; localhost dev selalu diizinkan.
      origin: [...(process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean), 'http://localhost:5173'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: ${socket.id} user: ${user.userId}`);

    // Join company room
    socket.join(`company:${user.companyId}`);
    socket.join(`user:${user.userId}`);

    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { userId: user.userId });
      // Agen mengetik di dashboard → AI berhenti membalas percakapan ini.
      if (typeof conversationId === 'string') {
        void import('../modules/ai-agent/ai-takeover')
          .then(m => m.markHumanActivity(conversationId, user.companyId))
          .catch(() => undefined);
      }
    });

    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { userId: user.userId });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      void import('../modules/channel/channel-routing.service').then(m => m.scheduleOfflineReassign(user.userId));
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
