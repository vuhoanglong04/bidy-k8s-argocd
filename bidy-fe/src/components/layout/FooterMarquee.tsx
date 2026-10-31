import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

interface CtaItem {
  title: string;
  action: string;
  href: string;
}

const CTA_ITEMS: CtaItem[] = [
  { title: "Bạn muốn mua sản phẩm độc bản?", action: "Tạo tài khoản", href: APP_ROUTES.SIGN_UP },
  { title: "Bạn muốn đăng bán đấu giá?", action: "Đăng sản phẩm", href: APP_ROUTES.AUCTION_NEW },
  { title: "Khám phá phiên đấu giá sôi nổi nhất", action: "Xem ngay", href: APP_ROUTES.CATEGORY_ALL },
];

interface MarqueeListProps {
  isDuplicate?: boolean;
}

function MarqueeList({ isDuplicate = false }: MarqueeListProps) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={isDuplicate ? true : undefined}
    >
      {CTA_ITEMS.map((item, index) => (
        <Link
          key={`${item.href}-${index}`}
          href={item.href}
          tabIndex={isDuplicate ? -1 : undefined}
          className="group/item flex items-center gap-3.5 whitespace-nowrap px-6 py-3 md:px-8 md:py-3.5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-footer-band-accent"
        >
          <span className="text-base font-bold tracking-tight text-footer-band-foreground md:text-lg">
            {item.title}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.2em] text-footer-band-accent transition-colors group-hover/item:text-footer-band-foreground">
            {item.action}
            <ArrowUpRight size={13} aria-hidden="true" />
          </span>
          <span aria-hidden className="ml-[18px] block size-[7px] bg-primary" />
        </Link>
      ))}
    </div>
  );
}

export function FooterMarquee() {
  return (
    <div className="group overflow-hidden border-b-4 border-primary bg-footer-band">
      {/* 
        The CTA track is duplicated to achieve a seamless horizontal marquee loop.
        The second copy is aria-hidden with tabIndex={-1} on its links so assistive technologies
        and keyboard focus navigation interact with the CTA list only once.
      */}
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none">
        <MarqueeList />
        <MarqueeList isDuplicate />
      </div>
    </div>
  );
}
