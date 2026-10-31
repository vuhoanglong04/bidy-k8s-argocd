"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Clock, Award, Heart, Loader2 } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { APP_ROUTES } from "@/constants/routes.constants"
import { useAuth, useAuctionStatusUpdate } from "@/hooks"
import { useAddWishlist, useRemoveWishlist, useWishlist } from "@/services/user/user.query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  formatPrice,
  getImageUrl,
  getCurrentPrice,
  getBuyNowPrice,
  getUnifiedStatus,
  isWinner,
  getEndTime,
  getStartTime,
  getSellerName,
  getStartingPrice
} from './utils'
import { UnifiedAuctionItem, CountdownTimerProps } from './types'
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import { formatTimeDifference } from "@/utils/common.utils";

/**
 * Card này chạy ở hai mật độ rất khác nhau: lưới 3–6 cột của `ProductList` và
 * lưới 4 cột rộng của `AuctionShowcase` trên trang chủ. Trước đây chỉ có một cỡ
 * chữ cố định (7–11px) tối ưu cho lưới dày, nên ở trang chủ nó hiện ra như chữ
 * bị thu nhỏ nhầm. `density` tách hai trường hợp đó ra thay vì fork component.
 */
type CardDensity = 'compact' | 'comfortable'

const bodyStyles = cva('flex flex-1 flex-col', {
  variants: {
    density: {
      compact: 'gap-1 p-2',
      comfortable: 'gap-1.5 p-3.5',
    },
  },
  defaultVariants: { density: 'compact' },
})

const titleStyles = cva(
  'text-card-foreground group-hover:text-primary line-clamp-2 font-semibold transition-colors',
  {
    variants: {
      density: {
        compact: 'text-xs leading-snug',
        comfortable: 'text-sm leading-snug',
      },
    },
    defaultVariants: { density: 'compact' },
  }
)

const metaStyles = cva('text-muted-foreground', {
  variants: {
    density: {
      compact: 'text-[10px]',
      comfortable: 'text-xs',
    },
  },
  defaultVariants: { density: 'compact' },
})

const priceStyles = cva('text-primary font-bold tabular-nums', {
  variants: {
    density: {
      compact: 'text-sm',
      comfortable: 'text-lg',
    },
  },
  defaultVariants: { density: 'compact' },
})

const chipStyles = cva(
  'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
  {
    variants: {
      tone: {
        // Trạng thái dùng token trạng thái: đang mở = success, sắp mở = info,
        // đã đóng = destructive.
        active: 'bg-success text-success-foreground',
        initial: 'bg-info text-info-foreground',
        ended: 'bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { tone: 'active' },
  }
)

interface CountdownTimerState {
  distance: number
  isValid: boolean
}

/** Đếm ngược thời gian còn lại (dạng ngày/giờ nếu >= 1h, MM:SS nếu < 1h). Nền overlay đè lên ảnh. */
function CountdownTimer({ endTime, label, className = "" }: CountdownTimerProps) {
  const [timerState, setTimerState] = useState<CountdownTimerState>({
    distance: 0,
    isValid: true,
  })

  useEffect(() => {
    // Validate endTime
    if (!endTime) {
      setTimerState({ distance: 0, isValid: false })
      return
    }

    const endDate = typeof endTime === 'string' ? new Date(endTime) : endTime

    // Check if date is valid
    if (isNaN(endDate.getTime())) {
      setTimerState({ distance: 0, isValid: false })
      return
    }

    const updateTime = () => {
      const now = Date.now()
      const distance = endDate.getTime() - now
      setTimerState({ distance, isValid: true })
    }

    // Initial calculation
    updateTime()
    const timer = setInterval(updateTime, 1000)

    return () => clearInterval(timer)
  }, [endTime])

  const { distance, isValid } = timerState

  let displayText = '--:--:--'
  let isUrgent = false

  if (isValid) {
    if (distance <= 0) {
      displayText = 'Đã hết giờ'
      isUrgent = false
    } else if (distance < 3600000) {
      // Dưới 1 giờ là lúc phiên đáng chú ý nhất — hiện MM:SS đếm từng giây, đổi sang token cảnh báo.
      const totalSeconds = Math.floor(distance / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      displayText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      isUrgent = true
    } else {
      // Còn >= 1 giờ: dùng lại util formatTimeDifference
      const endDate = typeof endTime === 'string' ? new Date(endTime) : endTime
      displayText = formatTimeDifference(endDate)
      isUrgent = false
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
        isUrgent ? 'bg-warning text-warning-foreground' : 'bg-overlay text-white',
        className
      )}
      aria-label={`Còn lại: ${displayText}`}
    >
      <Clock className="h-2.5 w-2.5" />
      {label && <span className="font-sans font-medium">{label}</span>}
      <span>{displayText}</span>
    </div>
  )
}

export interface ProductCardCompactProps extends VariantProps<typeof bodyStyles> {
  item: UnifiedAuctionItem
  /** `compact` cho lưới dày (mặc định), `comfortable` cho lưới thưa như trang chủ. */
  density?: CardDensity
  className?: string
}

export default function ProductCardCompact({
  item,
  density = 'compact',
  className = ""
}: ProductCardCompactProps) {
  const { user } = useAuth()
  const [currentStatus, setCurrentStatus] = useState(getUnifiedStatus(item))
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isWishlistLoading, setIsWishlistLoading] = useState(false)
  const status = currentStatus
  const endTime = getEndTime(item)
  // Phiên chưa mở thì mốc đáng quan tâm là giờ bắt đầu, không phải giờ đóng.
  const countdownTarget = status === 'initial' ? getStartTime(item) ?? endTime : endTime
  const userIsWinner = isWinner(item, user?._id)

  // Wishlist hooks
  const { data: wishlistData } = useWishlist(1, 100)
  const addWishlist = useAddWishlist()
  const removeWishlist = useRemoveWishlist()

  // Check if item is bookmarked
  useEffect(() => {
    const auctionId = (item.id || item._id)?.toString()
    if (wishlistData?.wishlist && auctionId) {
      // `GET /users/wishlist` trả entity TypeORM: khoá là `auctionId` (chuỗi).
      const bookmarked = wishlistData.wishlist.some(
        (wishItem) => String(wishItem.auctionId) === String(auctionId)
      )
      setIsBookmarked(bookmarked)
    }
  }, [wishlistData, item.id, item._id])

  // Trạng thái phiên đồng bộ QUA SOCKET `auctionStatusUpdate`, không polling.
  // Payload chỉ có { auctionId, status, timestamp } nên không dùng để patch cache.
  // Event không bao giờ mang 'cancelled', chỉ có 'happening' và 'ended'.
  useAuctionStatusUpdate((item.id || item._id)?.toString(), (update) => {
    setCurrentStatus(update.status === 'ended' ? 'ended' : 'active')
  })

  // Calculate bid count (if available)
  const itemWithBids = item as { bidHistory?: unknown[]; totalBids?: number };
  const bidCount = itemWithBids.bidHistory?.length || itemWithBids.totalBids || 0

  const statusTone = status === 'ended' ? 'ended' : status === 'initial' ? 'initial' : 'active'
  const statusLabel =
    status === 'ended' ? 'Đã kết thúc' : status === 'initial' ? 'Sắp đấu giá' : 'Đang đấu giá'

  const buyNowPrice = getBuyNowPrice(item)

  // Handle wishlist toggle
  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const auctionId = (item.id || item._id)?.toString()
    if (!auctionId) {
      toast.error('Không thể thêm vào yêu thích')
      return
    }

    if (!user) {
      toast.error('Vui lòng đăng nhập để thêm vào yêu thích')
      return
    }

    setIsWishlistLoading(true)

    try {
      if (isBookmarked) {
        await removeWishlist.mutateAsync({ id: auctionId })
        setIsBookmarked(false)
        toast.success('Đã xóa khỏi danh sách yêu thích')
      } else {
        await addWishlist.mutateAsync({ id: auctionId })
        setIsBookmarked(true)
        toast.success('Đã thêm vào danh sách yêu thích')
      }
    } catch (error) {
      // Toast lỗi đã do onError của mutation hiển thị.
      console.error('Wishlist error:', error)
    } finally {
      setIsWishlistLoading(false)
    }
  }

  return (
    // Card KHÔNG bọc trong <Link>: nút yêu thích là một <button> thật, lồng
    // button trong anchor là HTML không hợp lệ và tạo hai điểm dừng tab chồng
    // nhau. Thay vào đó link nằm ở tiêu đề và phủ toàn card bằng `after:`.
    <article
      className={cn(
        'group bg-card border-border relative flex flex-col border',
        'focus-within:ring-ring transition-colors focus-within:ring-2',
        'hover:border-primary',
        className
      )}
    >
      <div className="bg-muted relative aspect-square w-full overflow-hidden">
        <ImageWithFallback
          src={getImageUrl(item.image)}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        <span className={cn(chipStyles({ tone: statusTone }), 'absolute top-0 left-0')}>
          {statusLabel}
        </span>

        {countdownTarget && status !== 'ended' && (
          <CountdownTimer
            endTime={countdownTarget}
            label={status === 'initial' ? 'Mở sau' : undefined}
            className="absolute bottom-0 left-0"
          />
        )}

        {userIsWinner && (
          <span className="bg-success text-success-foreground absolute bottom-0 right-0 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold">
            <Award className="h-2.5 w-2.5" />
            Thắng
          </span>
        )}

        <button
          type="button"
          className={cn(
            'bg-card/90 text-muted-foreground hover:text-primary focus-visible:ring-ring',
            'absolute top-0 right-0 z-20 flex h-7 w-7 items-center justify-center',
            'transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50'
          )}
          onClick={handleWishlistToggle}
          disabled={isWishlistLoading}
          aria-label={isBookmarked ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
          aria-pressed={isBookmarked}
        >
          {isWishlistLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Heart
              className={cn('h-3.5 w-3.5', isBookmarked && 'text-primary fill-primary')}
            />
          )}
        </button>
      </div>

      <div className={bodyStyles({ density })}>
        <h3 className={titleStyles({ density })}>
          <Link
            href={APP_ROUTES.PRODUCT_DETAIL(item.id || item._id || '')}
            className="after:absolute after:inset-0 focus:outline-none"
          >
            {item.name}
          </Link>
        </h3>

        {density === 'comfortable' && item.description && (
          <p className={cn(metaStyles({ density }), 'line-clamp-2')}>{item.description}</p>
        )}

        <p className={cn(metaStyles({ density }), 'truncate')}>
          Người bán: <span className="text-foreground-secondary">{getSellerName(item)}</span>
        </p>

        {/* Giá hiện tại là thứ duy nhất được nhấn — mọi con số khác là phụ trợ,
            giữ ở cỡ meta để mắt không phải chọn giữa bốn con số cùng đậm. */}
        <div className="mt-auto pt-1">
          <p className={metaStyles({ density })}>
            {status === 'ended' ? 'Giá cuối' : 'Giá hiện tại'}
          </p>
          <p className={priceStyles({ density })}>
            {formatPrice(
              status === 'ended' && item.finalPrice ? item.finalPrice : getCurrentPrice(item)
            )}
          </p>
        </div>

        <dl
          className={cn(
            metaStyles({ density }),
            'border-border mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-1'
          )}
        >
          <div className="flex items-center gap-1">
            <dt className="sr-only">Giá khởi điểm</dt>
            <dd className="tabular-nums">KĐ {formatPrice(getStartingPrice(item))}</dd>
          </div>

          {buyNowPrice && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Mua ngay</dt>
              <dd className="text-success font-semibold tabular-nums">
                Mua ngay {formatPrice(buyNowPrice)}
              </dd>
            </div>
          )}

          {bidCount > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <dt className="sr-only">Lượt đấu</dt>
              <dd className="tabular-nums">{bidCount} lượt</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}
