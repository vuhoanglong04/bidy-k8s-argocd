"use client";

import { useCallback, useMemo, useState } from "react";

import { AuctionShowcase } from "@/components/home/AuctionShowcase";
import FeaturedCategories from "@/components/home/FeaturedCategories";
import HammerIntro from "@/components/home/HammerIntro";
import LandingHero from "@/components/home/LandingHero";
import { APP_ROUTES } from "@/constants/routes.constants";
import { isStillLive, type MappedAuction } from "@/services/auction.mapper";
import {
  useEndingSoonAuctions,
  useHottestAuctions,
  useNewestAuctions,
  useUpcomingAuctions,
} from "@/services/product";
import { useServerTime } from "@/services/time";

export default function Home() {
  const { getServerNow } = useServerTime();
  const [introActive, setIntroActive] = useState(true);
  const handleIntroDone = useCallback(() => setIntroActive(false), []);

  const { statusProducts: endingSoonRaw, isLoading: isEndingSoonLoading } = useEndingSoonAuctions();
  const { statusProducts: hottestRaw, isLoading: isHottestLoading } = useHottestAuctions();
  const { statusProducts: newestRaw, isLoading: isNewestLoading } = useNewestAuctions();
  const { statusProducts: upcomingRaw, isLoading: isUpcomingLoading } = useUpcomingAuctions();

  const dropExpired = useCallback(
    (auctions: MappedAuction[]) => {
      const now = getServerNow();
      return auctions.filter((auction) => isStillLive(auction, now));
    },
    [getServerNow],
  );

  const endingSoon = useMemo(() => dropExpired(endingSoonRaw), [dropExpired, endingSoonRaw]);
  const hottest = useMemo(() => dropExpired(hottestRaw), [dropExpired, hottestRaw]);
  const newest = useMemo(() => dropExpired(newestRaw), [dropExpired, newestRaw]);

  /**
   * Phiên sắp mở: bỏ những phiên mà giờ bắt đầu đã trôi qua (cron chỉ lật trạng
   * thái mỗi 10s nên `status=pending` vẫn có thể trả về phiên vừa tới giờ), rồi
   * sắp theo `startDate` tăng dần vì backend không sort được theo cột này.
   */
  const upcoming = useMemo(() => {
    const now = getServerNow();
    return (upcomingRaw as MappedAuction[])
      .filter((auction) => {
        const startsAt = new Date(auction.startDate).getTime();
        return Number.isFinite(startsAt) ? startsAt > now : true;
      })
      .sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      )
      .slice(0, 8);
  }, [getServerNow, upcomingRaw]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center overflow-x-clip bg-background font-sans">
      {/* INTRO: chỉ lần đầu; búa gõ + SOLD rồi bay về hero */}
      <HammerIntro onDone={handleIntroDone} />

      {/* HERO */}
      <LandingHero introActive={introActive} />

      {/* CATEGORIES */}
      <FeaturedCategories />

      {/* AUCTIONS GRID */}
      <div className="bg-background flex w-full justify-center px-2 md:px-6 lg:px-6">
        <div className="flex w-full max-w-[1280px] flex-col gap-16 py-16">
          <AuctionShowcase
            title="Sắp kết thúc"
            subtitle="Những phiên đóng sớm nhất — đặt giá trước khi hết giờ."
            auctions={endingSoon}
            isLoading={isEndingSoonLoading}
            viewAllHref={APP_ROUTES.CATEGORY_ALL}
            emptyMessage="Hiện chưa có phiên nào sắp kết thúc."
          />

          <AuctionShowcase
            title="Sắp bắt đầu"
            subtitle="Phiên chưa mở — đếm ngược tới giờ đặt giá đầu tiên."
            auctions={upcoming}
            isLoading={isUpcomingLoading}
            emptyMessage="Chưa có phiên nào được hẹn giờ."
          />

          <AuctionShowcase
            title="Đang đấu giá sôi nổi nhất"
            subtitle="Xếp theo số người tham gia."
            auctions={hottest}
            isLoading={isHottestLoading}
            emptyMessage="Chưa có phiên nào có người tham gia."
          />

          <AuctionShowcase
            title="Mới lên sàn"
            subtitle="Vừa được đăng gần đây."
            auctions={newest}
            isLoading={isNewestLoading}
            emptyMessage="Chưa có phiên nào được đăng."
          />
        </div>
      </div>
    </div>
  );
}
