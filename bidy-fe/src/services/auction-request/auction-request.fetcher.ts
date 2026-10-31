import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";
import type { ApiPagination } from "@/services/auction.mapper";

/**
 * Trạng thái của yêu cầu đăng phiên đấu giá:
 * - pending: Chờ quản trị viên duyệt
 * - approved: Đã được duyệt (auctionId có giá trị trỏ tới phiên thật)
 * - rejected: Bị từ chối (rejectReason chứa lý do từ chối để người bán biết và sửa)
 * - cancelled: Người bán tự rút lại yêu cầu
 */
export type AuctionRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Thông tin sản phẩm gắn kèm yêu cầu đăng phiên. */
export interface AuctionRequestProduct {
  /** ID sản phẩm (bigint dạng chuỗi). */
  id: string;
  name: string;
  slug?: string;
  condition?: string;
  status?: string;
  /**
   * URL ảnh chính (presigned có hạn 1 tiếng, có thể null).
   * Render trực tiếp, KHÔNG cache vì URL sẽ hết hạn.
   */
  primaryImage?: string | null;
}

/**
 * Chi tiết một yêu cầu đăng phiên đấu giá.
 * - Mọi ID đều là chuỗi (bigint), không ép kiểu sang number.
 * - Khi status = 'approved', auctionId có giá trị để điều hướng sang phiên thật.
 * - Khi status = 'rejected', rejectReason chứa lý do từ chối.
 */
export interface AuctionRequest {
  /** ID yêu cầu (bigint dạng chuỗi). */
  id: string;
  /** ID sản phẩm (bigint dạng chuỗi). */
  productId: string;
  /** ID người bán (bigint dạng chuỗi). */
  sellerId: string;
  status: AuctionRequestStatus;
  quantity: number;
  startingPrice: number;
  buyNowPrice: number | null;
  reservePrice: number | null;
  bidIncrement: number | null;
  /** Thời gian bắt đầu dự kiến (ISO string). */
  startDate: string;
  /** Thời gian kết thúc dự kiến (ISO string). */
  endDate: string;
  /** Lý do từ chối từ ban quản trị (có giá trị khi status = 'rejected'). */
  rejectReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** ID phiên đấu giá thật sau khi được admin duyệt (có giá trị khi status = 'approved'). */
  auctionId: string | null;
  createdAt: string;
  updatedAt: string;
  product?: AuctionRequestProduct | null;
}

/** Body tạo yêu cầu đăng phiên (JSON camelCase, không dùng multipart). */
export interface CreateAuctionRequestBody {
  productId: string;
  quantity?: number;
  startingPrice: number;
  buyNowPrice?: number | null;
  reservePrice?: number | null;
  bidIncrement?: number | null;
  /** ISO string. */
  startDate: string;
  /** ISO string. */
  endDate: string;
}

/** Body cập nhật yêu cầu đăng phiên khi còn pending. */
export interface UpdateAuctionRequestBody {
  quantity?: number;
  startingPrice?: number;
  buyNowPrice?: number | null;
  reservePrice?: number | null;
  bidIncrement?: number | null;
  /** ISO string. */
  startDate?: string;
  /** ISO string. */
  endDate?: string;
}

export interface MyAuctionRequestsParams {
  page?: number;
  limit?: number;
  status?: AuctionRequestStatus;
}

export interface MyAuctionRequestsResponse {
  items: AuctionRequest[];
  pagination: ApiPagination;
}

/** Bảng map error_code từ backend sang thông điệp tiếng Việt. */
export const AUCTION_REQUEST_ERROR_MESSAGES: Record<string, string> = {
  REQUEST_ALREADY_PENDING: "Sản phẩm này đã có một yêu cầu đang chờ duyệt",
  REQUEST_NOT_PENDING: "Yêu cầu đã được xử lý, không sửa được nữa",
  REQUEST_SCHEDULE_EXPIRED: "Thời gian kết thúc đã qua, vui lòng chọn lại lịch",
  INVALID_DATE_RANGE: "Khoảng thời gian không hợp lệ",
  PRODUCT_NOT_AUCTIONABLE: "Sản phẩm chưa đủ điều kiện đấu giá",
  PRODUCT_HAS_LIVE_AUCTION: "Sản phẩm đang có phiên đấu giá",
  REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu",
};

/** Lấy thông điệp lỗi dựa theo `error_code` top-level của response. */
export function getAuctionRequestErrorMessage(
  error: unknown,
  fallback: string = "Đã xảy ra lỗi, vui lòng thử lại"
): string {
  const data =
    error && typeof error === "object" && "response" in error
      ? (
          error.response as {
            data?: { error_code?: string; message?: string };
          } | undefined
        )?.data
      : undefined;

  const code = data?.error_code;
  if (code && AUCTION_REQUEST_ERROR_MESSAGES[code]) {
    return AUCTION_REQUEST_ERROR_MESSAGES[code];
  }
  return data?.message || fallback;
}

/** Nộp yêu cầu đăng phiên đấu giá (POST JSON). */
export const createAuctionRequest = async (
  body: CreateAuctionRequestBody
): Promise<AuctionRequest> => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_REQUESTS, body);
  return res.data?.data ?? res.data;
};

/** Lấy danh sách yêu cầu đăng phiên của người dùng hiện tại. */
export const fetchMyAuctionRequests = async (
  params?: MyAuctionRequestsParams
): Promise<MyAuctionRequestsResponse> => {
  const res = await axiosClient.get(API_ROUTES.MY_AUCTION_REQUESTS, { params });
  const envelope = res.data?.data ?? res.data;
  return {
    items: envelope?.items ?? [],
    pagination: envelope?.pagination ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
};

/** Lấy thông tin chi tiết một yêu cầu theo ID. */
export const fetchAuctionRequestById = async (
  id: string
): Promise<AuctionRequest> => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_REQUEST_BY_ID(id));
  return res.data?.data ?? res.data;
};

/** Chỉnh sửa yêu cầu đăng phiên (khi còn status pending). */
export const updateAuctionRequest = async (
  id: string,
  body: UpdateAuctionRequestBody
): Promise<AuctionRequest> => {
  const res = await axiosClient.patch(API_ROUTES.AUCTION_REQUEST_BY_ID(id), body);
  return res.data?.data ?? res.data;
};

/** Rút lại yêu cầu đăng phiên. */
export const deleteAuctionRequest = async (
  id: string
): Promise<{ success: boolean; message?: string }> => {
  const res = await axiosClient.delete(API_ROUTES.AUCTION_REQUEST_BY_ID(id));
  return res.data;
};

/* ==========================================================================
   ADMIN
   ========================================================================== */

export interface AdminAuctionRequestsParams {
  page?: number;
  limit?: number;
  status?: AuctionRequestStatus;
  search?: string;
}

export interface AdminAuctionRequestsResponse {
  items: AuctionRequest[];
  pagination: ApiPagination;
}

export interface ApproveAuctionRequestResponse {
  id: string;
  status: "approved";
  auctionId: string;
}

export interface RejectAuctionRequestResponse {
  id: string;
  status: "rejected";
  rejectReason: string;
}

/**
 * Lấy danh sách hàng đợi yêu cầu duyệt phiên phía admin (sắp xếp cũ trước - oldest first).
 */
export const fetchAdminAuctionRequests = async (
  params?: AdminAuctionRequestsParams
): Promise<AdminAuctionRequestsResponse> => {
  const res = await axiosClient.get(API_ROUTES.ADMIN_AUCTION_REQUESTS, { params });
  const envelope = res.data?.data ?? res.data;
  return {
    items: envelope?.items ?? [],
    pagination: envelope?.pagination ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? 10,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
};

/**
 * Admin chỉnh sửa điều khoản yêu cầu đăng phiên trước khi duyệt (giá, lịch, số lượng).
 */
export const updateAdminAuctionRequest = async (
  id: string,
  body: UpdateAuctionRequestBody
): Promise<AuctionRequest> => {
  const res = await axiosClient.patch(
    API_ROUTES.ADMIN_AUCTION_REQUEST_BY_ID(id),
    body
  );
  return res.data?.data ?? res.data;
};

/**
 * Admin duyệt yêu cầu đăng phiên (không body, trả về thông tin kèm auctionId).
 */
export const approveAuctionRequest = async (
  id: string
): Promise<ApproveAuctionRequestResponse> => {
  const res = await axiosClient.post(
    API_ROUTES.ADMIN_AUCTION_REQUEST_APPROVE(id)
  );
  return res.data?.data ?? res.data;
};

/**
 * Admin từ chối yêu cầu đăng phiên kèm lý do bắt buộc.
 */
export const rejectAuctionRequest = async (
  id: string,
  reason: string
): Promise<RejectAuctionRequestResponse> => {
  const res = await axiosClient.post(
    API_ROUTES.ADMIN_AUCTION_REQUEST_REJECT(id),
    { reason }
  );
  return res.data?.data ?? res.data;
};

