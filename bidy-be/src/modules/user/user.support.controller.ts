import { Response } from 'express';
import supportService from '../support-chat/support.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';
import { CustomRequest } from './user.controller.js';

export const startSupportChat = async (req: CustomRequest, res: Response) => {
  try {
    const { subject = 'Hỗ trợ khách hàng' } = req.body;
    const userId = req.idUser!;
    const chat = await supportService.startOrGetUserChat(userId, subject);
    if (!chat) return res.status(500).json(apiResponse('fail', 'Unable to start chat session'));
    return res.status(200).json(apiResponse('success', 'Thành công', { chat }));
  } catch (error) {
    logger.error('Error starting support chat', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getMyChat = async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.idUser!;
    const chat = await supportService.getUserActiveChat(userId);
    return res.status(200).json(apiResponse('success', 'Thành công', { chat }));
  } catch (error) {
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const sendMessage = async (req: CustomRequest, res: Response) => {
  try {
    const { chatId, message, messageType = 'text' } = req.body;
    const userId = req.idUser!;
    const msg = await supportService.sendMessage({ ticketId: chatId, senderId: userId, content: message, messageType, requesterId: userId });
    return res.status(201).json(apiResponse('success', 'Message sent successfully', { message: msg }));
  } catch (error: any) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getChatMessages = async (req: CustomRequest, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await supportService.getChatMessages(chatId, page, limit, req.idUser!);
    return res.status(200).json(apiResponse('success', 'Thành công', result));
  } catch (error: any) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const markMessagesAsRead = async (req: CustomRequest, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    await supportService.markMessagesAsRead(chatId, req.idUser!);
    return res.status(200).json(apiResponse('success', 'Messages marked as read'));
  } catch (error: any) {
    if (error.message === 'TICKET_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export default {
  startSupportChat,
  getMyChat,
  sendMessage,
  getChatMessages,
  markMessagesAsRead
};
