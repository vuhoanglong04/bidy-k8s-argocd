/**
 * TypeScript Interfaces cho hệ thống chat hỗ trợ khách hàng Bidy
 * TypeScript Interfaces for Bidy Customer Support Chat System
 * 
 * MỤC ĐÍCH: Định nghĩa rõ ràng data structures cho chat support
 * PURPOSE: Clear data structure definitions for customer support chat
 */

// Support Agent (Admin) Information
// Thông tin nhân viên hỗ trợ (Admin)
export interface SupportAgent {
  id: string;                    // ID nhân viên hỗ trợ
  name: string;                  // Tên nhân viên (VD: "Nguyễn Văn Admin") 
  fullName: string;              // Tên đầy đủ (backward compatibility)
  email?: string;                // Email liên hệ
  role: 'support_agent' | 'senior_support' | 'manager';
  department: 'customer_service' | 'technical_support' | 'billing';
  avatar?: string;               // URL avatar
  isOnline: boolean;             // Trạng thái online/offline
}

// Support Ticket Information  
// Thông tin ticket hỗ trợ
export interface SupportTicket {
  subject: string;               // Chủ đề (VD: "Hỗ trợ khách hàng Bidy")
  priority: 'low' | 'medium' | 'high';           // Độ ưu tiên
  status: 'active' | 'resolved' | 'pending';     // Trạng thái ticket
  category: 'general_support' | 'bidding_help' | 'payment_issue' | 'account_problem';
}

// Business Context Metadata
// Metadata về context nghiệp vụ
export interface SupportContext {
  platform: 'bidy_auction_platform';            // Platform name
  supportType: 'customer_service';              // Loại hỗ trợ
  description: string;                           // Mô tả ngắn gọn
}

// Main Support Conversation Interface
// Interface chính cho cuộc trò chuyện hỗ trợ
export interface SupportConversation {
  // Basic Information - Thông tin cơ bản
  id: string;                    // ID cuộc trò chuyện
  conversationId: string;        // ID (backward compatibility)
  type: 'customer_support';      // Loại cuộc trò chuyện

  // Support Agent - Nhân viên hỗ trợ (KHÔNG phải "user" - rõ ràng hơn!)
  supportAgent: SupportAgent;

  // Legacy field for backward compatibility
  user: {
    id: string;
    fullName: string; 
    email?: string;
  };

  // Support Ticket Context - Context về ticket hỗ trợ
  ticket: SupportTicket;

  // Business Context - Metadata nghiệp vụ
  context: SupportContext;
}

// API Response Format  
// Format response từ API
export interface SupportConversationResponse {
  success: boolean;
  message: string;               // VD: "Lấy danh sách hỗ trợ khách hàng thành công"
  data: SupportConversation[];
}

// Create Support Conversation Request
// Request tạo conversation hỗ trợ mới
export interface CreateSupportConversationRequest {
  subject?: string;              // Chủ đề hỗ trợ (optional)
  category?: SupportTicket['category']; // Danh mục hỗ trợ
  priority?: SupportTicket['priority']; // Độ ưu tiên
  initialMessage?: string;       // Tin nhắn đầu tiên
}

/**
 * USAGE EXAMPLES - VÍ DỤ SỬ DỤNG:
 * 
 * // API Call - Gọi API
 * const response: SupportConversationResponse = await fetchSupportConversations();
 * 
 * // Access Support Agent - Truy cập thông tin support agent  
 * const agentName = response.data[0].supportAgent.name; // "Admin Support"
 * const isOnline = response.data[0].supportAgent.isOnline; // true/false
 * 
 * // Access Ticket Info - Truy cập thông tin ticket
 * const ticketSubject = response.data[0].ticket.subject; // "Hỗ trợ khách hàng Bidy"
 * const priority = response.data[0].ticket.priority; // "medium"
 * 
 * // Business Context - Context nghiệp vụ
 * const platform = response.data[0].context.platform; // "bidy_auction_platform"
 */

// Export all types
export type {
  SupportAgent,
  SupportTicket, 
  SupportContext,
  SupportConversation,
  SupportConversationResponse,
  CreateSupportConversationRequest
};