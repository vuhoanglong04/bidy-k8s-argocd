"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";

interface FooterLinkGroup {
  title: string;
  links: { href: string; label: string }[];
}

const FOOTER_GROUPS: FooterLinkGroup[] = [
  {
    title: "Thông tin",
    links: [
      { href: APP_ROUTES.HOME, label: "Trang chủ" },
      { href: APP_ROUTES.ABOUT, label: "Về chúng tôi" },
      { href: APP_ROUTES.GUIDE, label: "Hướng dẫn" },
    ],
  },
  {
    title: "Chính sách",
    links: [
      { href: APP_ROUTES.POLICY("buyer-protection"), label: "An toàn người mua" },
      { href: APP_ROUTES.POLICY("account-verification"), label: "Xác minh tài khoản" },
      { href: APP_ROUTES.POLICY("fees"), label: "Phí dịch vụ" },
      { href: APP_ROUTES.POLICY("payment-methods"), label: "Phương thức thanh toán" },
    ],
  },
  {
    title: "Hỗ trợ khách hàng",
    links: [
      { href: APP_ROUTES.CONTACT, label: "Liên hệ" },
      { href: APP_ROUTES.POLICY("regulations"), label: "Quy chế hoạt động" },
      { href: APP_ROUTES.POLICY("terms"), label: "Điều khoản dịch vụ" },
      { href: APP_ROUTES.POLICY("privacy"), label: "Bảo mật thông tin" },
      { href: APP_ROUTES.POLICIES, label: "Tất cả chính sách" },
    ],
  },
];

export function FooterLinkTabs() {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = (index + 1) % FOOTER_GROUPS.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = (index - 1 + FOOTER_GROUPS.length) % FOOTER_GROUPS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = FOOTER_GROUPS.length - 1;
    }

    if (nextIndex !== -1) {
      setActive(nextIndex);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-9 lg:gap-8">
      {/* Tablist navigation */}
      <div
        role="tablist"
        aria-label="Liên kết"
        className="flex flex-col justify-center gap-0.5 lg:col-span-3 lg:border-l lg:border-footer-border lg:pl-8"
      >
        {FOOTER_GROUPS.map((group, index) => {
          const isSelected = active === index;
          const tabId = `${baseId}-tab-${index}`;
          const panelId = `${baseId}-panel-${index}`;

          return (
            <button
              key={group.title}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "flex items-center gap-3 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                isSelected
                  ? "text-footer-foreground"
                  : "text-footer-muted-foreground hover:text-footer-foreground"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "block size-2.5 shrink-0",
                  isSelected ? "bg-primary" : "bg-transparent"
                )}
              />
              <span className="text-2xl font-bold leading-[1.15] tracking-[-0.03em] lg:text-[28px]">
                {group.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* 
        All panels remain in the DOM so crawlers and search indexers can parse all links.
        Inactive panels are hidden visually and from accessibility tree via the hidden attribute.
      */}
      <div className="lg:col-span-6">
        {FOOTER_GROUPS.map((group, index) => {
          const isSelected = active === index;
          const tabId = `${baseId}-tab-${index}`;
          const panelId = `${baseId}-panel-${index}`;

          return (
            <div
              key={group.title}
              role="tabpanel"
              id={panelId}
              aria-labelledby={tabId}
              hidden={!isSelected}
              className={cn(
                "flex flex-col border border-footer-glass-border bg-linear-to-br from-footer-glass-from to-footer-glass-to px-6 pt-5 pb-3.5 text-footer-foreground shadow-[inset_0_1px_0_var(--footer-glass-border),0_18px_36px_-14px_var(--footer-glass-shadow)] backdrop-blur-[18px] backdrop-saturate-[1.4] lg:px-7",
                !isSelected && "hidden"
              )}
            >
              <span className="border-b border-footer-border pb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-footer-label">
                {group.title}
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-7">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group/link flex items-center justify-between border-b border-footer-border py-2.5 text-[15px] tracking-[-0.01em] transition-[padding] hover:pl-1.5 hover:underline hover:decoration-2 hover:underline-offset-[5px]"
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
