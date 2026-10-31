/**
 * One row of GET /api/v1/auctions — an Auction with its Product nested.
 * GET /api/v1/auctions/category/{id} returns the identical envelope and row
 * shape, so both endpoints share this mapper.
 */
export interface ApiAuction {
  id: string;
  status: string;
  startingPrice: number | string;
  currentPrice: number | string;
  buyNowPrice: number | string | null;
  startDate: string;
  endDate: string;
  createdAt?: string;
  /** Số người tham gia distinct — number thật, không phải string như các cột tiền. */
  bidderCount?: number;
  /** Tổng lượt bid — number thật. */
  totalBids?: number;
  productId?: string;
  product?: {
    id?: string;
    name?: string;
    description?: string;
    images?: { imageUrl?: string }[];
    /** Danh mục nằm ở product; `category` chỉ có khi endpoint populate relation. */
    categoryId?: string;
    category?: { id?: string; name?: string } | null;
    /**
     * Người bán đi theo product chứ không theo auction — hệ quả của việc tách
     * hai luồng. Cùng một product đấu giá lại nhiều lần vẫn chung một chủ.
     */
    ownerId?: string;
    owner?: {
      id?: string;
      username?: string;
    } | null;
  } | null;
}

/** Envelope phân trang dùng chung cho /auctions và /auctions/category/{id}. */
export interface ApiPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * The listing endpoint returns the auction with its product nested, while the
 * cards were written against the older flat shape. Normalising once here keeps
 * every screen off the raw payload — and postgres hands decimal columns back as
 * strings, so the prices have to be coerced rather than passed through.
 */
export function mapAuctionToFrontend(auction: ApiAuction) {
  const startingPrice = Number(auction.startingPrice) || 0;
  const currentPrice = Number(auction.currentPrice) || 0;

  return {
    id: auction.id,
    _id: auction.id,
    // ID của auction khác ID của product; sửa thông tin món hàng phải dùng productId.
    productId: auction.productId ?? auction.product?.id,
    name: auction.product?.name ?? "",
    description: auction.product?.description ?? "",
    image: (auction.product?.images ?? [])
      .map((image) => image.imageUrl)
      .filter((url): url is string => Boolean(url)),
    price: startingPrice,
    startPrice: startingPrice,
    startingPrice,
    currentPrice,
    currentBid: currentPrice,
    buyNow: auction.buyNowPrice != null ? Number(auction.buyNowPrice) : undefined,
    status: auction.status,
    type: auction.status,
    // Danh mục nằm ở `product.category`, không phải trên auction — màn "Đấu giá
    // của tôi" lọc theo nó nên phải kéo lên đây thay vì mỗi nơi tự đào lại.
    categoryId: auction.product?.categoryId ?? auction.product?.category?.id,
    categoryName: auction.product?.category?.name,
    startDate: auction.startDate,
    endDate: auction.endDate,
    createdAt: auction.createdAt ?? auction.startDate,
    bidderCount: auction.bidderCount ?? 0,
    totalBids: auction.totalBids ?? 0,
    // Card đọc `seller` trước, `owner.full_name` sau (xem `getSellerName`).
    // Để `undefined` khi thiếu tên để rơi đúng vào nhánh fallback.
    seller: auction.product?.owner?.username || undefined,
    owner: {
      _id: auction.product?.owner?.id ?? auction.product?.ownerId,
      full_name: auction.product?.owner?.username,
    },
  };
}

export type MappedAuction = ReturnType<typeof mapAuctionToFrontend>;

/**
 * Cron flip status mỗi 10s, nên `status=happening` vẫn có thể trả về phiên vừa
 * hết hạn trong cửa sổ đó. Lọc lại phía client cho chắc.
 *
 * @param now Thời điểm so sánh — truyền giờ server (đã hiệu chỉnh offset) thay
 * vì `Date.now()`, vì đồng hồ máy user có thể lệch.
 */
export function isStillLive(auction: Pick<MappedAuction, 'status' | 'endDate'>, now: number = Date.now()) {
  if (auction.status !== 'happening') return false;
  const endsAt = new Date(auction.endDate).getTime();
  return Number.isFinite(endsAt) ? endsAt > now : true;
}
