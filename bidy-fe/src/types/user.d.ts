export interface BodyRegisterRequest {
  userName: string;
  password: string;
  fullName: string; // Backend expects 'fullName', not 'full_name'
  email: string;
  identity: string;
  phone: string;
}

export interface BodySigninRequest {
  identifier: string;
  password: string;
  /**
   * Do FE sinh (xem `lib/device-id.ts`). Không gửi thì BE tự sinh UUID và chỉ
   * nhúng vào refresh token — FE sẽ không biết `deviceId` để gọi logout.
   */
  deviceId?: string;
}

export interface BodyUpdateUserRequest {
  fullName: string;
  email: string;
  identity: string;
  phone: string;
}

export interface BodyChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface BodyForgotPasswordRequest {
  email: string;
}

export interface BodyResetPasswordRequest {
  userId: string;
  token: string;
  newPassword: string;
}

export interface BodyCheckUserRequest {
  email: string;
  phone: string;
  identity: string;
  userName: string;
}

export interface ParamsWishlistAdd {
  id: string;
}

export interface ParamsWishlistRemove {
  id: string;
}

export interface User {
  _id?: string;
  idUser?: string; // Support both _id and idUser for compatibility
  username?: string;
  fullname?: string;
  avatarUrl?: string;
  email?: string;
  password?: string;
  identity?: string;
  phone?: string;
  role?: "user" | "admin" | string | undefined;
  status?: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

/**
 * Sản phẩm trong danh sách yêu thích — `GET /users/wishlist`.
 *
 * Backend trả thẳng entity TypeORM với `relations: { auction: { product: true } }`,
 * nên tên field là camelCase (`auctionId`, `auction.product`), KHÔNG phải
 * `auction_id` như các endpoint cũ. Giá là cột `decimal` nên về dạng chuỗi.
 * Lưu ý: `product.images` không nằm trong relations → payload này không có ảnh.
 */
export interface WishlistAuctionProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  condition?: string;
  status?: string;
  categoryId?: string;
  ownerId?: string;
}

export interface WishlistAuction {
  id: string;
  productId: string;
  product?: WishlistAuctionProduct;
  startingPrice?: string;
  currentPrice?: string;
  buyNowPrice?: string | null;
  status?: string;
  bidderCount?: number;
  totalBids?: number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  auctionId: string;
  auction?: WishlistAuction;
  createdAt?: string;
}

export interface WishlistResponse {
  wishlist: WishlistItem[];
  totalWishlist: number;
  totalPages: number;
  currentPage: number;
}

export interface UserCookie {
  idUser: string;
  email: string;
  role: string;
}

export interface AdminGetAllUsersParams {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: string;
}
export type AdminGetAllAuctionsParams = Omit<AdminGetAllUsersParams, "status">;
export type AdminGetAllCategoriesParams = AdminGetAllUsersParams;
export interface AdminCreateCategoryRequest {
  name: string;
}

export interface UserStats {
  sell: {
    totalRevenue: string;
    highestAuction: string;
    soldAmount: number;
    sellingAmount: number;
    willSellAmount: number;
  };
  buy: {
    totalSpending: string;
    bidAmount: number;
    boughtAmount: number;
    biddingAmount: number;
    followAmount: number;
  };
}
