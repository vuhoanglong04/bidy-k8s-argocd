import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

export function ContactHero() {
  return (
    <section
      aria-labelledby="contact-hero-title"
      className="w-full border-b border-border py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 flex flex-col items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Liên hệ
            </span>
            <h1
              id="contact-hero-title"
              className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight uppercase leading-[1.05] text-foreground mt-4"
            >
              Chúng tôi luôn sẵn sàng hỗ trợ.
            </h1>
            <p className="text-foreground-secondary text-base md:text-lg max-w-2xl mt-6 leading-relaxed">
              Chọn kênh liên hệ phù hợp bên dưới để kết nối với đội ngũ Bidy. Các
              câu hỏi thường gặp và hướng dẫn chi tiết luôn có sẵn trong trang
              Hướng dẫn.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <Link
                href={APP_ROUTES.GUIDE}
                className="h-12 px-6 font-bold uppercase text-sm tracking-widest bg-primary text-primary-foreground hover:bg-primary-hover transition-colors inline-flex items-center justify-center gap-2 group"
              >
                <span>Xem hướng dẫn sử dụng</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactHero;
