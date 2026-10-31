"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/common";
import { APP_ROUTES } from "@/constants/routes.constants";
import { useAuth } from "@/hooks/useAuth";
import { FooterLinkTabs } from "./FooterLinkTabs";
import { FooterMarquee } from "./FooterMarquee";

const AUTH_ROUTES = [
  APP_ROUTES.SIGN_IN,
  APP_ROUTES.SIGN_UP,
  APP_ROUTES.FORGOT_PASS,
  APP_ROUTES.RESET_PASS,
];

export default function Footer() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isAdminPage = pathname === APP_ROUTES.ADMIN || pathname.startsWith(`${APP_ROUTES.ADMIN}/`);
  const isMessagesPage = pathname === APP_ROUTES.MY_MESSAGES;
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  // Hide footer on admin management screens and dedicated messaging views
  if (isAdminPage || isMessagesPage) return null;

  const showCta = !isAuthPage && !isAuthenticated;

  return (
    <footer className="w-full bg-footer font-sans text-footer-foreground">
      {showCta ? <FooterMarquee /> : <div aria-hidden className="h-1 bg-primary" />}

      <div className="mx-auto w-full max-w-[1440px] px-6 py-9 md:px-12 lg:px-20 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col justify-between gap-4 lg:col-span-3">
          <Link href={APP_ROUTES.HOME} aria-label="Bidy - Trang chủ">
            <BrandLogo className="h-[34px] w-auto" />
          </Link>
          <p className="max-w-[280px] text-[13px] leading-relaxed text-footer-muted-foreground">
            Nền tảng đấu giá trực tuyến chuyên nghiệp. Khám phá những món đồ độc bản và trải nghiệm đấu giá minh bạch, an toàn.
          </p>
        </div>

        <div className="lg:col-span-9">
          <FooterLinkTabs />
        </div>
      </div>
    </footer>
  );
}
