"use client";

import { useAuth } from "@/hooks";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Gavel,
  Zap,
  Bot,
  AlertCircle,
  Banknote,
  Target,
  CheckCircle2,
  CreditCard,
  PackageCheck,
  PowerOff,
} from "lucide-react";
import { Spinner } from "@/components/common/loading";
import { STATUS_AUCTIONS } from "@/constants/app.enum";
import { MAX_AUCTION_PRICE } from "@/constants";
import { fetchBid, fetchBuyNow } from "@/services/product/product.fetcher";
import {
  disableAutoBid,
  enableAutoBid,
  fetchAutoBidStatus,
  type AutoBidStatus,
} from "@/services/bid";
import { toast } from "sonner";
import logger from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { useWonAuctions } from "@/services/orders/orders.query";
import BuyNowSuccessModal from "@/components/ui/BuyNowSuccessModal";
import MoneyInput, { getNumericValue } from "@/components/ui/MoneyInput";

/**
 * `POST /auctions/{id}/buy-now` trả `error_code` ổn định trong body lỗi
 * (`apiResponse` đặt tham số thứ 3 vào field này khi status khác 'success');
 * `message` kèm theo là tiếng Anh thô nên không hiển thị thẳng cho người dùng.
 */
const BUY_NOW_ERRORS: Record<string, string> = {
  AUCTION_NOT_FOUND: "Phiên đấu giá không còn tồn tại.",
  BUY_NOW_NOT_AVAILABLE: "Phiên này không mở mua ngay.",
  AUCTION_NOT_ACTIVE: "Phiên đã kết thúc hoặc vừa có người mua trước bạn.",
  SELLER_CANNOT_BUY: "Bạn không thể mua sản phẩm của chính mình.",
  BUY_NOW_PRICE_EXCEEDED:
    "Giá đấu đã vượt giá mua ngay, vui lòng đặt giá thay vì mua ngay.",
  MISSING_SHIPPING_ADDRESS:
    "Bạn cần một địa chỉ giao hàng mặc định trước khi mua ngay. Thêm tại Cài đặt → Địa chỉ.",
};

function resolveBuyNowError(error: unknown): string {
  const response =
    error && typeof error === "object" && "response" in error
      ? (error.response as
          | { status?: number; data?: { error_code?: string } }
          | undefined)
      : undefined;

  const mapped = BUY_NOW_ERRORS[response?.data?.error_code ?? ""];
  if (mapped) return mapped;

  // Backend chỉ trả 5xx cho lỗi nó KHÔNG lường trước (mọi trường hợp nghiệp vụ
  // đều có error_code riêng). Nói đúng bản chất là sự cố hệ thống, đừng gợi ý
  // user thử lại như thể lỗi do thao tác của họ.
  if ((response?.status ?? 0) >= 500) {
    return "Hệ thống đang gặp sự cố, vui lòng thử lại sau ít phút.";
  }

  // Không nhận diện được code thì báo chung — tuyệt đối không đổ message
  // tiếng Anh của backend ra màn hình.
  return "Mua ngay thất bại. Vui lòng thử lại.";
}

interface ProductCTAProps {
  currentPrice: number;
  /** Giá hợp lệ nhỏ nhất kế tiếp do backend tính. 0 nghĩa là backend chưa trả. */
  minNextBid?: number;
  /**
   * **Auction id**, không phải product id — tên biến là di sản.
   * `GET /auctions/{id}` trả `_id = auction.id`, và route `/product/[id]` cũng
   * mang auction id. Cùng giá trị này đi vào `/auctions/{id}/buy-now` và dùng
   * để dò `order.bid_id._id` (cũng là auction id). Backend trả bigint dạng
   * chuỗi nên luôn so sánh qua `String()`.
   */
  productId?: number;
  productType?: string;
  refetchProduct?: () => void;
  currentUserId?: string;
  buyNowPrice?: number;
  auctionOwner?: {
    _id: string;
    [key: string]: unknown;
  };
}

export default function ProductCTA({
  currentPrice,
  minNextBid = 0,
  productId,
  productType,
  refetchProduct,
  productName,
  currentUserId,
  buyNowPrice = 0,
  auctionOwner,
}: ProductCTAProps & { productName?: string }) {
  const [bidInput, setBidInput] = useState("");
  const [bidError, setBidError] = useState("");
  const [autoLimit, setAutoLimit] = useState("");
  
  // Loading states
  const [isBidLoading, setIsBidLoading] = useState(false);
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const [isAutoBidLoading, setIsAutoBidLoading] = useState(false);
  const [isDisablingAutoBid, setIsDisablingAutoBid] = useState(false);
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [localAutoBidDisabled, setLocalAutoBidDisabled] = useState(false);
  const [autoBidStatus, setAutoBidStatus] = useState<AutoBidStatus | null>(null);
  const { user, isAuthenticated } = useAuth();

  /**
   * Trạng thái auto-bid đọc từ endpoint riêng của chính chủ.
   * KHÔNG đọc từ `topOwnerships`: payload đó công khai, không có `limitBid`
   * (trần giá là thông tin bí mật) và cũng không có `isAuto`.
   */
  // CẢNH BÁO: deps phải là `userId` (string), KHÔNG được là object `user`.
  // `useAuth` trả về `{ ...user, _id }` — object mới mỗi lần render — nên để
  // `user` trong deps thì effect chạy lại mỗi render, setState lại gây render,
  // thành vòng lặp vô hạn nã request (đo được ~500 request trong 0.5 giây).
  const authUserId = user?._id;

  useEffect(() => {
    if (!authUserId || !productId || productType !== STATUS_AUCTIONS.HAPPENING) {
      setAutoBidStatus(null);
      return;
    }

    let cancelled = false;
    fetchAutoBidStatus(productId.toString())
      .then((status) => {
        if (!cancelled) setAutoBidStatus(status);
      })
      .catch((error) => {
        // Chưa bật auto-bid thì BE trả 404 — không phải lỗi cần báo user
        logger.debug('Auto-bid status unavailable', { productId, error });
        if (!cancelled) setAutoBidStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [authUserId, productId, productType, localAutoBidDisabled]);

  const userAutoBidStatus = useMemo(() => {
    if (localAutoBidDisabled) return null;
    if (!autoBidStatus?.isActive) return null;
    return autoBidStatus;
  }, [autoBidStatus, localAutoBidDisabled]);

  const handleDisableAutoBid = useCallback(() => {
    if (!user || !productId) {
      toast.error(!user 
        ? "Vui lòng đăng nhập để tắt đấu giá tự động"
        : "Không thể tắt auto-bid"
      );
      return;
    }

    setIsDisablingAutoBid(true);
    
    disableAutoBid(productId.toString())
      .then((response) => {
        const message = response.success 
          ? response.message || "Đã tắt đấu giá tự động thành công!"
          : response.message || "Không thể tắt đấu giá tự động";
        
        toast[response.success ? 'success' : 'error'](message);
        
        if (response.success) {
          // Immediately update local state to hide auto-bid status
          setLocalAutoBidDisabled(true);
          
          // Also trigger data refetch
          if (refetchProduct) {
            refetchProduct();
          }
        }
      })
      .catch((error) => {
        logger.error("Auto-bid disable failed:", error);
        toast.error("Lỗi khi tắt đấu giá tự động. Vui lòng thử lại.");
      })
      .finally(() => {
        setIsDisablingAutoBid(false);
      });
  }, [user, productId, refetchProduct]);

  // Check if current user is the auction owner
  const isAuctionOwner = auctionOwner && currentUserId && String(auctionOwner._id) === String(currentUserId);
  logger.debug('ProductCTA owner check', { 
    isAuctionOwner, 
    auctionOwnerId: auctionOwner?._id, 
    currentUserId: String(currentUserId)
  });

  /**
   * Thắng phiên hay chưa: hỏi Order, KHÔNG suy từ `top_ownerships`.
   *
   * `top_ownerships` là lịch sử đặt giá, không phải tuyên bố người thắng —
   * sort nó ra người cao nhất sẽ sai ở luồng "mua ngay" (người mua không nhất
   * thiết đứng đầu nếu giá mua ngay thấp hơn giá đang đấu). Backend tạo Order
   * cho cả hai đường kết thúc (cron hết giờ và mua ngay), nên Order là nguồn
   * sự thật duy nhất cho cả "ai thắng" lẫn "đã trả tiền chưa".
   */
  const queryClient = useQueryClient();
  // Chỉ nhánh ENDED đọc order; phiên đang chạy chuyển sang ENDED thì query tự bật.
  const { data: ordersData, isLoading: isCheckingPayment } = useWonAuctions({
    enabled: isAuthenticated && productType === STATUS_AUCTIONS.ENDED,
  });

  const wonOrder = useMemo(
    () =>
      ordersData?.orders?.find(
        (order) =>
          String(order.auctionId) === String(productId) ||
          String(order.bidId?.id) === String(productId)
      ) ?? null,
    [ordersData, productId]
  );

  const isWinner = Boolean(wonOrder);
  const hasPaid = wonOrder?.paymentStatus === "paid";
  const winnerAmount = wonOrder ? Number(wonOrder.price ?? 0) : 0;

  if (productType === STATUS_AUCTIONS.ENDED) {
    // Chưa biết có order hay không thì chưa kết luận thắng/thua được. Chỉ hiện
    // dòng chờ cho người đã đăng nhập — khách vãng lai không bao giờ có order.
    if (isCheckingPayment && user) {
      return (
        <div className="flex flex-col w-full">
          <div className="w-full h-12 border border-border bg-muted text-muted-foreground font-semibold flex items-center justify-center gap-2">
            <Spinner size="sm" tone="muted" />
            Đang kiểm tra trạng thái thanh toán...
          </div>
        </div>
      );
    }

    if (isWinner) {
      if (hasPaid) {
        return (
          <div className="flex flex-col w-full gap-2">
            <div className="w-full h-12 bg-success text-success-foreground font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              Đã thanh toán thành công
            </div>
            <p className="text-xs text-foreground-secondary text-center">
              Cảm ơn bạn đã mua sản phẩm này
            </p>
          </div>
        );
      } else {
        // Show payment button for winner who hasn't paid
        const paymentUrl = `/payment?productId=${productId}&amount=${winnerAmount}&name=${encodeURIComponent(
          productName || ""
        )}`;
        return (
          <div className="flex flex-col w-full gap-2">
            <a
              href={paymentUrl}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary-hover font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              Thanh toán ngay ({(winnerAmount ?? 0).toLocaleString("vi-VN")} VNĐ)
            </a>
            <p className="text-xs text-foreground-secondary">
              *Quý khách vui lòng thanh toán trong vòng 24h sau khi kết thúc phiên
              đấu giá để chính thức sở hữu sản phẩm mong muốn
            </p>
          </div>
        );
      }
    } else {
      // Hide CTA for non-winners
      return null;
    }
  }

  // Show owner message for auction owners
  if (isAuctionOwner) {
    return (
      <div className="flex flex-col w-full gap-2">
        <div className="w-full h-12 bg-info text-info-foreground font-semibold flex items-center justify-center gap-2">
          <PackageCheck size={18} />
          Đây là sản phẩm của bạn
        </div>
        <p className="text-xs text-foreground-secondary text-center">
          Bạn không thể đấu giá sản phẩm của chính mình
        </p>
      </div>
    );
  }

  const handleBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is authenticated
    if (!user) {
      toast.error("Vui lòng đăng nhập để đặt giá");
      logger.warn('Unauthenticated user attempted to place bid', { productId });
      return;
    }

    logger.info('User placing bid', { userId: user._id, productId, bidInput });

    const bidAmount = getNumericValue(bidInput);
    const floor = minNextBid || currentPrice + 1;
    if (!bidAmount || bidAmount < floor) {
      setBidError(
        `Giá đặt tối thiểu là ${floor.toLocaleString("vi-VN")} VNĐ`
      );
      return;
    }

    if (bidAmount > MAX_AUCTION_PRICE) {
      const message = `Giá đặt không được vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
      setBidError(message);
      toast.error(message);
      return;
    }
    
    // Check if bid exceeds buy now price
    if (buyNowPrice > 0 && bidAmount >= buyNowPrice) {
      setBidError(
        `Bid không được bằng hoặc vượt quá giá mua ngay ${(buyNowPrice ?? 0).toLocaleString("vi-VN")} VNĐ`
      );
      return;
    }
    
    setBidError("");
    if (productId) {
      setIsBidLoading(true);
      fetchBid(productId.toString(), bidAmount)
        .then(() => {
          setBidInput("");
          toast.success("Đặt giá thành công!");
          if (refetchProduct) refetchProduct();
        })
        .catch((error) => {
          logger.error('Bid placement failed', error, { userId: user._id, productId, bidAmount });
          
          // Extract error message from backend response
          const errorMessage = error?.response?.data?.message || "Đặt giá thất bại. Vui lòng thử lại.";
          setBidError(errorMessage);
          toast.error(errorMessage);
        })
        .finally(() => {
          setIsBidLoading(false);
        });
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để mua nhanh");
      return;
    }

    if (productId) {
      setIsBuyNowLoading(true);
      fetchBuyNow(productId.toString())
        .then(() => {
          setShowBuyNowModal(true);
          // Refetch ngay, không đợi user đóng modal: người mua cần thấy nút
          // thanh toán liền, và không nên phụ thuộc vào socket event có thể rớt.
          if (refetchProduct) refetchProduct();

          // Nút thanh toán đọc từ `won-auctions`, KHÔNG phải từ query sản phẩm
          // — refetch mỗi sản phẩm là chưa đủ, nút sẽ không hiện cho tới nhịp
          // refetchInterval kế tiếp. Backend commit Order trong cùng transaction
          // của buy-now nên gọi lại ngay sau khi POST resolve là chắc chắn thấy.
          queryClient.invalidateQueries({ queryKey: ['won-auctions'] });
        })
        .catch((error) => {
          const message = resolveBuyNowError(error);
          logger.error('Buy now failed', error, { productId });
          setBidError(message);
          toast.error(message);
        })
        .finally(() => {
          setIsBuyNowLoading(false);
        });
    }
  };

  const handleAutoBid = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để đấu giá tự động");
      return;
    }

    const limit = getNumericValue(autoLimit);

    if (!limit) {
      setBidError("Vui lòng nhập giới hạn tối đa hợp lệ.");
      toast.error("Vui lòng nhập giới hạn tối đa hợp lệ.");
      return;
    }

    // Chặn sớm trường hợp rõ ràng sai. `currentPrice` là snapshot lúc tải trang,
    // không phải hợp đồng — backend vẫn là trọng tài cuối và có thể trả 400.
    const floor = minNextBid || currentPrice;
    if (limit < floor) {
      const message = `Giới hạn tối đa phải từ ${floor.toLocaleString("vi-VN")} VNĐ trở lên`;
      setBidError(message);
      toast.error(message);
      return;
    }

    if (limit > MAX_AUCTION_PRICE) {
      const message = `Giới hạn tối đa không được vượt quá ${Math.floor(MAX_AUCTION_PRICE).toLocaleString("vi-VN")} VNĐ`;
      setBidError(message);
      toast.error(message);
      return;
    }

    setBidError("");
    if (productId) {
      setIsAutoBidLoading(true);

      // Chỉ gửi trần giá. Backend tự tính giá đặt theo `auction.bid_increment`
      // — không tính ở client để tránh race với người bid xen vào.
      enableAutoBid(productId.toString(), limit)
        .then(() => {
          setAutoLimit("");
          toast.success("Đã bật đấu giá tự động!");

          // Reset local disabled state when auto-bid is activated
          setLocalAutoBidDisabled(false);

          if (refetchProduct) refetchProduct();
        })
        .catch((error) => {
          const message = error?.response?.data?.message || "Bật đấu giá tự động thất bại. Vui lòng thử lại.";
          logger.error('Auto-bid enable failed', error, { productId, limit });
          setBidError(message);
          toast.error(message);
        })
        .finally(() => {
          setIsAutoBidLoading(false);
        });
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.3 }
    }
  };

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-6 w-full"
      >
        {/* Section Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Gavel size={16} className="text-foreground-secondary" />
          <h2 className="text-xs uppercase tracking-widest font-semibold text-foreground-secondary">
            Hành động đấu giá
          </h2>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {bidError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/40 text-destructive"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="text-sm font-medium">{bidError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Action - Manual Bid */}
        <motion.div variants={cardVariants} className="flex flex-col gap-4 p-4 border border-border bg-background">
          <div className="flex items-start gap-3">
            <Gavel className="text-primary mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">Đấu giá thủ công</h3>
              <p className="text-sm text-foreground-secondary">
                Đặt giá cao hơn để trở thành người đấu giá cao nhất
              </p>
            </div>
            <span className="px-2 py-1 bg-accent-subtle text-accent-foreground text-xs font-medium flex-shrink-0">
              Khuyên dùng
            </span>
          </div>

          <form onSubmit={handleBidSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground-secondary">
                Số tiền đấu giá
              </label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary z-10" size={16} />
                <MoneyInput
                  value={bidInput}
                  onChange={(formatted) => setBidInput(formatted)}
                  placeholder={`Tối thiểu ${(minNextBid || (currentPrice ?? 0) + 1).toLocaleString("vi-VN")}`}
                  disabled={isBidLoading}
                  className="pl-10 pr-4"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isBidLoading || !bidInput}
              className="h-12 w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-base disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isBidLoading ? <Spinner size="sm" tone="onColor" /> : <Gavel size={16} />}
              {isBidLoading ? "Đang đấu giá..." : "Đấu giá"}
            </button>
          </form>
        </motion.div>

        {/* Buy Now — chỉ hiện khi phiên có mở giá mua ngay */}
        {buyNowPrice > 0 && (
          <motion.div variants={cardVariants} className="flex flex-col gap-3 p-4 border border-border bg-background">
            <div className="flex items-start gap-3">
              <Zap className="text-warning mt-0.5" size={18} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Mua ngay</h3>
                <p className="text-sm text-foreground-secondary">Kết thúc đấu giá và sở hữu ngay</p>
              </div>
            </div>
            <button
              type="button"
              disabled={isBuyNowLoading}
              onClick={handleBuyNow}
              className="w-full h-12 bg-warning hover:opacity-90 text-warning-foreground font-semibold text-base disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {isBuyNowLoading ? <Spinner size="sm" tone="onColor" /> : <Zap size={16} />}
              {isBuyNowLoading
                ? "Đang xử lý..."
                : `Mua ngay ${buyNowPrice.toLocaleString("vi-VN")} VNĐ`}
            </button>
          </motion.div>
        )}

        {/* Auto Bid */}
        <motion.div variants={cardVariants} className="flex flex-col gap-3 p-4 border border-border bg-background">
          <div className="flex items-start gap-3">
            <Bot className="text-accent-foreground mt-0.5" size={18} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">Đấu giá tự động</h3>
              <p className="text-sm text-foreground-secondary">
                {userAutoBidStatus ? "Auto-bid đang hoạt động" : "Hệ thống đấu giá tự động thay bạn"}
              </p>
            </div>
          </div>

          {/* Show current auto-bid status if user has active auto-bid */}
          {userAutoBidStatus ? (
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-accent-subtle border border-border">
                <div className="text-xs font-medium text-accent-foreground mb-2">
                  Trạng thái auto-bid hiện tại
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-foreground-secondary">Đang giữ giá</span>
                    <span className="font-semibold text-foreground">
                      {(userAutoBidStatus?.currentAmount ?? 0).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground-secondary">Giới hạn</span>
                    <span className="font-semibold text-foreground">
                      {(userAutoBidStatus?.limitBid ?? 0).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isDisablingAutoBid}
                onClick={handleDisableAutoBid}
                className="w-full h-10 bg-destructive hover:opacity-90 text-destructive-foreground font-medium text-sm disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
              >
                {isDisablingAutoBid ? <Spinner size="sm" tone="onColor" /> : <PowerOff size={14} />}
                {isDisablingAutoBid ? "Đang tắt..." : "Tắt auto-bid"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-foreground-secondary">
                  Giới hạn tối đa — hệ thống tự đặt giá thay bạn cho tới mức này
                </label>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary z-10" size={14} />
                  <MoneyInput
                    value={autoLimit}
                    onChange={(formatted) => setAutoLimit(formatted)}
                    placeholder={`Từ ${(minNextBid || currentPrice || 0).toLocaleString("vi-VN")} trở lên`}
                    disabled={isAutoBidLoading}
                    className="w-full h-10 pl-8 pr-3 text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={isAutoBidLoading || !autoLimit}
                onClick={handleAutoBid}
                className="w-full h-10 bg-secondary hover:bg-secondary-hover text-secondary-foreground font-medium text-sm disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isAutoBidLoading ? <Spinner size="sm" tone="onColor" /> : <Bot size={14} />}
                {isAutoBidLoading ? "Đang thiết lập..." : "Kích hoạt"}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Buy Now Success Modal */}
      <BuyNowSuccessModal
        isOpen={showBuyNowModal}
        onClose={() => {
          setShowBuyNowModal(false);
          // Refetch product data when modal is closed
          if (refetchProduct) refetchProduct();
        }}
        productName={productName || "Sản phẩm"}
        productId={productId?.toString() || ""}
        amount={buyNowPrice}
      />
    </>
  );
}
