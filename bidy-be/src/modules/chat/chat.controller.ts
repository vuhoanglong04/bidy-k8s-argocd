import { Response } from 'express';
import { CustomRequest } from '../user/user.controller.js';
import { CreateMessageDto } from './dtos/create-message.dto.js';
import chatService from './chat.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';
import dotenv from 'dotenv';
dotenv.config();

export const createConversation = async (req: CustomRequest, res: Response) => {
  try {
    const { conversation, isNew } = await chatService.createConversation(req.idUser!, process.env.ID_ADMIN!);

    if (!isNew) {
      return res.status(200).json(apiResponse('success', 'Conversation already exists', conversation));
    }

    return res.status(201).json(apiResponse('success', 'Thành công', conversation));
  } catch (error: any) {
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getAllConversation = async (req: CustomRequest, res: Response) => {
  try {
    const result = await chatService.getAllConversation(req.idUser!);
    return res.status(200).json(apiResponse('success', 'Thành công', result));
  } catch (error: any) {
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getConversationById = async (req: CustomRequest, res: Response) => {
  try {
    const result = await chatService.getConversationById(req.params.id, req.idUser!);
    return res.status(200).json(apiResponse('success', 'Thành công', result));
  } catch (error: any) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getMyConversation = async (req: CustomRequest, res: Response) => {
  try {
    const result = await chatService.getMyConversation(req.idUser!);
    return res.status(200).json(apiResponse('success', 'Lấy danh sách hỗ trợ khách hàng thành công', result));
  } catch (error: any) {
    console.error('❌[Customer Support]: Error getting support conversations:', error);
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const createMessage = async (req: CustomRequest<CreateMessageDto>, res: Response) => {
  try {
    const { conversationId, message } = req.body;
    const newMessage = await chatService.createMessage(req.idUser!, conversationId, message);
    return res.status(201).json(apiResponse('success', 'Thành công', newMessage));
  } catch (error: any) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getAllMessageByConversationId = async (req: CustomRequest, res: Response) => {
  try {
    const result = await chatService.getAllMessageByConversationId(req.idUser!, req.params.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    return res.status(200).json(apiResponse('success', 'Thành công', result));
  } catch (error: any) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getAllMessageByUserId = async (req: CustomRequest, res: Response) => {
  try {
    const messages = await chatService.getAllMessageByUserId(req.idUser!, process.env.ID_ADMIN!);
    return res.status(200).json(apiResponse('success', 'Thành công', messages));
  } catch (error: any) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return res.status(404).json(apiResponse('fail', 'Không tìm thấy cuộc trò chuyện'));
    }
    logger.error('Chat request failed', error);
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
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