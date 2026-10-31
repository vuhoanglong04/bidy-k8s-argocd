import Link from "next/link";
import { CircleCheckBig, ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

interface CommitmentItem {
  id: string;
  title: string;
  href: string;
}

const COMMITMENTS: CommitmentItem[] = [
  {
    id: "account-verification",
    title: "Tài khoản được xác minh danh tính",
    href: APP_ROUTES.POLICY("account-verification"),
  },
  {
    id: "buyer-protection",
    title: "Bảo vệ quyền lợi người mua",
    href: APP_ROUTES.POLICY("buyer-protection"),
  },
  {
    id: "payment-methods",
    title: "Thanh toán an toàn, minh bạch",
    href: APP_ROUTES.POLICY("payment-methods"),
  },
  {
    id: "fees",
    title: "Phí dịch vụ rõ ràng, không phí ẩn",
    href: APP_ROUTES.POLICY("fees"),
  },
  {
    id: "contact-support",
    title: "Hỗ trợ khi bạn cần",
    href: APP_ROUTES.CONTACT,
  },
];

export function Commitments() {
  return (
    <section
      aria-labelledby="commitments-title"
      className="w-full py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Cột trái: Tiêu đề và mô tả */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Cam kết
            </span>
            <h2
              id="commitments-title"
              className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight text-foreground mt-4"
            >
              Vì sao chọn Bidy?
            </h2>
            <p className="text-foreground-secondary text-base md:text-lg mt-4 leading-relaxed">
              Những nguyên tắc chúng tôi giữ để mỗi phiên đấu giá đều đáng tin
              cậy.
            </p>
          </div>

          {/* Cột phải: Danh sách cam kết liên kết tới chính sách */}
          <div className="lg:col-span-7 w-full">
            <ul className="w-full">
              {COMMITMENTS.map((item, index) => {
                const isLast = index === COMMITMENTS.length - 1;
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
                        <CircleCheckBig className="w-5 h-5 text-primary shrink-0" />
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

export default Commitments;
