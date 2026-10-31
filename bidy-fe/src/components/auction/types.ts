// Unified auction item interface that accommodates all existing data patterns
export interface UnifiedAuctionItem {
  // Core identifiers
  id: string | number
  _id?: string // for backward compatibility with Bid type
  
  // Product info
  name: string
  title?: string // alternative field name
  description?: string
  image?: string[] | string
  
  // Pricing
  startingPrice?: number | string
  price?: number | string // alternative field name from Bid type
  currentPrice?: number | string
  currentBid?: number
  finalPrice?: number | string
  priceBuyNow?: number | string
  buyNow?: number | string
  
  // Timing
  endTime?: Date | string
  endDate?: Date | string
  /** Giờ mở phiên — mốc đếm ngược khi phiên còn `pending`. */
  startDate?: Date | string
  finishedTime?: Date | string
  timeLeft?: string
  time_remain?: string
  
  // Status
  status?: string
  type?: string // STATUS_AUCTIONS enum values
  
  // User info
  seller?: string
  bidder?: string
  owner?: { 
    full_name?: string
    _id?: string | number
  }
  
  // Bidding info
  top_ownerships?: Array<{
    user_id?: string | { _id: string; full_name?: string; [key: string]: unknown }
    user_name?: string
    amount?: number
    isAuto?: boolean
    limitBid?: number
    incrementAmount?: number
  }>
}

export interface UnifiedAuctionCardProps {
  item: UnifiedAuctionItem
  layout?: 'horizontal' | 'vertical'
  context?: 'list' | 'related' | 'profile' | 'admin'
  showActions?: boolean
  onAction?: (action: string, item: UnifiedAuctionItem) => void
  className?: string
}

export type AuctionStatus = 'active' | 'ending-soon' | 'ended' | 'initial' | 'happening'

export interface CountdownTimerProps {
  endTime: Date | string
  /** Nhãn trước đồng hồ, ví dụ "Mở sau" cho phiên chưa bắt đầu. */
  label?: string
  className?: string
}