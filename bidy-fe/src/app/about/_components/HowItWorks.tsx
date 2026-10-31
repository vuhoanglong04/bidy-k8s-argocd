import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

interface StepItem {
  number: string;
  title: string;
  description: string;
}

const STEPS: StepItem[] = [
  {
    number: "01",
    title: "Tham khảo sản phẩm",
    description: "Khám phá các món đồ đã được xác minh trong nhiều danh mục.",
  },
  {
    number: "02",
    title: "Tạo tài khoản miễn phí",
    description: "Đăng ký nhanh chóng, chỉ mất vài phút.",
  },
  {
    number: "03",
    title: "Tham gia đấu giá",
    description: "Đặt giá theo chiến lược của bạn trong thời gian thực.",
  },
  {
    number: "04",
    title: "Thanh toán & nhận hàng",
    description: "Thanh toán bảo mật, giao nhận tận tay người thắng.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="w-full border-b border-border bg-muted/40 py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* Header 2 cột */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-12">
          <div className="flex flex-col items-start max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Quy trình
            </span>
            <h2
              id="how-it-works-title"
              className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight text-foreground mt-4"
            >
              Bốn bước để sở hữu món đồ bạn muốn.
            </h2>
          </div>
          <Link
            href={APP_ROUTES.GUIDE}
            className="inline-flex items-center gap-2 text-primary uppercase tracking-widest text-xs font-bold hover:underline transition-all group shrink-0"
          >
            <span>Xem hướng dẫn chi tiết</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* Grid 4 bước */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="bg-card p-8 min-h-[220px] flex flex-col justify-between gap-6"
            >
              <span className="font-mono text-5xl font-extrabold text-primary/20 select-none">
                {step.number}
              </span>
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm text-foreground-secondary leading-relaxed mt-2">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
