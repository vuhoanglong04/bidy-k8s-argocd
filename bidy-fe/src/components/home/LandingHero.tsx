"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Gavel,
  Headphones,
  LayoutGrid,
  ShieldCheck,
  Smartphone,
  Star,
  Watch,
} from "lucide-react";

import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import GavelArt from "./GavelArt";
import { createStrikeTimeline, resetGavel } from "./gavelMotion";

gsap.registerPlugin(useGSAP);

interface LandingHeroProps {
  /**
   * Intro đang chiếm màn hình: ẩn búa của hero (intro sẽ bay búa của nó vào
   * đúng chỗ này) và chưa chạy vòng gõ định kỳ.
   */
  introActive: boolean;
}

/** Id neo để nút "Khám phá danh mục" cuộn xuống section danh mục. */
export const FEATURED_CATEGORIES_ID = "danh-muc-noi-bat";

export default function LandingHero({ introActive }: Readonly<LandingHeroProps>) {
  const artRef = useRef<HTMLDivElement>(null);

  // Búa gõ định kỳ để trang không đứng yên.
  useGSAP(
    () => {
      if (introActive) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        resetGavel(artRef.current);
        createStrikeTimeline(artRef.current, { repeat: -1, repeatDelay: 2.4, delay: 1.2 });

        gsap.to("[data-float]", {
          y: -10,
          duration: 2.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          stagger: 0.6,
        });
      });
      return () => mm.revert();
    },
    { scope: artRef, dependencies: [introActive] }
  );

  return (
    <section className="w-full bg-background">
      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-20">
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-2 border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary md:text-sm">
            <Gavel className="size-4" aria-hidden />
            Đấu giá trực tuyến · Uy tín · Minh bạch
          </span>

          <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground md:text-5xl xl:text-[58px]">
            Khám phá &amp; Sở hữu
            <span className="block text-primary">những món đồ độc đáo</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground-secondary md:text-lg">
            Tham gia đấu giá trực tuyến dễ dàng, nhanh chóng và an toàn. Từ đồ công nghệ,
            thời trang, nghệ thuật đến các bộ sưu tập hiếm.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href={APP_ROUTES.CATEGORY_ALL}
              className="group inline-flex h-12 items-center justify-center gap-2.5 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover md:text-base"
            >
              <Gavel className="size-5" aria-hidden />
              Xem các phiên đấu giá
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
            <a
              href={`#${FEATURED_CATEGORIES_ID}`}
              className="inline-flex h-12 items-center justify-center gap-2.5 border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:border-foreground md:text-base"
            >
              <LayoutGrid className="size-5" aria-hidden />
              Khám phá danh mục
            </a>
          </div>

          <div className="mt-10 flex items-center gap-8 text-sm text-foreground-secondary">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-7 shrink-0 text-foreground" aria-hidden />
              <p className="leading-snug">
                Đảm bảo
                <br />
                an toàn
              </p>
            </div>
            <span aria-hidden className="h-10 w-px bg-border" />
            <div className="flex items-center gap-3">
              <Headphones className="size-7 shrink-0 text-foreground" aria-hidden />
              <p className="leading-snug">
                Hỗ trợ
                <br />
                24/7
              </p>
            </div>
          </div>
        </div>

        {/* Minh hoạ: búa + bệ + thẻ kính trôi */}
        <div ref={artRef} className="relative mx-auto aspect-[460/420] w-full max-w-[560px]">
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 size-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
          />

          <div
            data-float
            aria-hidden
            className="absolute left-0 top-[14%] flex -rotate-6 flex-col gap-2 border border-border/60 bg-card/70 p-3 shadow-xl backdrop-blur-md"
          >
            <div className="flex gap-2">
              <span className="flex size-14 items-center justify-center bg-muted text-foreground-secondary">
                <Smartphone className="size-7" />
              </span>
              <span className="flex size-14 items-center justify-center bg-muted text-foreground-secondary">
                <Watch className="size-7" />
              </span>
            </div>
            <span className="inline-flex items-center justify-center gap-1 bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
              Giá tốt <Star className="size-3 fill-current" />
            </span>
          </div>

          <div
            data-float
            aria-hidden
            className="absolute right-0 top-[4%] flex rotate-6 flex-col items-center gap-2 border border-border/60 bg-card/70 px-5 py-4 shadow-xl backdrop-blur-md"
          >
            <Gavel className="size-9 text-primary" />
            <span className="font-heading text-lg font-bold text-primary">Đấu giá</span>
            <span className="bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Bắt đầu
            </span>
          </div>

          <GavelArt
            className={cn(
              "absolute inset-0 size-full transition-opacity",
              introActive && "invisible"
            )}
          />
          {/* Mốc để intro tính vị trí đích khi bay búa về */}
          <span data-landing-gavel aria-hidden className="pointer-events-none absolute inset-0" />
        </div>
      </div>
    </section>
  );
}
