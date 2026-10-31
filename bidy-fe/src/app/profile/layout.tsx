'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWishlist } from '@/services/user/user.query'
import { useWonAuctions } from '@/services/orders/orders.query'
import { useMyProducts } from '@/services/product'
import AuthGuard from '@/components/auth/AuthGuard'
import { APP_ROUTES } from '@/constants/routes.constants'
import { 
  User, 
  Gavel, 
  Heart, 
  ShoppingBag, 
  CreditCard, 
  Settings, 
  Bell,
  Menu,
  X,
  Package,
  Boxes,
  ClipboardList
} from 'lucide-react'

interface ProfileLayoutProps {
  children: React.ReactNode
}

export default function ProfileLayout({ children }: ProfileLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  
  // Get wishlist count for badge
  const { totalCount } = useWishlist(1, 1) // Just for count
  
  // Get real unpaid orders count from API
  const { data: ordersData } = useWonAuctions()
  const unpaidOrdersCount = ordersData?.summary?.pending || 0

  // Nháp bỏ dở là thứ chỉ chính chủ dọn được, nên đẩy số lượng lên nav.
  const { data: myProducts } = useMyProducts({ limit: 100 })
  const draftCount = (myProducts?.items ?? []).filter(
    (product) => product.status === 'draft'
  ).length

  const navigationItems = useMemo(() => [
    {
      href: APP_ROUTES.PROFILE,
      label: 'Tổng quan',
      icon: User,
      exact: true
    },
    {
      href: APP_ROUTES.MY_PRODUCTS,
      label: 'Sản phẩm của tôi',
      icon: Boxes,
      badge: draftCount > 0 ? draftCount.toString() : undefined
    },
    {
      href: APP_ROUTES.MY_AUCTION_REQUESTS,
      label: 'Yêu cầu đăng phiên',
      icon: ClipboardList
    },
    {
      href: APP_ROUTES.MY_AUCTIONS,
      label: 'Đấu giá của tôi',
      icon: Gavel
    },
    {
      href: APP_ROUTES.MY_BIDS,
      label: 'Lịch sử đấu thầu',
      icon: ShoppingBag
    },
    {
      href: APP_ROUTES.MY_WISHLIST,
      label: 'Yêu thích',
      icon: Heart,
      badge: totalCount?.toString()
    },
    {
      href: APP_ROUTES.MY_ORDERS,
      label: 'Đơn hàng',
      icon: Package,
      badge: unpaidOrdersCount > 0 ? unpaidOrdersCount.toString() : undefined,
      badgeVariant: 'destructive' as const
    },
    {
      href: APP_ROUTES.MY_WALLET,
      label: 'Ví của tôi',
      icon: CreditCard
    },
    {
      href: APP_ROUTES.MY_NOTIFICATIONS,
      label: 'Thông báo',
      icon: Bell
    },
    {
      href: APP_ROUTES.SETTINGS,
      label: 'Cài đặt',
      icon: Settings
    }
  ], [totalCount, unpaidOrdersCount, draftCount])

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Mobile Menu Toggle */}
            <div className="lg:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                className="w-full cursor-pointer justify-start rounded-none border-border"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                Menu tài khoản
              </Button>
            </div>

            {/* Sidebar Navigation */}
            <aside className={cn(
              "lg:w-60 lg:shrink-0",
              isMobileMenuOpen ? "block" : "hidden lg:block"
            )}>
              <nav className="flex flex-col border border-border bg-card">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href, item.exact)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        "flex items-center justify-between gap-3 border-l-2 px-4 py-3 text-sm font-medium transition-colors",
                        "border-b border-b-border last:border-b-0",
                        active
                          ? "border-l-primary bg-accent text-foreground"
                          : "border-l-transparent text-foreground-secondary hover:bg-accent hover:text-foreground"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={cn("w-4 h-4", active && "text-primary")} />
                        <span>{item.label}</span>
                      </span>
                      {item.badge && parseInt(item.badge) > 0 && (
                        <Badge
                          variant={item.badgeVariant || 'secondary'}
                          className="tabular-nums"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}