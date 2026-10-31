"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Search,
  ChevronRight,
  PackageSearch,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { BrandLogo } from "@/components/common";
import { APP_ROUTES } from "@/constants";
import CategoryMenu from "./CategoryMenu";
import MobileCategoryNav from "./MobileCategoryNav";
import NotificationBell from "./NotificationBell";
import { useProductSearch } from "@/services/product";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/common/loading";
import { useDebouncedValue } from "@/hooks";
import type { MappedAuction } from "@/services/auction.mapper";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { user, isAuthenticated, logout } = useAuth();

  // Debounce search input to avoid hitting API on every key stroke
  const { debouncedValue: debouncedSearch, isPending: isTyping } =
    useDebouncedValue(searchValue.trim(), 350);

  // Fetch search suggestions (limit 5 per OpenAPI spec for header search)
  const { searchResults, total = 0, isFetching } = useProductSearch(
    debouncedSearch,
    { limit: 5 }
  );

  const showDropdown = isFocused && !!searchValue.trim();
  // Đang chờ hết debounce hoặc đang fetch keyword mới → giữ skeleton, không
  // để dropdown nhảy qua lại giữa kết quả cũ và trạng thái rỗng.
  const isSearching = isTyping || isFetching;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideDesktop = searchRef.current?.contains(target);
      const insideMobile = mobileSearchRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menu and dropdown on page navigation
  useEffect(() => {
    setMenuOpen(false);
    setIsFocused(false);
  }, [pathname, searchParams]);

  const handleSearchSubmit = () => {
    if (searchValue.trim()) {
      setIsFocused(false);
      router.push(APP_ROUTES.CATEGORY_SEARCH(searchValue.trim()));
    }
  };

  const formatVND = (price?: number | string) => {
    if (price == null || price === "") return null;
    const num = typeof price === "number" ? price : parseFloat(price);
    if (isNaN(num)) return null;
    return num.toLocaleString("vi-VN") + " đ";
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "happening":
        return (
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-none">
            Đang diễn ra
          </span>
        );
      case "pending":
        return (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-none">
            Sắp diễn ra
          </span>
        );
      case "ended":
        return (
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-none">
            Đã kết thúc
          </span>
        );
      default:
        return null;
    }
  };

  const renderDropdown = () => {
    if (!showDropdown) return null;

    return (
      <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-background border border-border shadow-lg rounded-none overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
        {isSearching ? (
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-11 h-11 shrink-0 rounded-none" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-3.5 w-3/4 rounded-none" />
                  <Skeleton className="h-3 w-1/3 rounded-none" />
                </div>
              </div>
            ))}
          </div>
        ) : searchResults && searchResults.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
              Gợi ý đấu giá ({searchResults.length}/{total})
            </div>
            {searchResults.map((product: MappedAuction) => {
              const productId = product.id || product._id;
              const productName = product.name || "Sản phẩm";
              const imageUrl =
                (Array.isArray(product.image) ? product.image[0] : product.image) ||
                "";
              const price =
                product.currentPrice ??
                product.currentBid ??
                product.price ??
                product.startingPrice;

              return (
                <Link
                  key={productId}
                  href={APP_ROUTES.PRODUCT_DETAIL(productId as string)}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors group"
                  onClick={() => {
                    setIsFocused(false);
                    setSearchValue("");
                  }}
                >
                  <div className="relative w-11 h-11 shrink-0 bg-muted rounded-none overflow-hidden border border-border flex items-center justify-center">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={productName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                        sizes="44px"
                        unoptimized
                      />
                    ) : (
                      <PackageSearch className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {productName}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {price != null && (
                        <span className="text-xs font-semibold text-primary">
                          {formatVND(price)}
                        </span>
                      )}
                      {getStatusBadge(product.status)}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}

            <button
              type="button"
              className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              onClick={handleSearchSubmit}
            >
              <span>Xem tất cả {total} kết quả tìm kiếm</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Không tìm thấy kết quả phù hợp cho &quot;{searchValue}&quot;.
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="w-full bg-background text-foreground border-b border-border sticky top-0 z-50 font-sans">
      {/* Desktop & Tablet */}
      <div className="hidden lg:flex items-center justify-between h-[82px] px-8 max-w-[1440px] mx-auto">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-12 h-full">
          <Link href={APP_ROUTES.HOME} className="flex items-center gap-2 group">
            <BrandLogo
              priority
              className="h-10 w-auto transition-transform group-hover:scale-105"
            />
          </Link>

          <nav className="flex items-center gap-8 h-full">
            <Link
              href={APP_ROUTES.HOME}
              className={cn(
                "text-sm font-medium hover:text-primary transition-colors",
                pathname === APP_ROUTES.HOME && !searchParams.toString()
                  ? "text-primary"
                  : "text-foreground"
              )}
            >
              Trang chủ
            </Link>

            <CategoryMenu isActive={pathname === APP_ROUTES.CATEGORY} />
          </nav>
        </div>

        {/* Center: Search (Precision Line) */}
        <div className="flex-1 max-w-md mx-8 relative" ref={searchRef}>
          <div className="flex items-center border-b-[1.5px] border-muted-foreground focus-within:border-primary transition-colors pb-1">
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit();
                } else if (e.key === "Escape") {
                  setIsFocused(false);
                }
              }}
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {renderDropdown()}
        </div>

        {/* Right: Auth / Actions */}
        <div className="flex items-center gap-6">
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center justify-center gap-5 border-l border-border pl-6">
              <NotificationBell />
              <Link
                href={APP_ROUTES.PROFILE}
                className="flex items-center justify-center text-foreground hover:text-primary transition-colors"
              >
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push(APP_ROUTES.SIGN_IN);
                }}
                className="flex items-center justify-center text-foreground hover:text-primary transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 border-l border-border pl-6">
              <Link
                href={APP_ROUTES.SIGN_IN}
                className="text-sm font-bold text-foreground hover:text-primary transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href={APP_ROUTES.SIGN_UP}
                className="text-sm font-bold bg-primary text-primary-foreground px-5 py-2 hover:opacity-90 transition-opacity"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden flex flex-col w-full border-b border-border bg-background">
        <div className="flex items-center justify-between h-16 px-4">
          <Link href={APP_ROUTES.HOME} className="flex items-center gap-2 group">
            <BrandLogo className="h-8 w-auto" />
          </Link>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1">
              {menuOpen ? (
                <X className="w-6 h-6 text-foreground" />
              ) : (
                <Menu className="w-6 h-6 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="px-4 pb-4 relative" ref={mobileSearchRef}>
          <div className="flex items-center border-b-[1.5px] border-muted-foreground focus-within:border-primary transition-colors pb-1">
            <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit();
                } else if (e.key === "Escape") {
                  setIsFocused(false);
                }
              }}
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {renderDropdown()}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full h-[calc(100dvh-100%)] bg-background z-40 overflow-y-auto pb-8">
          <nav className="flex flex-col px-6 py-8 gap-6">
            <Link href={APP_ROUTES.HOME} className="text-xl font-bold text-foreground">
              Trang chủ
            </Link>
            <Link
              href={APP_ROUTES.CATEGORY_ALL}
              className="text-xl font-bold text-foreground"
            >
              Danh mục
            </Link>
            <MobileCategoryNav />

            {isAuthenticated ? (
              <div className="flex flex-col gap-6 mt-8 pt-8 border-t border-border">
                <Link
                  href={APP_ROUTES.PROFILE}
                  className="flex items-center gap-3 text-lg font-bold"
                >
                  <User className="w-5 h-5" /> Tài khoản
                </Link>
                <Link
                  href={APP_ROUTES.NOTIFICATIONS}
                  className="flex items-center gap-3 text-lg font-bold"
                >
                  <Bell className="w-5 h-5" /> Thông báo
                </Link>
                {user?.role === "admin" && (
                  <Link
                    href={APP_ROUTES.ADMIN}
                    className="text-lg font-bold text-primary"
                  >
                    Dashboard Quản Trị
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    router.push(APP_ROUTES.HOME);
                  }}
                  className="flex items-center gap-3 text-lg font-bold text-destructive text-left"
                >
                  <LogOut className="w-5 h-5" /> Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-8 pt-8 border-t border-border">
                <Link
                  href={APP_ROUTES.SIGN_IN}
                  className="w-full text-center py-3 border border-foreground text-foreground font-bold"
                >
                  Đăng nhập
                </Link>
                <Link
                  href={APP_ROUTES.SIGN_UP}
                  className="w-full text-center py-3 bg-primary text-primary-foreground font-bold"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
