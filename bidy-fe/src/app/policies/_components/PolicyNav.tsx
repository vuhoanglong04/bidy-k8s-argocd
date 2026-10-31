"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_ROUTES } from "@/constants/routes.constants";
import { POLICY_DOCS, PolicyDoc } from "@/constants/policies.constants";
import { cn } from "@/lib/utils";

interface PolicyGroupConfig {
  label: string;
  group: PolicyDoc["group"];
}

const POLICY_GROUPS: readonly PolicyGroupConfig[] = [
  { label: "Pháp lý", group: "legal" },
  { label: "Giao dịch", group: "trade" },
];

const getNavLinkClass = (isActive: boolean) =>
  cn(
    "block whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors shrink-0",
    "border-b-2 lg:border-b-0 lg:border-l-2",
    isActive
      ? "border-primary text-primary bg-accent-subtle"
      : "border-transparent text-muted-foreground hover:text-foreground"
  );

export function PolicyNav() {
  const pathname = usePathname();
  const isHubActive = pathname === APP_ROUTES.POLICIES;

  return (
    <nav className="w-full flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible scrollbar-hide gap-1 lg:gap-6 text-sm">
      {/* Link to Hub */}
      <div className="shrink-0">
        <Link
          href={APP_ROUTES.POLICIES}
          className={getNavLinkClass(isHubActive)}
        >
          Tất cả chính sách
        </Link>
      </div>

      {/* Nhóm chính sách */}
      {POLICY_GROUPS.map(({ label, group }) => {
        const docs = POLICY_DOCS.filter((doc) => doc.group === group);
        return (
          <div key={group} className="flex flex-row lg:flex-col gap-1 shrink-0">
            <span className="hidden lg:block px-3 py-1 font-bold text-xs uppercase tracking-widest text-muted-foreground">
              {label}
            </span>
            <div className="flex flex-row lg:flex-col gap-1">
              {docs.map((doc) => {
                const href = APP_ROUTES.POLICY(doc.slug);
                const isActive = pathname === href;
                return (
                  <Link
                    key={doc.slug}
                    href={href}
                    className={getNavLinkClass(isActive)}
                  >
                    {doc.title}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
