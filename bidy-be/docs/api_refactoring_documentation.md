# Bidy Backend Refactoring Documentation

This documentation is generated to assist with refactoring the backend API without affecting the current output and business logic. It provides a comprehensive overview of exposed routes, business flows, and exact API contracts (DTOs) based strictly on the current implementation in `src/routes` and `src/dtos`, entirely independent of the inaccurate `swagger.yaml`.

---

## 1. Core Business Flows

Based on the exposed router surface, the backend handles the following primary business flows:

### 1.1 Authentication & User Management (`/user`)
- **Flow**: Guests can check their identity (`/check`), sign up (`/signup`), and log in (`/login`). Registration requires email verification (`/verify`, `/resend-verify`).
- **Account Recovery**: Supports password reset via token (`/forgot-password`, `/reset-password`).
- **Profile Management**: Authenticated users can retrieve their profile and stats, update details, change passwords (`/changePassword`), upload avatars via multipart/form-data (`/avatar`), and manage their wishlist.

### 1.2 Auctions & Listing (`/auction` & `/api/auction-status`)
- **Flow**: Products are browsed globally or by category (`/category/:category`). Individual listings are fetched by ID (`/listing/:id`).
- **User Specific**: Users can retrieve their won auctions/orders (`/order`), view their created listings (`/myAuction`).
- **Images**: Pre-signed URLs or image serving is handled via `/images`.
- *Note: Bidding transactions are primarily expected to be handled over Socket.IO, but time-sync endpoints ensure clients have the correct ending times.*

### 1.3 Orders & Payments (`/api/orders`)
- **Flow**: Once an auction is won, it moves to an order state. Users retrieve won auctions (`/won-auctions`) and check their payment status (`/payment-status`).
- **Checkout**: To checkout, the user processes the payment with order IDs and a method (`/payment`), which must be subsequently confirmed (`/payment/:paymentId/confirm`).

### 1.4 Communications: Chat & Support (`/chat`, `/api/support-chat`)
- **Standard Chat**: Users can start conversations, fetch messages, and send messages (`/message`).
- **Support Chat**: Specialized routes exist for Customer Support (`/api/support-chat`), allowing the system to send rich messages such as a "product grid" (`/messages/product-grid`) to display interactive items in chat.

### 1.5 Notifications (`/api/notifications`)
- **Flow**: System alerts are fetched via pagination (`/`), filtered by category, or counted for unread status (`/unread-count`).
- **Management**: Users mark single or all notifications as read, and can delete notifications.

### 1.6 Time Sync (`/api/time`)
- **Flow**: Critical for auction ending logic. Provides the current server time (`/current`), remaining time for specific auctions, and batch synchronization for distributed services.

### 1.7 Admin Operations (`/admin`, `/api/admin`)
- **Flow**: Administrators can fetch paginated lists of users (`GetAllUserQueryDTO`), auctions (`GetAllAuctionQueryDTO`), update user statuses (`UpdateUserStatusDTO`), and fetch platform statistics.

---

## 2. API Exposed Routes

Below is the structured list of all exposed endpoints grouped by their base path.

### User Routes (`/user`)
| Method | Path | Middlewares & Controller |
|--------|------|--------------------------|
| `POST` | `/check` | `checkUser` |
| `POST` | `/login` | `validateUserLogin`, `loginUser` |
| `POST` | `/signup` | `validateUserRegister`, `register` |
| `POST` | `/forgot-password` | `validateForgotPassword`, `forgotPassword` |
| `POST` | `/reset-password` | `validateResetPassword`, `resetPassword` |
| `GET`  | `/verify` | `verifyLink` |
| `GET`  | `/resend-verify` | `resendVerify` |
| `GET`  | `/profile` | `isAuth`, `viewProfile` |
| `GET`  | `/stats` | `isAuth`, `getUserStats` |
| `PATCH`| `/update` | `isAuth`, `userUpdate` |
| `PUT`  | `/changePassword` | `isAuth`, `changePassword` |
| `POST` | `/avatar` | `isAuth`, `upload.single('avatar')`, `updateAvatar` |
| `GET`  | `/wishlist` | `isAuth`, `getWishlist` |
| `POST` | `/wishlist/add/:id` | `isAuth`, `addWishlist` |
| `DELETE`| `/wishlist/remove/:id` | `isAuth`, `removeWishlist` |
| `DELETE`| `/wishlist/removeAll` | `isAuth`, `removeAllWishlist` |
| `GET`  | `/` | `userList` |

### Auction Routes (`/auction`)
| Method | Path | Controller Method |
|--------|------|-------------------|
| `GET`  | `/listing/:id` | `getProductById` |
| `GET`  | `/category/:category` | `getProductByCategory` |
| `POST` | `/images` | `getUploadURL` |
| `GET`  | `/order` | `isAuth`, `getOrder` |
| `GET`  | `/categories` | `getAllCategory` |
| `GET`  | `/myAuction` | `isAuth`, `getMyAuction` |

### Orders Routes (`/api/orders`)
| Method | Path | Controller Method |
|--------|------|-------------------|
| `GET`  | `/won-auctions` | `isAuth`, `getWonAuctions` |
| `GET`  | `/payment-status` | `isAuth`, `getPaymentStatus` |
| `POST` | `/payment` | `isAuth`, `ProcessPaymentDto`, `processPayment` |
| `POST` | `/payment/:paymentId/confirm` | `isAuth`, `confirmPayment` |

### Notification Routes (`/api/notifications`)
| Method | Path | Controller Method |
|--------|------|-------------------|
| `GET`  | `/` | `getNotifications` (Paginated) |
| `GET`  | `/unread-count` | `getUnreadCount` |
| `GET`  | `/stats` | `getNotificationStats` |
| `GET`  | `/category/:category` | `getNotificationsByCategory` |
| `PUT`  | `/:id/read` | `markAsRead` |
| `PUT`  | `/mark-all-read` | `markAllAsRead` |
| `DELETE`| `/:id` | `deleteNotification` |
| `POST` | `/test` | `CreateTestNotificationDto`, `createTestNotification` |

### Chat Routes (`/chat`)
| Method | Path | Controller Method |
|--------|------|-------------------|
| `GET`  | `/admin/get-all` | `isAuth`, `getAllConversation` |
| `GET`  | `/conversations/me` (aliases: `/conversation/me`, `/support-conversations`, `/customer-support`) | `isAuth`, `getMyConversation` |
| `GET`  | `/conversation/:id` | `isAuth`, `getConversationById` |
| `POST` | `/conversation` (alias: `/support-conversation`) | `isAuth`, `createConversation` |
| `POST` | `/message` | `isAuth`, `CreateMessageDto`, `createMessage` |
| `GET`  | `/get-message-by-user` | `isAuth`, `getAllMessageByUserId` |

### Support Chat Routes (`/api/support-chat`)
| Method | Path | Controller Method |
|--------|------|-------------------|
| `POST` | `/start` | `startSupportChat` |
| `GET`  | `/my-chat` | `getMyChat` |
| `POST` | `/send-message` | `sendMessage` |
| `GET`  | `/messages/:chatId` | `getChatMessages` |
| `PUT`  | `/mark-as-read/:chatId`| `markMessagesAsRead` |
| `POST` | `/messages/product-grid` | `sendProductGridMessage` (ProductGridMessageDto) |
| `GET`  | `/products/batch` | `getBatchProducts` |

### Time Routes (`/api/time`)
| Method | Path | Controller Method |
|--------|------|-------------------|
| `GET`  | `/current` | Returns server time |
| `GET`  | `/auction/:auctionId/remaining` | Time remaining for specific auction |
| `POST` | `/auctions/batch` | Batch check remaining time |
| `GET`  | `/sync` | Generic sync endpoint |

---

## 3. API Contracts (Data Transfer Objects)

These strict contracts are defined within the `src/dtos` directory. When refactoring, these exact payloads must be accepted by the controllers.

### 3.1 Authentication & User Contracts (`auth.dto.ts`)
```typescript
interface CheckUserDto {
  userName?: string;
  email?: string;
  phone?: string;
  identity?: string;
}

interface LoginDto {
  userName?: string;
  password?: string;
}

interface RegisterDto {
  userName?: string;
  password?: string;
  full_name?: string;
  email?: string;
  identity?: string;
  phone?: string;
}

interface ForgotPasswordDto {
  email?: string;
}

interface ResetPasswordDto {
  token?: string;
  newPassword?: string;
}

interface ChangePasswordDto {
  oldPassword?: string;
  newPassword?: string;
}
```

### 3.2 Auction & Bidding Contracts (`listing-auction.dto.ts`, `auction-bid.dto.ts`, `update-product.dto.ts`)
```typescript
class ListingAuctionDto {
  name: string; // required
  category_id: string; // required
  description?: string;
  condition?: string; // 'new' | 'used' | 'refurbished'
  starting_price: number; // >= 0
  buy_now_price?: number; // >= 0
  reserve_price?: number; // >= 0
  bid_increment?: number; // >= 0
  start_date: string; // required
  end_date: string; // required
}

class UpdateProductDto {
  name?: string;
  category_id?: string;
  description?: string;
  condition?: string; // 'new' | 'used' | 'refurbished'
}

// Emitted likely via Socket or API when a bid is placed
class AuctionBidDto {
  amount: number; // >= 0
  isAuto?: boolean;
  limitBid?: number; // >= 0
  incrementAmount?: number; // >= 0
}
```

### 3.3 Orders & Payments Contracts (`process-payment.dto.ts`)
```typescript
class ProcessPaymentDto {
  orderIds: string[]; // Required, must not be empty
  paymentMethod: string; // Required
}
```

### 3.4 Chat & Support Contracts (`create-message.dto.ts`, `product-grid-message.dto.ts`)
```typescript
class CreateMessageDto {
  conversationId: string; // Required
  message: string; // Required
}

class ProductGridMessageDto {
  chatId: string; // Required
  productIds: string[]; // Required, non-empty array
  message?: string;
  gridConfig?: any; // Object
}
```

### 3.5 Notifications Contracts (`create-test-notification.dto.ts`)
```typescript
class CreateTestNotificationDto {
  type?: string;
  title?: string;
  message?: string;
}
```

### 3.6 Admin Contracts (`admin.dto.ts`)
```typescript
class GetAllUserQueryDTO {
  page?: string;
  limit?: string;
  keyword?: string;
  status?: string;
}

class UpdateUserStatusDTO {
  id: string; // Required
}

class GetAllAuctionQueryDTO {
  page?: string;
  limit?: string;
  keyword?: string;
}

class GetStatisticDTO {}
```

## Summary for Refactoring
- **Middleware integrity**: Make sure validation (`dtoValidationMiddleware`), rate limiters (`rateLimiters`), sanitization (`sanitizeInput`), and authentication (`isAuth`) remain attached to their respective routes.
- **DTOs structure**: Do not alter the DTO field names unless corresponding frontend payloads are simultaneously updated. Validation rules (e.g., `Min(0)`, `@IsEnum`) must be preserved to prevent regressions in security/data integrity.
- **Ignore swagger**: Trust these DTOs and route files over the `swagger.yaml` definitions.
