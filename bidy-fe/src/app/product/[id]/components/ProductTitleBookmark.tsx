'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAddWishlist, useRemoveWishlist, useWishlist } from '@/services/user/user.query'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Heart } from 'lucide-react'
import { Spinner } from '@/components/common/loading'
import { cn } from '@/lib/utils'

interface ProductTitleBookmarkProps {
  auctionId: string
  auctionOwnerId?: string | { _id: string }
  currentUserId?: string
  variant?: 'icon' | 'cta'
}

export type { ProductTitleBookmarkProps }

export default function ProductTitleBookmark({
  auctionId,
  auctionOwnerId,
  currentUserId,
  variant = 'icon',
}: ProductTitleBookmarkProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const { user, requireAuth } = useAuth()
  
  // Check if item is bookmarked - use existing useWishlist hook
  const { data: wishlistData } = useWishlist(1, 100)
  const addWishlist = useAddWishlist()
  const removeWishlist = useRemoveWishlist()
  
  // Hide wishlist button if user owns the auction - use same logic as ProductCTA
  const isOwnAuction = useMemo(() => {
    const extractedOwnerId = typeof auctionOwnerId === 'string' ? auctionOwnerId : auctionOwnerId?._id
    const userIdToCheck = currentUserId || user?._id
    return extractedOwnerId && userIdToCheck && String(extractedOwnerId) === String(userIdToCheck)
  }, [auctionOwnerId, currentUserId, user?._id])
  
  // Update bookmark status when wishlist data changes
  useEffect(() => {
    if (wishlistData?.wishlist && auctionId) {
      // `GET /users/wishlist` trả entity TypeORM: khoá là `auctionId` (chuỗi),
      // không phải `auction_id` dạng object như các endpoint cũ.
      const bookmarked = wishlistData.wishlist.some(
        (item) => String(item.auctionId) === String(auctionId)
      )
      setIsBookmarked(bookmarked)
    }
  }, [wishlistData, auctionId])

  // Don't render if user owns the auction
  if (isOwnAuction) {
    return null
  }

  const handleBookmarkToggle = async () => {
    if (!auctionId) {
      toast.error('Không thể thêm vào yêu thích')
      return
    }

    // Khách chưa đăng nhập: không gọi API (chắc chắn 401), đưa thẳng tới
    // trang đăng nhập rồi quay lại đúng phiên này.
    if (!requireAuth()) {
      return
    }

    setIsLoading(true)
    
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
      console.error('Bookmark error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === 'cta') {
    return (
      <div className="flex flex-col gap-3 w-full">
        <button
          type="button"
          onClick={handleBookmarkToggle}
          disabled={isLoading}
          aria-pressed={isBookmarked}
          className={cn(
            'w-full h-12 px-6 font-semibold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50',
            isBookmarked
              ? 'border border-border bg-background text-foreground hover:border-primary'
              : 'bg-primary text-primary-foreground hover:bg-primary-hover'
          )}
        >
          {isLoading ? (
            <Spinner size="sm" tone={isBookmarked ? 'muted' : 'onColor'} />
          ) : (
            <Heart size={16} className={isBookmarked ? 'text-destructive fill-destructive' : undefined} />
          )}
          {isBookmarked ? 'Đã lưu vào yêu thích' : 'Thêm vào yêu thích'}
        </button>
        <p className="text-xs text-foreground-secondary">
          {isBookmarked
            ? 'Phiên đã nằm trong danh sách yêu thích của bạn, xem lại bất cứ lúc nào trong trang cá nhân.'
            : 'Lưu phiên này vào danh sách yêu thích để dễ quay lại khi phiên bắt đầu.'}
        </p>
      </div>
    )
  }

  const bookmarkLabel = isBookmarked ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'

  return (
    <button 
      type="button"
      onClick={handleBookmarkToggle}
      disabled={isLoading}
      aria-pressed={isBookmarked}
      aria-label={bookmarkLabel}
      className="w-10 h-10 flex-shrink-0 flex items-center justify-center border border-border bg-background hover:border-primary transition-colors duration-200 group disabled:opacity-50"
      title={bookmarkLabel}
    >
      {isLoading ? (
        <Spinner size="sm" tone="muted" />
      ) : (
        <Heart
          className={`w-5 h-5 transition-colors duration-200 ${
            isBookmarked
              ? 'text-destructive fill-destructive'
              : 'text-foreground-secondary group-hover:text-primary'
          }`}
        />
      )}
    </button>
  )
} 