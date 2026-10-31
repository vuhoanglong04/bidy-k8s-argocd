export const APP_ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  CONTACT: "/contact",
  POLICIES: "/policies",
  POLICY: (slug: string) => `/policies/${slug}`,
  GUIDE: "/guide",
  SIGN_IN: "/signin",
  SIGN_UP: "/signup",
  FORGOT_PASS: "/forgot-password",
  RESET_PASS: "/reset-password",
  VERIFY_EMAIL: "/verify-email",
  PROFILE: "/profile",
  SETTINGS: "/profile/settings",
  DASHBOARD: "/dashboard",
  USERS: "/dashboard/users",
  NOT_FOUND: "*",
  NOTIFICATIONS: "/notifications",
  /** Màn hình chặn khi tài khoản bị suspend/ban hoặc phiên bị thu hồi. */
  ACCOUNT_LOCKED: "/account-locked",
  CATEGORY: "/category",
  CATEGORY_ALL: "/category/all",
  CATEGORY_DETAIL: (slug: string) => `/category/${slug}`,
  CATEGORY_SEARCH: (keyword: string) =>
    `/category/all?search=${encodeURIComponent(keyword)}`,
  // Hai luồng tách riêng: product là kho hàng, auction là một lần rao bán món
  // hàng đó. `/product/new` trước đây trỏ vào form đấu giá — tên lệch, đã dời
  // sang AUCTION_NEW.
  PRODUCT_NEW: "/product/new",
  /** Sửa sản phẩm dùng lại wizard tạo mới, mở bằng `?edit=<productId>`. */
  PRODUCT_EDIT: (productId: string) => `/product/new?edit=${productId}`,
  MY_PRODUCTS: "/profile/products",
  MY_WALLET: "/profile/wallet",
  MY_ORDERS: "/profile/orders",
  MY_AUCTIONS: "/profile/auctions",
  MY_BIDS: "/profile/bids",
  MY_WISHLIST: "/profile/wishlist",
  MY_NOTIFICATIONS: "/profile/notifications",
  MY_AUCTION_REQUESTS: "/profile/auction-requests",
  MY_MESSAGES: "/profile/messages",
  AUCTION_NEW: "/auction/new",
  PRODUCT_DETAIL: (id: string | number) => `/product/${id}`,
  ADMIN: "/admin",
  ADMIN_FINANCE: "/admin?tab=finance",
  ADMIN_SUPPORT_CHAT: "/admin/support-chat",
  ADMIN_SUPPORT_CHAT_DETAIL: (chatId: string) => `/admin/support-chat/${chatId}`,
  ADMIN_SUPPORT_CHAT_SELECT: (chatId: string) =>
    `/admin/support-chat?chat=${chatId}`,
};
export const API_ROUTES = {
  // auth
  SIGN_IN: "/auth/login",
  SIGN_UP: "/auth/register",
  FORGOT_PASS: "/auth/forgot-password",
  RESET_PASS: "/auth/reset-password",
  VERIFY: "/auth/verify",
  REFRESH_TOKEN: "/auth/refresh",
  LOGOUT: "/auth/logout",
  LOGOUT_ALL: "/auth/logout-all",

  // user
  USER_STATS: "/users/stats",
  CHECK_USER: "/users/check",
  PROFILE: "/users/profile",
  UPDATE_USER: "/users/update",
  UPDATE_AVATAR: "/users/avatar",
  CHANGE_PASS: "/users/changePassword",
  WISHLIST: "/users/wishlist",
  WISHLIST_ADD: "/users/wishlist/add/:id",
  WISHLIST_REMOVE: "/users/wishlist/remove/:id",
  WISHLIST_REMOVE_ALL: "/users/wishlist/removeAll",

  // Sổ địa chỉ giao hàng. Backend luôn lấy user từ token, không nhận userId.
  ADDRESSES: "/users/addresses",
  ADDRESS_BY_ID: (id: string) => `/users/addresses/${id}`,
  ADDRESS_SET_DEFAULT: (id: string) => `/users/addresses/${id}/default`,

  // Support chat người dùng — bộ chuẩn REST (`/users/support/*`) thay cho
  // `/support-chat/*` cũ đã bị backend gỡ.
  USER_SUPPORT_CHAT: "/users/support/chat",
  USER_SUPPORT_CHAT_MESSAGES: (chatId: string) =>
    `/users/support/chat/${chatId}/messages`,

  // notification
  NOTIFICATIONS: "/notifications",
  NOTIFICATIONS_UNREAD_COUNT: "/notifications/unread-count",
  NOTIFICATIONS_STATS: "/notifications/stats",
  NOTIFICATIONS_BY_CATEGORY: (category: string) => `/notifications/category/${category}`,
  NOTIFICATION_BY_ID: (id: string) => `/notifications/${id}`,
  NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
  NOTIFICATIONS_MARK_ALL_READ: "/notifications/mark-all-read",
  NOTIFICATIONS_TEST: "/notifications/test",

  // product — kho hàng của seller, tách khỏi luồng auction.
  // Tạo ra ở status `draft`; publish bằng PRODUCT_PUBLISH (cần ≥1 ảnh).
  PRODUCT_CREATE: "/products",
  PRODUCT_BY_ID: (id: string) => `/products/${id}`,
  PRODUCT_IMAGES: (id: string) => `/products/${id}/images`,
  PRODUCT_PUBLISH: (id: string) => `/products/${id}/publish`,
  MY_PRODUCTS: "/me/products",

  // file — upload trả về { id, url (presigned), expiresIn }; URL hết hạn thì
  // mint lại bằng FILE_URL. Avatar đi đường riêng qua UPDATE_AVATAR.
  FILE_UPLOAD: "/files",
  FILE_URL: (id: string) => `/files/${id}/url`,

  // seller — thông tin công khai và danh sách phiên của người bán (public)
  SELLER_PROFILE: (sellerId: string) => `/sellers/${sellerId}`,
  SELLER_AUCTIONS: (sellerId: string) => `/sellers/${sellerId}/auctions`,

  // auction request — luồng duyệt phiên: người bán nộp, admin duyệt
  AUCTION_REQUESTS: "/auction-requests",
  AUCTION_REQUEST_BY_ID: (id: string) => `/auction-requests/${id}`,
  MY_AUCTION_REQUESTS: "/me/auction-requests",

  // auction
  AUCTION_LISTING: "/auctions",
  AUCTION_CATEGORIES: "/categories",
  AUCTION_MY: "/auctions/user/my-auctions",
  AUCTION_CART: "/auctions/user/cart",
  // Single listing endpoint; pass `status` as a query param to filter, omit for all.
  AUCTION_LIST: "/auctions",
  AUCTION_USER_BY_STATUS: (id: string, status: string) =>
    `/auctions/user/status/${status}/${id}`,
  AUCTION_USER_BUY: (id: string) => `/auctions/user/bought/${id}`,
  AUCTION_USER_SELL: (id: string) => `/auctions/user/sold/${id}`,
  AUCTION_BY_CATEGORY: (category: string) => `/auctions/category/${category}`,
  AUCTION_BY_ID: (id: string) => `/auctions/${id}`,
  AUCTION_SEARCH: (keyword: string) => `/auctions/search/${keyword}`,
  AUCTION_BUY_NOW: (id: string) => `/auctions/${id}/buy-now`,
  AUCTION_BID: (id: string) => `/auctions/${id}/bid`,
  AUCTION_BIDDERS: (id: string) => `/auctions/${id}/bidders`,
  AUCTION_BID_HISTORY: (id: string) => `/auctions/${id}/bid-history`,
  AUCTION_USER_BID_HISTORY: "/auctions/user/bid-history",
  // Auto-bid (proxy bidding) — cùng một path cho cả 3 method:
  //   POST   bật, body { limitBid }   (BE tự tính giá, KHÔNG gửi amount/increment)
  //   GET    đọc trạng thái của chính chủ { isActive, limitBid, currentAmount }
  //   DELETE tắt
  // `limitBid` là thông tin bí mật, chỉ chính chủ đọc được — không bao giờ
  // xuất hiện trong payload công khai như top_ownerships.
  AUCTION_AUTO_BID: (id: string) => `/auctions/${id}/auto-bid`,
  AUCTION_DELETE: (id: string) => `/auctions/${id}`,
  // Huỷ phiên đấu giá dành cho người bán (owner-only)
  AUCTION_CANCEL: (id: string) => `/auctions/${id}/cancel`,

  // order & payment
  ORDER_WON_AUCTIONS: "/orders/won-auctions",
  ORDER_PAYMENT_QR: (id: string) => `/orders/${id}/payment-qr`,
  ORDER_STATUS: (id: string) => `/orders/${id}/status`,
  ORDER_PAY: (id: string) => `/orders/${id}/pay`,

  // wallet
  WALLET: "/wallet",
  WALLET_TRANSACTIONS: "/wallet/transactions",
  WALLET_SUMMARY: "/wallet/summary",
  WALLET_TOPUP: "/wallet/topup",
  WALLET_WITHDRAWALS: "/wallet/withdrawals",
  WALLET_WITHDRAWAL_BY_ID: (id: string) => `/wallet/withdrawals/${id}`,

  //admin
  // Bộ đếm tổng quan cho dashboard — mỗi nhóm một aggregate riêng, thay cho
  // endpoint gộp `/admin/get-statistic` đã bị backend gỡ.
  ADMIN_OVERVIEW_USERS: "/admin/overview/users",
  ADMIN_OVERVIEW_AUCTIONS: "/admin/overview/auctions",
  ADMIN_OVERVIEW_CATEGORIES: "/admin/overview/categories",

  // Quản lý người dùng — bộ endpoint hiện hành trong openapi (`/admin/users/*`).
  // Endpoint cũ `/admin/get-all-user` và `/admin/update-status-user/:id` đã bị
  // backend gỡ, không map lại.
  ADMIN_USERS: "/admin/users",
  ADMIN_USER_BY_ID: (id: string) => `/admin/users/${id}`,
  ADMIN_USER_ROLE: (id: string) => `/admin/users/${id}/role`,
  ADMIN_USER_SUSPEND: (id: string) => `/admin/users/${id}/suspend`,
  ADMIN_USER_ACTIVATE: (id: string) => `/admin/users/${id}/activate`,
  ADMIN_USER_BAN: (id: string) => `/admin/users/${id}/ban`,
  ADMIN_USER_UNLOCK: (id: string) => `/admin/users/${id}/unlock`,
  ADMIN_USER_REVOKE_SESSIONS: (id: string) => `/admin/users/${id}/revoke-sessions`,
  ADMIN_USER_FORCE_PASSWORD_RESET: (id: string) =>
    `/admin/users/${id}/force-password-reset`,
  ADMIN_USER_AUDIT_LOGS: (id: string) => `/admin/users/${id}/audit-logs`,

  // Danh mục — CRUD nằm ở `/admin/categories/*`, nhưng KHÔNG có endpoint list
  // riêng cho admin: đọc bằng `GET /categories` công khai (bỏ filter isActive
  // để thấy cả danh mục đang ẩn). Bộ `/admin/create-category`,
  // `/admin/update-category/:id`, `/admin/delete-category/:id` đã bị gỡ.
  ADMIN_CATEGORIES: "/admin/categories",
  ADMIN_CATEGORY_BY_ID: (id: string) => `/admin/categories/${id}`,
  ADMIN_CATEGORY_STATUS: (id: string) => `/admin/categories/${id}/status`,

  // Support chat phía admin — backend đặt ở `/admin/support/chats`, KHÔNG phải
  // `/admin/support-chats`: `support` và `chats` là hai segment tách rời.
  // axiosClient đã có baseURL `.../api/v1`, nên không thêm `/api` ở đây.
  ADMIN_SUPPORT_CHATS: "/admin/support/chats",
  ADMIN_SUPPORT_CHAT_BY_ID: (chatId: string) => `/admin/support/chats/${chatId}`,
  ADMIN_SUPPORT_CHAT_MESSAGES: (chatId: string) =>
    `/admin/support/chats/${chatId}/messages`,
  ADMIN_SUPPORT_CHAT_READ: (chatId: string) =>
    `/admin/support/chats/${chatId}/read`,
  ADMIN_SUPPORT_CHAT_STATUS: (chatId: string) =>
    `/admin/support/chats/${chatId}/status`,
  ADMIN_SUPPORT_CHATS_UNREAD_COUNT: "/admin/support/chats/unread-count",

  ADMIN_AUCTIONS: "/admin/auctions",
  ADMIN_AUCTION_CANCEL: (id: string) => `/admin/auctions/${id}/cancel`,
  ADMIN_STATISTICS_AUCTIONS: "/admin/statistics/auctions",
  ADMIN_STATISTICS_USERS: "/admin/statistics/users",

  // Duyệt yêu cầu đăng phiên đấu giá phía admin
  ADMIN_AUCTION_REQUESTS: "/admin/auction-requests",
  ADMIN_AUCTION_REQUEST_BY_ID: (id: string) => `/admin/auction-requests/${id}`,
  ADMIN_AUCTION_REQUEST_APPROVE: (id: string) =>
    `/admin/auction-requests/${id}/approve`,
  ADMIN_AUCTION_REQUEST_REJECT: (id: string) =>
    `/admin/auction-requests/${id}/reject`,

  // Tài chính & Ví admin
  ADMIN_WALLET_OVERVIEW: "/admin/wallet/overview",
  ADMIN_WALLET_ESCROW: "/admin/wallet/escrow",
  ADMIN_WALLET_ADJUSTMENT: "/admin/wallet/adjustment",
  ADMIN_WALLET_WITHDRAWALS: "/admin/wallet/withdrawals",
  ADMIN_WALLET_WITHDRAWAL_PROCESS: (id: string) =>
    `/admin/wallet/withdrawals/${id}/process`,
  ADMIN_WALLET_WITHDRAWAL_COMPLETE: (id: string) =>
    `/admin/wallet/withdrawals/${id}/complete`,
  ADMIN_WALLET_WITHDRAWAL_REJECT: (id: string) =>
    `/admin/wallet/withdrawals/${id}/reject`,
  ADMIN_ORDER_RELEASE: (id: string) => `/admin/orders/${id}/release`,
  ADMIN_ORDER_REFUND: (id: string) => `/admin/orders/${id}/refund`,
};

export const PUBLIC_ROUTES = [
  APP_ROUTES.SIGN_IN,
  APP_ROUTES.SIGN_UP,
  APP_ROUTES.FORGOT_PASS,
  APP_ROUTES.RESET_PASS,
  APP_ROUTES.VERIFY_EMAIL,
  APP_ROUTES.HOME,
  APP_ROUTES.ABOUT,
  APP_ROUTES.POLICIES,
  APP_ROUTES.CONTACT,
  APP_ROUTES.GUIDE,
  APP_ROUTES.CATEGORY,
  APP_ROUTES.CATEGORY_ALL,
];

export const PROTECTED_ROUTES = Object.entries(APP_ROUTES)
  .filter(
    ([, value]) => typeof value === "string" && !PUBLIC_ROUTES.includes(value)
  )
  .map(([, value]) => value as string);
