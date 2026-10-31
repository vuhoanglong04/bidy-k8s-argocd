// Support Chat Components
export { SupportChatWidget } from './SupportChatWidget';
export { SupportChatWindow } from './SupportChatWindow';
export { ChatHeader } from './ChatHeader';
export { MessageList } from './MessageList';
export { MessageInput } from './MessageInput';

// Hooks
export { useSupportChat } from '@/hooks';

// Types
export type {
  SupportChatMessage,
  SupportChatData,
  AdminInfo,
  ChatWindowState,
  MessagePagination,
  TypingIndicator,
  ConnectionState,
  SupportChatResponse,
  MessagesResponse,
  SendMessageRequest,
  StartChatRequest,
  SupportChatSocketEvents
} from '@/types/chat';