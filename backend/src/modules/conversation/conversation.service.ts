import prisma from '../../config/database';
import { createError } from '../../middlewares/error.middleware';
import { Prisma } from '@prisma/client';

export class ConversationService {
  async findAll(companyId: string, query: {
    status?: string; channelId?: string; search?: string;
    page?: number; limit?: number; labelId?: string; agentId?: string;
  }) {
    const { status, channelId, search, page = 1, limit = 20, labelId, agentId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      companyId,
      ...(status && { status: status as any }),
      ...(channelId && { channelId }),
      ...(labelId && { labels: { some: { labelId } } }),
      ...(agentId && { assignments: { some: { userId: agentId, unassignedAt: null } } }),
      ...(search && {
        OR: [
          { contact: { name: { contains: search } } },
          { contact: { phone: { contains: search } } },
          { lastMessage: { contains: search } },
        ],
      }),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          channel: { select: { id: true, name: true, type: true } },
          labels: { include: { label: true } },
          assignments: {
            where: { unassignedAt: null },
            include: { user: { select: { id: true, name: true, avatar: true } } },
            take: 1,
          },
          _count: { select: { messages: { where: { isRead: false, direction: 'INBOUND' } } } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return { conversations, total, page, limit };
  }

  async findById(companyId: string, id: string) {
    const conv = await prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
        channel: true,
        labels: { include: { label: true } },
        assignments: {
          where: { unassignedAt: null },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    if (!conv) throw createError('Conversation not found', 404);
    return conv;
  }

  async updateStatus(companyId: string, id: string, status: string) {
    await this.findById(companyId, id);
    return prisma.conversation.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async assignAgent(companyId: string, conversationId: string, userId: string) {
    await this.findById(companyId, conversationId);
    // unassign current
    await prisma.assignment.updateMany({
      where: { conversationId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
    return prisma.assignment.create({
      data: { conversationId, userId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
  }

  async addLabel(conversationId: string, labelId: string) {
    return prisma.conversationLabel.upsert({
      where: { conversationId_labelId: { conversationId, labelId } },
      create: { conversationId, labelId },
      update: {},
    });
  }

  async removeLabel(conversationId: string, labelId: string) {
    await prisma.conversationLabel.delete({
      where: { conversationId_labelId: { conversationId, labelId } },
    });
  }

  async markRead(companyId: string, conversationId: string) {
    await this.findById(companyId, conversationId);
    await prisma.message.updateMany({
      where: { conversationId, direction: 'INBOUND', isRead: false },
      data: { isRead: true },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { isRead: true } });
  }

  async findOrCreateByContact(companyId: string, channelId: string, contactId: string) {
    let conversation = await prisma.conversation.findFirst({
      where: { companyId, channelId, contactId, status: { in: ['OPEN', 'PENDING'] } },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { companyId, channelId, contactId, status: 'OPEN' },
      });
    }
    return conversation;
  }
}
