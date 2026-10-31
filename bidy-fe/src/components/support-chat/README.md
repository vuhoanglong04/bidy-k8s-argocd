# Support Chat Widget

A complete floating chat widget system for Bidy customer support, following modern UX patterns like Facebook Messenger.

## Features

- **Floating Chat Button**: Fixed position bottom-right corner with unread message badge
- **Expandable Chat Window**: 300×450px responsive chat interface
- **Real-time Messaging**: Socket.io integration for instant message delivery
- **Message Pagination**: "Load older messages" functionality with 20 messages per page
- **Typing Indicators**: Real-time typing status from admin
- **Admin Status**: Online/offline status display
- **Mobile Responsive**: Optimized for all screen sizes
- **Accessibility**: WCAG compliant with keyboard navigation
- **Connection Management**: Auto-reconnection and error handling

## Quick Start

### 1. Add to Your Layout

```tsx
// In your main layout component (e.g., RootLayout)
import { SupportChatWidget } from '@/components/support-chat';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        
        {/* Add the floating support chat widget */}
        <SupportChatWidget />
      </body>
    </html>
  );
}
```

### 2. Individual Component Usage

```tsx
import { 
  SupportChatWidget, 
  SupportChatWindow, 
  useSupportChat 
} from '@/components/support-chat';

function MyComponent() {
  const { currentChat, unreadCount } = useSupportChat();
  
  return (
    <div>
      <h1>My Page</h1>
      
      {/* Show support chat widget */}
      <SupportChatWidget />
      
      {/* Or use individual components */}
      <SupportChatWindow 
        isOpen={true} 
        isMinimized={false}
        onClose={() => {}}
        onMinimize={() => {}}
        onToggleMinimize={() => {}}
      />
    </div>
  );
}
```

## Component Structure

```
/fe/src/components/support-chat/
├── SupportChatWidget.tsx      // Main floating button (entry point)
├── SupportChatWindow.tsx      // Expandable chat window  
├── MessageList.tsx            // Messages with pagination
├── MessageInput.tsx           // Text input with send functionality
├── ChatHeader.tsx             // Admin info and status
└── hooks/
    └── useSupportChat.ts      // Socket.io and API integration
```

## API Integration

The components automatically integrate with these endpoints:

```typescript
// User Endpoints
POST /api/support-chat/start          // Start new chat
GET  /api/support-chat/my-chat        // Get user's active chat
POST /api/support-chat/send-message   // Send message
GET  /api/support-chat/messages/:id   // Get messages (paginated)
PUT  /api/support-chat/:id/mark-read  // Mark messages as read
```

## Socket.io Events

### Outgoing Events
- `user_start_chat`: Start new support conversation
- `user_send_message`: Send message to admin
- `user_typing`: Send typing indicator
- `user_join_chat`: Join chat room

### Incoming Events
- `new_support_message`: Receive new message
- `typing_indicator`: Admin typing status
- `admin_status_change`: Admin online/offline
- `chat_status_update`: Chat status changes

## Configuration

### Environment Variables

```env
# WebSocket connection
NEXT_PUBLIC_WS_URL=ws://localhost:8001

# API endpoints (automatically configured via axios-client)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Hook Options

```tsx
const chat = useSupportChat({
  autoConnect: true,        // Auto-connect on mount
  reconnectAttempts: 5,     // Max reconnection attempts
  reconnectDelay: 3000      // Delay between reconnections (ms)
});
```

## Styling & Theming

The components use Tailwind CSS and follow the existing Bidy design system:

```tsx
// Customize appearance with className prop
<SupportChatWidget className="custom-positioning" />

// Components respect your existing theme colors
// Primary: blue-600, Error: red-500, Success: green-500
```

## State Management

The `useSupportChat` hook provides complete state management:

```tsx
const {
  // Connection state
  connectionState: { isConnected, isConnecting, error },
  
  // Chat data
  currentChat,
  messages,
  adminInfo,
  pagination,
  typingIndicator,
  
  // Loading states
  isLoading,
  isSending,
  
  // Actions
  startChat,
  sendMessage,
  loadOlderMessages,
  markMessagesAsRead,
  
  // Computed values
  hasUnreadMessages,
  unreadCount,
  canLoadMore
} = useSupportChat();
```

## Error Handling

Robust error handling with automatic recovery:

- **Connection Errors**: Auto-reconnection with exponential backoff
- **API Errors**: Graceful degradation with user feedback
- **Message Failures**: Optimistic updates with rollback on error
- **Storage Errors**: Fallback to in-memory state

## Accessibility

Full WCAG 2.1 AA compliance:

- Keyboard navigation support
- Screen reader friendly
- ARIA labels and roles
- High contrast support
- Focus management

## Mobile Support

Responsive design for all devices:

- Touch-friendly interface
- Proper viewport handling
- Mobile-optimized sizing
- Gesture support

## Performance

Optimized for production:

- Lazy loading of components
- Efficient message pagination
- Minimal re-renders
- Bundle size: ~15KB (gzipped)

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Integration Examples

### With Authentication

```tsx
import { useAuth } from '@/hooks/useAuth';
import { SupportChatWidget } from '@/components/support-chat';

function App() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div>
      {/* Widget only shows for authenticated users */}
      {isAuthenticated && <SupportChatWidget />}
    </div>
  );
}
```

### Custom Trigger

```tsx
import { useState } from 'react';
import { SupportChatWindow } from '@/components/support-chat';

function CustomTrigger() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsChatOpen(true)}>
        Need Help?
      </button>
      
      <SupportChatWindow
        isOpen={isChatOpen}
        isMinimized={false}
        onClose={() => setIsChatOpen(false)}
        onMinimize={() => {}}
        onToggleMinimize={() => {}}
      />
    </>
  );
}
```

### Multiple Chat Windows

```tsx
// For advanced use cases
import { useSupportChat } from '@/components/support-chat';

function MultiChatExample() {
  const chat1 = useSupportChat({ autoConnect: false });
  const chat2 = useSupportChat({ autoConnect: false });
  
  // Handle multiple chat instances
  // ...
}
```

## Troubleshooting

### Common Issues

1. **Widget not showing**: Check user authentication
2. **Connection failed**: Verify WebSocket URL and server status
3. **Messages not sending**: Check API endpoints and authentication
4. **Styling issues**: Ensure Tailwind CSS is properly configured

### Debug Mode

Enable detailed logging:

```env
NEXT_PUBLIC_LOG_LEVEL=DEBUG
NEXT_PUBLIC_ENABLE_DEBUG=true
```

### Network Inspector

Monitor WebSocket and API calls in browser dev tools:
- Network tab for API requests
- WS tab for WebSocket messages
- Console for debug logs

## API Requirements

Backend should implement these endpoints matching the types in `/types/chat.d.ts`:

```typescript
// Expected API responses
interface SupportChatResponse {
  success: boolean;
  message: string;
  data: SupportChatData;
}

interface MessagesResponse {
  success: boolean;
  message: string;
  data: {
    messages: SupportChatMessage[];
    pagination: MessagePagination;
  };
}
```

See the complete specification in `CHAT_SYSTEM_REDESIGN.md`.