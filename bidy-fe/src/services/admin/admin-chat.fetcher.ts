/**
 * Admin Support Chat API Functions
 * Handles all admin-side support chat operations
 *
 * Backend đặt module này ở `/api/v1/admin/support/chats` (xem openapi.d.ts).
 * Hai lỗi cũ đã sửa: prefix `/api` thừa (axiosClient đã có baseURL `.../api/v1`)
 * và `support-chats` viết liền — đúng ra là hai segment `support/chats`.
 */

import axiosClient from '@/lib/axios-client';
import { API_ROUTES } from '@/constants/routes.constants';
import { mapAdminChats, mapSupportMessages } from '@/services/support-chat.mapper';
import {
  AdminChatListResponse,
  AdminChatDetailResponse,
  AdminSendMessageRequest,
  UpdateChatStatusRequest,
  AdminChatFilters
} from '@/types/admin-chat';

// Get list of support chats with filters and pagination
export const getAdminSupportChats = async (params: {
  page?: number;
  limit?: number;
  status?: AdminChatFilters['status'];
  priority?: AdminChatFilters['priority'];
  unread?: AdminChatFilters['unread'];
  search?: string;
}): Promise<AdminChatListResponse> => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all') {
      searchParams.set(key, value.toString());
    }
  });

  const response = await axiosClient.get<AdminChatListResponse>(
    `${API_ROUTES.ADMIN_SUPPORT_CHATS}?${searchParams.toString()}`
  );

  // Backend trả entity ticket thô; UI cần shape `AdminChatListItem`.
  return {
    ...response.data,
    data: {
      ...response.data.data,
      chats: mapAdminChats(response.data.data?.chats),
    },
  } as unknown as AdminChatListResponse;
};

// Get specific chat details with messages
export const getAdminChatDetail = async (
  chatId: string,
  page: number = 1,
  limit: number = 50
): Promise<AdminChatDetailResponse> => {
  const response = await axiosClient.get<AdminChatDetailResponse>(
    `${API_ROUTES.ADMIN_SUPPORT_CHAT_BY_ID(chatId)}?page=${page}&limit=${limit}`
  );

  return response.data;
};

// Get messages of a chat
export const getAdminChatMessages = async (
  chatId: string,
  page: number = 1,
  limit: number = 50,
  ticketUserId?: string
) => {
  const response = await axiosClient.get(
    `${API_ROUTES.ADMIN_SUPPORT_CHAT_MESSAGES(chatId)}?page=${page}&limit=${limit}`
  );
  return {
    ...response.data,
    data: {
      ...response.data.data,
      messages: mapSupportMessages(response.data.data?.messages, ticketUserId),
    },
  };
};

// Send message as admin — reply nằm dưới chính chat đó, chatId đi ở path
export const sendAdminMessage = async ({
  chatId,
  ...body
}: AdminSendMessageRequest) => {
  const response = await axiosClient.post(
    API_ROUTES.ADMIN_SUPPORT_CHAT_MESSAGES(chatId),
    body
  );
  return response.data;
};

// Update chat status
export const updateAdminChatStatus = async ({
  chatId,
  ...body
}: UpdateChatStatusRequest) => {
  const response = await axiosClient.patch(
    API_ROUTES.ADMIN_SUPPORT_CHAT_STATUS(chatId),
    body
  );
  return response.data;
};

// Mark chat as read by admin
export const markAdminChatAsRead = async (chatId: string) => {
  const response = await axiosClient.patch(
    API_ROUTES.ADMIN_SUPPORT_CHAT_READ(chatId)
  );
  return response.data;
};

// Số chat còn tin chưa đọc — endpoint duy nhất backend cung cấp cho phần thống kê
export const getAdminChatUnreadCount = async () => {
  const response = await axiosClient.get(
    API_ROUTES.ADMIN_SUPPORT_CHATS_UNREAD_COUNT
  );
  return response.data;
};
