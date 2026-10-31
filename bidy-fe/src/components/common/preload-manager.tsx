"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { APP_ROUTES } from "@/constants";

// Critical pages to preload after main page loads
const CRITICAL_PAGES = [
  APP_ROUTES.CATEGORY,
  APP_ROUTES.PROFILE,
  APP_ROUTES.SIGN_IN,
  APP_ROUTES.ABOUT,
  APP_ROUTES.AUCTION_NEW,
];

// Secondary pages to preload with lower priority
const SECONDARY_PAGES = [
  APP_ROUTES.CONTACT,
  APP_ROUTES.GUIDE,
  APP_ROUTES.NOTIFICATIONS,
  APP_ROUTES.SIGN_UP,
];

export function PreloadManager() {
  const router = useRouter();

  useEffect(() => {
    // Preload critical pages immediately after main page loads
    const preloadCriticalPages = () => {
      CRITICAL_PAGES.forEach(route => {
        router.prefetch(route);
      });
    };

    // Preload secondary pages with delay to avoid blocking
    const preloadSecondaryPages = () => {
      setTimeout(() => {
        SECONDARY_PAGES.forEach(route => {
          router.prefetch(route);
        });
      }, 2000); // 2 second delay
    };

    // Start preloading after a short delay to ensure main page is loaded
    const timeoutId = setTimeout(() => {
      preloadCriticalPages();
      preloadSecondaryPages();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [router]);

  // This component renders nothing - it's just for side effects
  return null;
}