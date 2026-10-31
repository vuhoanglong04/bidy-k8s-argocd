"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ProductCardCompact, type UnifiedAuctionItem } from "@/components/auction";
import { cn } from "@/lib/utils";

interface RotatingCardCarouselProps {
  items: UnifiedAuctionItem[];
  /** Nhãn cho vùng carousel, đọc bởi screen reader. */
  label: string;
  className?: string;
}

/** Chỉ dựng 3D cho lá gần tâm — xa hơn thì ẩn hẳn để khỏi tốn layer. */
const VISIBLE_DEPTH = 2;
const AUTOPLAY_MS = 4500;

/**
 * Coverflow xoay quanh lá đang chọn: lá tâm hướng thẳng, hai bên nghiêng theo
 * trục Y và lùi về sau theo trục Z.
 *
 * Chỉ lá tâm nhận được click/tab — lá bên cạnh bị `pointer-events-none` và phủ
 * một nút "xoay tới đây", nếu không phần link phủ toàn card của
 * `ProductCardCompact` sẽ nuốt cú click đáng ra chỉ để xoay băng chuyền.
 */
export default function RotatingCardCarousel({
  items,
  label,
  className,
}: Readonly<RotatingCardCarouselProps>) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      setActive(((index % count) + count) % count);
    },
    [count]
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Băng chuyền tự xoay, nhưng dừng khi người dùng đang xem hoặc đang tab vào.
  useEffect(() => {
    if (isPaused || prefersReducedMotion || count < 2) return;
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [isPaused, prefersReducedMotion, count]);

  /** Khoảng cách vòng tròn tới lá tâm: -2, -1, 0, 1, 2… */
  const offsetOf = useCallback(
    (index: number) => {
      let offset = index - active;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      return offset;
    },
    [active, count]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  };

  const dots = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  if (count === 0) return null;

  return (
    <div
      className={cn("flex flex-col items-center gap-5", className)}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="relative flex w-full items-center justify-center">
        {count > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Sản phẩm trước"
            className="absolute left-0 sm:left-2 z-30 inline-flex size-12 items-center justify-center border border-border bg-background text-foreground shadow-md transition-colors hover:bg-accent"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        )}

        {/* Sân khấu 3D. `perspective` đặt ở cha, các lá con giữ preserve-3d. */}
        <div
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(delta) > 40) {
              if (delta < 0) next();
              else prev();
            }
            touchStartX.current = null;
          }}
          className={cn(
            "relative h-[540px] w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[570px]",
            "[perspective:1200px] [transform-style:preserve-3d]"
          )}
        >
          {items.map((item, index) => {
            const offset = offsetOf(index);
            const depth = Math.abs(offset);
            const isActive = offset === 0;
            const isHidden = depth > VISIBLE_DEPTH;
            const sign = Math.sign(offset);
            const shift = depth === 0 ? 0 : depth === 1 ? 106 : 178;
            const scale = isActive ? 1.08 : depth === 1 ? 0.92 : 0.82;

            return (
              <div
                key={item.id ?? item._id ?? index}
                aria-hidden={isHidden || undefined}
                className={cn(
                  "absolute top-4 left-1/2 -ml-[130px] w-[260px] sm:-ml-[150px] sm:w-[300px]",
                  "origin-top transition-[transform,opacity] duration-500 ease-out will-change-transform",
                  "motion-reduce:transition-none",
                  isHidden && "pointer-events-none"
                )}
                style={{
                  transform: `translateX(${sign * shift}%) translateZ(${-depth * 90}px) rotateY(${offset * -10}deg) scale(${scale})`,
                  zIndex: 20 - depth,
                  opacity: isHidden ? 0 : 1,
                }}
              >
                <div
                  className={cn(
                    "transition-[filter,box-shadow] duration-500",
                    isActive
                      ? "shadow-xl dark:shadow-none"
                      : "pointer-events-none shadow-md brightness-90 saturate-75"
                  )}
                >
                  <ProductCardCompact item={item} density="comfortable" />
                </div>

                {/* Lá phụ: click để xoay tới, không mở trang sản phẩm. */}
                {!isActive && !isHidden && (
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-label={`Xem ${item.name}`}
                    className="absolute inset-0 z-10 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Sản phẩm kế tiếp"
            className="absolute right-0 sm:right-2 z-30 inline-flex size-12 items-center justify-center border border-border bg-background text-foreground shadow-md transition-colors hover:bg-accent"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center gap-2">
          {dots.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Tới sản phẩm ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              className={cn(
                "h-1.5 transition-all duration-300",
                index === active
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-border hover:bg-foreground-secondary"
              )}
            />
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        Sản phẩm {active + 1} trên {count}
      </p>
    </div>
  );
}
