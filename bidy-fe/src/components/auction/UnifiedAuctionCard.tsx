"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, User, TrendingUp, Award, Trash2 } from "lucide-react"
import { APP_ROUTES } from "@/constants/routes.constants"
import { useAuth, useAuctionStatusUpdate } from "@/hooks"
import { UnifiedAuctionCardProps, CountdownTimerProps } from './types'
import { ImageWithFallback } from "@/components/common/ImageWithFallback"
import {
  formatPrice,
  getImageUrl,
  getSellerName,
  getCurrentPrice,
  getStartingPrice,
  getBuyNowPrice,
  getUnifiedStatus,
  getCTAText,
  isWinner,
  getEndTime
} from './utils'

function CountdownTimer({ endTime, className = "" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
    isValid: boolean
  }>({ hours: 0, minutes: 0, seconds: 0, isValid: true })

  useEffect(() => {
    // Validate endTime
    if (!endTime) {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isValid: false })
      return
    }

    const endDate = typeof endTime === 'string' ? new Date(endTime) : endTime

    // Check if date is valid
    if (isNaN(endDate.getTime())) {
      setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isValid: false })
      return
    }

    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = endDate.getTime() - now

      if (distance > 0) {
        const hours = Math.floor(distance / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)

        setTimeLeft({ hours, minutes, seconds, isValid: true })
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isValid: true })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [endTime])

  // Format time as HH:MM:SS
  const formatTime = (num: number) => num.toString().padStart(2, '0')
  const { hours, minutes, seconds, isValid } = timeLeft

  // Fallback UI for invalid time
  if (!isValid) {
    return (
      <div className={`flex items-center gap-1.5 bg-gray-500/20 text-gray-600 dark:text-gray-400 font-mono font-semibold px-3 py-1.5 rounded-xl shadow-sm ring-1 ring-gray-500/20 backdrop-blur-sm ${className}`}>
        <Clock className="h-3 w-3" />
        <span className="text-sm">--:--:--</span>
      </div>
    )
  }

  // Fallback UI for ended auction
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return (
      <div className={`flex items-center gap-1.5 bg-red-500/20 text-red-700 dark:text-red-400 font-mono font-semibold px-3 py-1.5 rounded-xl shadow-sm ring-1 ring-red-500/20 backdrop-blur-sm ${className}`}>
        <Clock className="h-3 w-3" />
        <span className="text-sm">Đã kết thúc</span>
      </div>
    )
  }

  const displayTime = `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`

  return (
    <div className={`flex items-center gap-1.5 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-700 dark:text-orange-300 font-mono font-semibold px-3 py-1.5 rounded-xl shadow-sm ring-1 ring-orange-500/20 backdrop-blur-sm ${className}`}>
      <Clock className="h-3 w-3" />
      <span className="text-sm">{displayTime}</span>
    </div>
  )
}


export default function UnifiedAuctionCard({ 
  item, 
  layout = 'vertical', 
  context = 'list',
  showActions = false,
  onAction,
  className = ""
}: UnifiedAuctionCardProps) {
  const { user } = useAuth()
  const [currentStatus, setCurrentStatus] = useState(getUnifiedStatus(item))
  const status = currentStatus
  const endTime = getEndTime(item)
  const isOwner = user?._id && (item.owner?._id === user._id)
  const userIsWinner = isWinner(item, user?._id)

  // Trạng thái phiên đồng bộ QUA SOCKET `auctionStatusUpdate`, không polling.
  // Payload chỉ có { auctionId, status, timestamp } nên không dùng để patch cache.
  // Event không bao giờ mang 'cancelled', chỉ có 'happening' và 'ended'.
  useAuctionStatusUpdate((item.id || item._id)?.toString(), (update) => {
    setCurrentStatus(update.status === 'ended' ? 'ended' : 'active')
  })
  
  // Render horizontal layout (like ProductListCard)
  if (layout === 'horizontal') {
    return (
      <Link href={APP_ROUTES.PRODUCT_DETAIL(item.id || item._id || '')} className="block">
        <Card className={`group hover:shadow-xl transition-all duration-300 hover:border-primary/30 border-0 shadow-sm bg-card/50 backdrop-blur-sm ${className}`}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Image - Left Side */}
              <div className="relative w-32 h-32 flex-shrink-0">
                <ImageWithFallback
                  src={getImageUrl(item.image)}
                  alt={item.name}
                  fill
                  className="object-cover rounded-xl border-0 shadow-md ring-1 ring-border/20"
                />
              </div>

              {/* Content - Middle */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-xl text-foreground line-clamp-2 leading-tight hover:text-primary transition-colors flex-1 cursor-pointer group-hover:text-primary/90">
                    {item.name}
                  </h3>
                </div>
                
                {item.description && (
                  <p className="text-muted-foreground/80 text-sm line-clamp-2 leading-relaxed italic border-l-2 border-muted pl-3 -mt-1">
                    {item.description}
                  </p>
                )}

                <div className="space-y-3">
                  {/* Starting Price Row */}
                  <div className="flex justify-between items-center py-3 px-3 bg-muted/15 rounded-lg shadow-sm min-h-[44px]">
                    <span className="text-sm text-muted-foreground font-medium">Giá khởi điểm:</span>
                    <span className="font-semibold text-right text-foreground">{formatPrice(getStartingPrice(item))}</span>
                  </div>
                  
                  {/* Current Price Row - Active */}
                  {(status === 'active' || status === 'happening') && (
                    <div className="flex justify-between items-center py-3 px-3 bg-gradient-to-r from-amber-50/40 to-yellow-50/40 dark:from-amber-900/15 dark:to-yellow-900/15 rounded-lg shadow-sm min-h-[44px]">
                      <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">Giá hiện tại:</span>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="font-bold text-lg text-amber-700 dark:text-amber-300 text-right">{formatPrice(getCurrentPrice(item))}</span>
                      </div>
                    </div>
                  )}

                  {/* Final Price Row - Ended */}
                  {status === 'ended' && (
                    <div className="flex justify-between items-center py-3 px-3 bg-slate-50/40 dark:from-slate-800/15 rounded-lg shadow-sm min-h-[44px]">
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Giá cuối cùng:</span>
                      <span className="font-bold text-lg text-slate-700 dark:text-slate-300 text-right">{formatPrice(getCurrentPrice(item))}</span>
                    </div>
                  )}

                  {/* Buy Now Price Row */}
                  {getBuyNowPrice(item) && (
                    <div className="flex justify-between items-center py-3 px-3 bg-emerald-50/30 dark:from-emerald-900/15 rounded-lg shadow-sm min-h-[44px]">
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Giá mua ngay:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-right">{formatPrice(getBuyNowPrice(item))}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 text-primary" />
                    <span>{getSellerName(item)}</span>
                    {userIsWinner && (
                      <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 px-2 py-1 rounded-md shadow-sm ring-1 ring-green-200/50 dark:ring-green-700/50 ml-2">
                        <Award className="w-3 h-3" />
                        <span className="font-medium">Thắng</span>
                      </div>
                    )}
                  </div>

                  {/* Countdown timer moved to footer */}
                  {endTime && (
                    <CountdownTimer endTime={endTime} className="ml-auto" />
                  )}
                </div>
              </div>

              {/* Actions - Right */}
              <div className="flex flex-col gap-2 justify-center items-end">
                {showActions && isOwner ? (
                  <>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onAction?.('edit', item)
                      }}
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      Chỉnh sửa
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onAction?.('delete', item)
                      }}
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xoá
                    </Button>
                  </>
                ) : (
                  <Button
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-6 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
                    disabled={status === 'ended'}
                  >
                    {getCTAText(item, context)}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Render vertical layout (like ProductGridCard)
  return (
    <Link href={APP_ROUTES.PRODUCT_DETAIL(item.id || item._id || '')} className="block h-full">
      <Card className={`group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-card/60 backdrop-blur-md border-0 shadow-lg ring-1 ring-border/30 flex flex-col h-full rounded-2xl ${className}`}>
        <CardHeader className="pb-3 flex-shrink-0 px-4 pt-4">
          <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-muted/80 to-muted shadow-inner ring-1 ring-border/10">
            <ImageWithFallback
              src={getImageUrl(item.image)}
              alt={item.name}
              width={400}
              height={240}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between px-4 py-3">
          {/* Title and description - fixed height area */}
          <div className="min-h-[70px] mb-4">
            <h3 className="font-bold text-lg text-foreground text-balance leading-tight line-clamp-2 mb-2 hover:text-primary transition-colors cursor-pointer group-hover:text-primary/90">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-muted-foreground/80 text-xs text-pretty line-clamp-2 leading-relaxed italic border-l-2 border-muted pl-3">
                {item.description}
              </p>
            )}
          </div>

          {/* Price information - flexible area */}
          <div className="space-y-2">
            {/* Starting Price Row */}
            <div className="flex justify-between items-center py-2 px-2 bg-muted/15 rounded-md shadow-sm min-h-[36px]">
              <span className="text-xs text-muted-foreground font-medium">Giá khởi điểm:</span>
              <span className="font-semibold text-sm text-card-foreground text-right">{formatPrice(getStartingPrice(item))}</span>
            </div>

            {/* Current Price Row - Active */}
            {(status === 'active' || status === 'happening') && (
              <div className="flex justify-between items-center py-2 px-2 bg-gradient-to-r from-amber-50/40 to-yellow-50/40 dark:from-amber-900/15 dark:to-yellow-900/15 rounded-md shadow-sm min-h-[36px]">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Giá hiện tại:</span>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-sm text-amber-700 dark:text-amber-300 text-right">{formatPrice(getCurrentPrice(item))}</span>
                </div>
              </div>
            )}

            {/* Final Price Row - Ended */}
            {status === 'ended' && (
              <div className="flex justify-between items-center py-2 px-2 bg-slate-50/40 dark:bg-slate-800/15 rounded-md shadow-sm min-h-[36px]">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Giá cuối cùng:</span>
                <span className="font-bold text-sm text-slate-700 dark:text-slate-300 text-right">{formatPrice(getCurrentPrice(item))}</span>
              </div>
            )}

            {/* Buy Now Price Row */}
            {getBuyNowPrice(item) && (
              <div className="flex justify-between items-center py-2 px-2 bg-emerald-50/30 dark:bg-emerald-900/15 rounded-md shadow-sm min-h-[36px]">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Giá mua ngay:</span>
                <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 text-right">{formatPrice(getBuyNowPrice(item))}</span>
              </div>
            )}
          </div>

        </CardContent>

        {/* Footer - fixed at bottom */}
        <CardFooter className="px-4 pb-4 pt-2 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full px-0.5">
            <User className="h-3 w-3 flex-shrink-0 text-primary/70" />
            <span className="truncate">{getSellerName(item)}</span>
            {userIsWinner && (
              <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 px-2 py-1 rounded-md shadow-sm ring-1 ring-green-200/50 dark:ring-green-700/50 ml-auto">
                <Award className="w-3 h-3" />
                <span className="font-medium">Thắng</span>
              </div>
            )}

            {/* Countdown timer moved to footer */}
            {endTime && (
              <CountdownTimer endTime={endTime} className="ml-auto" />
            )}
          </div>

          {showActions && isOwner ? (
            <div className="flex gap-3 w-full">
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold h-10 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onAction?.('edit', item)
                }}
              >
                Chỉnh sửa
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive text-destructive-foreground font-semibold flex items-center justify-center gap-2 h-10 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onAction?.('delete', item)
                }}
              >
                <Trash2 className="w-4 h-4" />
                Xoá
              </Button>
            </div>
          ) : (
            <Button
              className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold h-10 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
              disabled={status === 'ended'}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              {getCTAText(item, context)}
            </Button>
          )}
        </CardFooter>
      </Card>
    </Link>
  )
}