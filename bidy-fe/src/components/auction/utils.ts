import { UnifiedAuctionItem, AuctionStatus } from './types'
import { STATUS_AUCTIONS } from '@/constants/app.enum'

// Format price with Vietnamese locale
export const formatPrice = (price: number | string | undefined): string => {
  if (!price) return '0đ'
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  return `${numPrice.toLocaleString('vi-VN')}đ`
}

// Get the main image URL from various image formats  
export const getImageUrl = (image: string | string[] | undefined): string => {
  if (!image) return '/images.jpeg'
  
  let imageUrl: string
  if (Array.isArray(image)) {
    imageUrl = image.length > 0 ? image[0] : '/images.jpeg'
  } else {
    imageUrl = image
  }
  
  // Use the same logic as lib/image-utils.ts
  if (imageUrl === '/images.jpeg') return imageUrl
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // If it starts with /, assume it's a local asset
  if (imageUrl.startsWith('/')) {
    return imageUrl
  }

  // S3 key trần không còn dùng được: endpoint /images/:key đã bị xoá.
  return '/images.jpeg'
}

// Get seller name from various user object formats
export const getSellerName = (item: UnifiedAuctionItem): string => {
  if (item.seller) return item.seller
  if (item.owner?.full_name) return item.owner.full_name
  if (item.bidder) return item.bidder
  return 'Không rõ người bán'
}

// Get current price from various field formats
export const getCurrentPrice = (item: UnifiedAuctionItem): number | string => {
  if (item.currentPrice) return item.currentPrice
  if (item.currentBid) return item.currentBid
  if (item.finalPrice) return item.finalPrice
  return getStartingPrice(item)
}

// Get starting price from various field formats
export const getStartingPrice = (item: UnifiedAuctionItem): number | string => {
  if (item.startingPrice) return item.startingPrice
  if (item.price) return item.price
  return 0
}

// Get buy now price if available
export const getBuyNowPrice = (item: UnifiedAuctionItem): number | string | undefined => {
  if (item.buyNow) return item.buyNow
  if (item.priceBuyNow) return item.priceBuyNow
  return undefined
}

// Unified status mapping
export const getUnifiedStatus = (item: UnifiedAuctionItem): AuctionStatus => {
  if (item.status) {
    const status = item.status.toLowerCase()

    // Khớp chính xác trước: `'pending'.includes('ending')` là TRUE, nên nhánh
    // substring bên dưới từng nuốt mọi phiên `pending` thành `ending-soon`.
    switch (status) {
      case STATUS_AUCTIONS.INITIAL:
        return 'initial'
      case STATUS_AUCTIONS.HAPPENING:
        return 'active'
      case STATUS_AUCTIONS.ENDED:
        return 'ended'
    }

    // Handle string statuses from different sources
    if (status.includes('active') || status.includes('happening')) return 'active'
    if (status.includes('ending') || status.includes('soon')) return 'ending-soon'
    if (status.includes('ended')) return 'ended'
    if (status.includes('initial')) return 'initial'
  }
  
  if (item.type) {
    // Handle STATUS_AUCTIONS enum values
    switch (item.type) {
      case STATUS_AUCTIONS.HAPPENING:
        return 'active'
      case STATUS_AUCTIONS.ENDED:
        return 'ended'
      case STATUS_AUCTIONS.INITIAL:
        return 'initial'
      default:
        return 'active'
    }
  }
  
  return 'active' // default fallback
}

// Get time display text based on status and available time fields
export const getTimeDisplay = (item: UnifiedAuctionItem): string => {
  const status = getUnifiedStatus(item)
  
  if (item.timeLeft) return item.timeLeft
  if (item.time_remain) return item.time_remain
  
  switch (status) {
    case 'active':
      return 'Đang đấu giá'
    case 'ending-soon':
      return 'Sắp kết thúc'
    case 'ended':
      return 'Đã kết thúc'
    case 'initial':
      return 'Sắp đấu giá'
    default:
      return 'Đang đấu giá'
  }
}

// Get CTA button text based on context and status
export const getCTAText = (item: UnifiedAuctionItem, context: string = 'list'): string => {
  const status = getUnifiedStatus(item)
  
  switch (status) {
    case 'ended':
      return context === 'profile' ? 'Xem kết quả' : 'Đã kết thúc'
    case 'initial':
      return context === 'related' ? 'Đặt thông báo' : 'Xem chi tiết'
    case 'active':
    case 'happening':
      return 'Đấu giá ngay'
    case 'ending-soon':
      return 'Đấu giá ngay'
    default:
      return 'Xem chi tiết'
  }
}

// Check if user is winner
export const isWinner = (item: UnifiedAuctionItem, userId?: string): boolean => {
  if (!userId || !item.top_ownerships) return false
  return item.top_ownerships.some(ownership => ownership.user_id === userId)
}

// Get end time as Date object
export const getEndTime = (item: UnifiedAuctionItem): Date | null => {
  if (item.endTime) {
    return typeof item.endTime === 'string' ? new Date(item.endTime) : item.endTime
  }
  if (item.endDate) {
    return typeof item.endDate === 'string' ? new Date(item.endDate) : item.endDate
  }
  if (item.finishedTime) {
    return typeof item.finishedTime === 'string' ? new Date(item.finishedTime) : item.finishedTime
  }
  return null
}
/** Giờ mở phiên, dùng làm mốc đếm ngược khi phiên còn `pending`. */
export const getStartTime = (item: UnifiedAuctionItem): Date | null => {
  if (!item.startDate) return null
  const date = typeof item.startDate === 'string' ? new Date(item.startDate) : item.startDate
  return isNaN(date.getTime()) ? null : date
}
