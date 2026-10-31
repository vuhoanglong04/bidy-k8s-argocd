import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "@/constants/routes.constants";

export function AboutHero() {
  return (
    <section
      aria-labelledby="about-hero-title"
      className="w-full border-b border-border py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Cột trái: Tiêu đề, giới thiệu và CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Về Bidy
            </span>
            <h1
              id="about-hero-title"
              className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight uppercase leading-[1.05] text-foreground mt-4"
            >
              Nơi giá trị giao thoa với niềm tin.
            </h1>
            <p className="text-foreground-secondary text-lg max-w-xl mt-6 leading-relaxed">
              Bidy kết nối người mua và người bán qua một nền tảng đấu giá trực
              tuyến công bằng, minh bạch và cạnh tranh — nơi mỗi món đồ tìm được
              đúng người trân trọng nó.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <Link
                href={APP_ROUTES.CATEGORY}
                className="h-12 px-6 font-bold uppercase text-sm tracking-widest bg-primary text-primary-foreground hover:bg-primary-hover transition-colors inline-flex items-center justify-center gap-2 group"
              >
                <span>Khám phá phiên đấu giá</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href={APP_ROUTES.AUCTION_NEW}
                className="h-12 px-6 font-bold uppercase text-sm tracking-widest border border-border text-foreground hover:bg-accent-subtle transition-colors inline-flex items-center justify-center"
              >
                Đăng bán sản phẩm
              </Link>
            </div>
          </div>

          {/* Cột phải: Ảnh đại diện với khối trang trí vuông */}
          <div className="lg:col-span-5 w-full">
            <div className="relative w-full max-w-md mx-auto lg:max-w-none">
              <div
                aria-hidden="true"
                className="hidden sm:block absolute -bottom-3 -left-3 h-16 w-16 bg-primary z-0"
              />
              <div className="relative aspect-[4/5] w-full overflow-hidden border border-border bg-muted z-10">
                <Image
                  src="/newsPage.png"
                  alt="Đội ngũ Bidy"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AboutHero;
