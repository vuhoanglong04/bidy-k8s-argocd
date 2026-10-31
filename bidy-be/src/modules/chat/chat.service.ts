import { AppDataSource } from '../../database/data-source.js';
import { fileService } from '../file/file.provider.js';
import { Conversation } from './entity/conversation.entity.js';
import { ConversationMember } from './entity/conversation-member.entity.js';
import { Message } from './entity/message.entity.js';
import { In } from 'typeorm';
import chatWebSocketService from './chat-websocket.service.js';

export const createConversation = async (userId: string, adminId: string) => {
  const convRepo = AppDataSource.getRepository(Conversation);
  const memberRepo = AppDataSource.getRepository(ConversationMember);
  
  const existingMemberConvs = await memberRepo.find({ where: { userId: In([userId, adminId]) } });
  
  const convCount: Record<string, number> = {};
  for (const m of existingMemberConvs) {
    convCount[m.conversationId] = (convCount[m.conversationId] || 0) + 1;
  }
  
  let existingConvId = null;
  for (const [convId, count] of Object.entries(convCount)) {
    if (count === 2) {
      existingConvId = convId;
      break;
    }
  }

  if (existingConvId) {
    const isExist = await convRepo.findOne({ where: { id: existingConvId }});
    return { conversation: isExist, isNew: false };
  }

  const newConv = convRepo.create();
  await convRepo.save(newConv);
  
  await memberRepo.insert([
    { conversationId: newConv.id, userId: userId },
    { conversationId: newConv.id, userId: adminId }
  ]);
  
  return { conversation: newConv, isNew: true };
};

export const getAllConversation = async (currentUserId: string) => {
  const convRepo = AppDataSource.getRepository(Conversation);
  const conversations = await convRepo.find({
    relations: { members: { user: true } }
  });

  return conversations.map(conv => {
    const userMember = conv.members.find(m => String(m.userId) !== String(currentUserId));
    return {
      conversationId: conv.id,
      user: {
        id: userMember?.user?.id,
        fullName: userMember?.user?.fullname,
        email: userMember?.user?.email,
      }
    };
  });
};

export const getConversationById = async (conversationId: string, userId: string) => {
  const memberRepo = AppDataSource.getRepository(ConversationMember);
  const isYourConv = await memberRepo.findOne({ where: { conversationId, userId } });

  // Reported as not-found rather than forbidden so conversation ids stay unenumerable.
  if (!isYourConv) throw new Error('CONVERSATION_NOT_FOUND');

  const convRepo = AppDataSource.getRepository(Conversation);
  const conv = await convRepo.findOne({
    where: { id: conversationId },
    relations: { members: { user: true } }
  });
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND');

  const user = conv.members[0]?.user;
  return {
    conversationId: conv.id,
    user: {
      id: user?.id,
      fullName: user?.fullname,
      email: user?.email,
    }
  };
};

export const getMyConversation = async (userId: string) => {
  const convRepo = AppDataSource.getRepository(Conversation);
  const convs = await convRepo.find({
    relations: { members: { user: true } }
  });
  
  const myConvs = convs.filter(c => c.members.some(m => String(m.userId) === String(userId)));

  const result = await Promise.all(myConvs.map(async conv => {
    const supportAgent = conv.members.find(m => String(m.userId) !== String(userId))?.user;
    if (!supportAgent) return null;
    
    return {
      id: conv.id,
      conversationId: conv.id,
      type: 'customer_support',
      supportAgent: {
        id: supportAgent.id,
        name: supportAgent.fullname || 'Admin Support',
        fullName: supportAgent.fullname || 'Admin Support',
        email: supportAgent.email,
        role: 'support_agent',
        department: 'customer_service',
        avatarFileId: supportAgent.avatarFileId ?? null,
        avatar: (await fileService.urlOf(supportAgent.avatarFile)) || '/admin-avatar.png',
        isOnline: true,
      },
      user: {
        id: supportAgent.id,
        fullName: supportAgent.fullname || 'Admin Support',
        email: supportAgent.email,
      },
      ticket: {
        subject: 'Hỗ trợ khách hàng Bidy',
        priority: 'medium',
        status: 'active',
        category: 'general_support',
      },
      context: {
        platform: 'bidy_auction_platform',
        supportType: 'customer_service',
        description: 'Cuộc trò chuyện hỗ trợ khách hàng trên nền tảng đấu giá Bidy',
      },
    };
  }));

  return result.filter(Boolean);
};

export const createMessage = async (userId: string, conversationId: string, message: string) => {
  const memberRepo = AppDataSource.getRepository(ConversationMember);
  const isYourConv = await memberRepo.findOne({ where: { conversationId: conversationId, userId: userId } });
  
  if (!isYourConv) throw new Error('CONVERSATION_NOT_FOUND');

  const msgRepo = AppDataSource.getRepository(Message);
  const newMsg = msgRepo.create({
    senderId: userId,
    conversationId: conversationId,
    content: message
  });
  await msgRepo.save(newMsg);
  
  const allMembers = await memberRepo.find({ where: { conversationId: conversationId } });
  const receiver = allMembers.find(m => String(m.userId) !== String(userId));
  
  if (receiver) {
     const messageData = {
        senderId: userId,
        receiverId: receiver.userId,
        conversationId,
        message,
        messageId: newMsg.id,
        timestamp: newMsg.createdAt || new Date().toISOString(),
     };
     chatWebSocketService.broadcastChatMessage(messageData);
  }
  
  return newMsg;
};

/**
 * Newest first and paged, mirroring the notification list: the unpaged version
 * loaded every message a conversation had ever held on each open, so its cost grew
 * without bound while a screen only ever renders the tail.
 */
export const getAllMessageByConversationId = async (
  userId: string,
  conversationId: string,
  options: { page?: number; limit?: number } = {},
) => {
  const memberRepo = AppDataSource.getRepository(ConversationMember);
  const isYourConv = await memberRepo.findOne({ where: { conversationId: conversationId, userId: userId } });

  if (!isYourConv) throw new Error('CONVERSATION_NOT_FOUND');

  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));

  const msgRepo = AppDataSource.getRepository(Message);
  const [messages, totalCount] = await msgRepo.findAndCount({
    where: { conversationId: conversationId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const totalPages = Math.ceil(totalCount / limit);
  return {
    messages,
    pagination: { currentPage: page, totalPages, totalCount, limit, hasMore: page < totalPages },
  };
};

export const getAllMessageByUserId = async (userId: string, adminId: string) => {
  const memberRepo = AppDataSource.getRepository(ConversationMember);
  const members = await memberRepo.find({ where: { userId: In([userId, adminId]) } });
  
  const convCount: Record<string, number> = {};
  for (const m of members) convCount[m.conversationId] = (convCount[m.conversationId] || 0) + 1;
  
  let existingConvId = null;
  for (const [convId, count] of Object.entries(convCount)) {
    if (count === 2) { existingConvId = convId; break; }
  }
  
  if (!existingConvId) throw new Error('CONVERSATION_NOT_FOUND');
  
  const msgRepo = AppDataSource.getRepository(Message);
  return msgRepo.find({ where: { conversationId: existingConvId }, order: { createdAt: 'ASC' } });
};

export default {
  createConversation,
  getAllConversation,
  getConversationById,
  getMyConversation,
  createMessage,
  getAllMessageByConversationId,
  getAllMessageByUserId,
};
