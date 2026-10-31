import { Request, Response } from 'express';
import supportService from './support.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { CustomRequest } from '../user/user.controller.js';

export const getAllSupportChats = async (req: Request, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await supportService.getAllSupportChats(page, limit, status);
    return res.status(200).json(apiResponse('success', 'Thành công', result));
  } catch (error: any) {
    if (error.message === 'INVALID_STATUS') {
      return res.status(400).json(apiResponse('fail', 'Trạng thái không hợp lệ'));
    }
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getUnreadCount = async (_req: Request, res: Response) => {
  try {
    const count = await supportService.getUnreadCount();
    return res.status(200).json(apiResponse('success', 'Thành công', { unreadCount: count }));
  } catch (error) {
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getSupportChatDetails = async (req: Request, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    const result = await supportService.getSupportChatDetails(chatId);
    return res.status(200).json(apiResponse('success', 'Thành công', { chat: result }));
  } catch (error) {
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const getChatMessages = async (req: Request, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await supportService.getChatMessages(chatId, page, limit);
    return res.status(200).json(apiResponse('success', 'Thành công', result));
  } catch (error) {
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const markChatAsRead = async (req: CustomRequest, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    // No requesterId (admins act on every ticket), but the reader's identity is still
    // needed so the read receipt broadcast says who read it.
    await supportService.markMessagesAsRead(chatId, undefined, req.idUser!);
    return res.status(200).json(apiResponse('success', 'Marked as read'));
  } catch (error) {
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const replyToUser = async (req: CustomRequest, res: Response) => {
  try {
    const { chatId, message, messageType = 'text' } = req.body;
    const adminId = req.idUser!;
    const msg = await supportService.sendMessage({ ticketId: chatId, senderId: adminId, content: message, messageType });
    return res.status(201).json(apiResponse('success', 'Reply sent', { message: msg }));
  } catch (error) {
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export const updateChatStatus = async (req: CustomRequest, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    const { status } = req.body;
    const adminId = req.idUser!;
    const chat = await supportService.updateChatStatus(chatId, status, adminId);
    return res.status(200).json(apiResponse('success', 'Thành công', { chat }));
  } catch (error: any) {
    // The DTO already rejects a bad status before this runs; this covers the same
    // service being called with one from anywhere else, and keeps it a 400 rather
    // than reporting the caller's mistake as a server fault.
    if (error.message === 'INVALID_STATUS') {
      return res.status(400).json(apiResponse('fail', 'Trạng thái không hợp lệ'));
    }
    return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
  }
};

export default {
  getAllSupportChats,
  getUnreadCount,
  getSupportChatDetails,
  getChatMessages,
  markChatAsRead,
  replyToUser,
  updateChatStatus
};
