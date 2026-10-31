import { API_ROUTES } from '@/constants/routes.constants';
import axiosClient from '@/lib/axios-client';
import type { SupportChatData, SupportChatMessage } from '@/types/chat';

interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

/**
 * Shape phẳng do backend trả, KHÔNG bọc trong `pagination`.
 *
 * Page 1 = các tin MỚI NHẤT, page 2 = trước đó nữa (backend đảo chiều để mở
 * chat ở đáy mà không phải hỏi `totalPages` trước). Trong MỘT trang thì rows
 * vẫn cũ → mới, nên render thẳng, không `.reverse()`.
 *
 * Row là entity `SupportMessage` thô (`content`/`createdAt`/`ticketId`) — dùng
 * `mapSupportMessages` trước khi đưa vào UI.
 */
interface MessagesResponse {
  messages: SupportChatMessage[];
  totalPages: number;
  currentPage: number;
  totalMessages: number;
  /** Điều kiện dừng khi scroll tải trang cũ — đừng tự tính từ `totalPages`. */
  hasMore: boolean;
}

/**
 * REST chỉ còn dùng để NẠP dữ liệu (`getUserCurrentChat`, `loadMessages`).
 * Mọi thao tác ghi (mở ticket, gửi tin, đánh dấu đã đọc) đi qua socket
 * (`user_start_chat` / `user_send_message` / `user_read_messages`).
 * Backend vẫn giữ `POST /users/support/messages` và `PATCH /users/support/chat/{chatId}/read`
 * như đường REST hợp lệ, chỉ là UI không dùng.
 */
class SupportChatService {
  async getUserCurrentChat(): Promise<ApiResponse<{ chat: SupportChatData | null }>> {
    try {
      const response = await axiosClient.get(API_ROUTES.USER_SUPPORT_CHAT);
      return response.data;
    } catch (error) {
      if (axiosClient.defaults.validateStatus?.(404)) {
        return { status: 'success', data: { chat: null } };
      }
      console.error('Failed to get user chat:', error);
      throw error;
    }
  }

  async loadMessages(chatId: string, page: number = 1, limit: number = 50): Promise<ApiResponse<MessagesResponse>> {
    try {
      const response = await axiosClient.get(API_ROUTES.USER_SUPPORT_CHAT_MESSAGES(chatId), {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to load messages:', error);
      throw error;
    }
  }
}

export const supportChatService = new SupportChatService();