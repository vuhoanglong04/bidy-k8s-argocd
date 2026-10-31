import Link from "next/link";
import { BookOpen, ShieldCheck, CreditCard, Receipt, ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

interface HelpLinkItem {
  id: string;
  title: string;
  href: string;
  icon: typeof BookOpen;
}

const HELP_LINKS: HelpLinkItem[] = [
  {
    id: "guide",
    title: "Hướng dẫn sử dụng",
    href: APP_ROUTES.GUIDE,
    icon: BookOpen,
  },
  {
    id: "buyer-protection",
    title: "Bảo vệ quyền lợi người mua",
    href: APP_ROUTES.POLICY("buyer-protection"),
    icon: ShieldCheck,
  },
  {
    id: "payment-methods",
    title: "Phương thức thanh toán",
    href: APP_ROUTES.POLICY("payment-methods"),
    icon: CreditCard,
  },
  {
    id: "fees",
    title: "Biểu phí dịch vụ",
    href: APP_ROUTES.POLICY("fees"),
    icon: Receipt,
  },
];

export function ContactHelp() {
  return (
    <section
      aria-labelledby="contact-help-title"
      className="w-full py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-5 flex flex-col items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Trợ giúp nhanh
            </span>
            <h2
              id="contact-help-title"
              className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight text-foreground mt-4"
            >
              Trước khi liên hệ
            </h2>
            <p className="text-foreground-secondary text-base md:text-lg mt-4 leading-relaxed">
              Bạn có thể tự tìm câu trả lời nhanh chóng qua các tài liệu hướng
              dẫn và điều khoản chính sách của Bidy.
            </p>
          </div>

          <div className="lg:col-span-7 w-full">
            <ul className="w-full">
              {HELP_LINKS.map((item, index) => {
                const isLast = index === HELP_LINKS.length - 1;
                const Icon = item.icon;
                return (
                  <li
                    key={item.id}
                    className={`border-t border-border ${isLast ? "border-b" : ""}`}
                  >
                    <Link
                      href={item.href}
                      className="w-full py-5 px-2 flex justify-between items-center group hover:bg-accent-subtle transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactHelp;
