"use client";

import Link from "next/link";
import { getHomepageCategories } from "@/constants/categories.constants";
import { APP_ROUTES } from "@/constants/routes.constants";
import { UnifiedCategory } from "@/types/category.types";
import { 
  Building, 
  Car, 
  Cat, 
  Sofa, 
  Gamepad2, 
  Baby, 
  Gift, 
  Laptop, 
  Briefcase, 
  Shirt, 
  LayoutGrid 
} from "lucide-react";

const getCategoryIcon = (id: string, className?: string) => {
  const props = { strokeWidth: 1.5, className };
  switch (id) {
    case 'bat-dong-san': return <Building {...props} />;
    case 'xe-co': return <Car {...props} />;
    case 'thu-cung': return <Cat {...props} />;
    case 'do-gia-dung-noi-that-cay-canh': return <Sofa {...props} />;
    case 'giai-tri-the-thao-so-thich': return <Gamepad2 {...props} />;
    case 'me-va-be': return <Baby {...props} />;
    case 'cho-tang-mien-phi': return <Gift {...props} />;
    case 'do-dien-tu': return <Laptop {...props} />;
    case 'do-dung-van-phong-cong-nong-nghiep': return <Briefcase {...props} />;
    case 'thoi-trang-do-dung-ca-nhan': return <Shirt {...props} />;
    case 'tat-ca-danh-muc': return <LayoutGrid {...props} />;
    default: return <LayoutGrid {...props} />;
  }
};

export default function Categories() {
  const categories: UnifiedCategory[] = getHomepageCategories();

  return (
    <section className="w-full py-16 md:py-24 px-4 lg:px-8 relative z-10 max-w-[1400px] mx-auto">
      {/* Header Section */}
      <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-4 max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-serif tracking-tighter leading-none text-foreground antialiased">
            Danh mục tài sản.
          </h2>
          <p className="text-sm md:text-base text-foreground/60 leading-relaxed font-light">
            Khám phá các hạng mục đấu giá được phân loại có hệ thống. Từ bất động sản thương mại đến các hiện vật sưu tầm độc bản.
          </p>
        </div>
        <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-foreground/40">
          <p>Hiển thị {categories.length} hạng mục</p>
        </div>
      </div>

      {/* Categories Grid - Architectural Table/Grid */}
      <div className="w-full border-t border-l border-foreground/10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={category.href!}
            className="group relative flex flex-col justify-between p-5 md:p-6 h-36 md:h-40 border-b border-r border-foreground/10 hover:bg-foreground/[0.02] transition-colors duration-300"
            aria-label={`Danh mục ${category.name}`}
          >
            {/* Top row: Icon and Badge */}
            <div className="flex justify-between items-start w-full">
              <div className="text-foreground/50 group-hover:text-foreground transition-colors duration-300">
                {getCategoryIcon(category.id, "w-6 h-6 md:w-8 md:h-8")}
              </div>
              
              {category.badge && (
                <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border border-foreground/20 text-foreground/70 rounded-full group-hover:border-foreground/40 transition-colors">
                  {category.badge.text}
                </span>
              )}
            </div>

            {/* Bottom row: Name */}
            <div className="w-full">
              <h3 className="text-sm md:text-base font-medium text-foreground tracking-tight leading-tight group-hover:translate-x-1 transition-transform duration-300 pr-2">
                {category.displayName}
              </h3>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer minimal spacer or CTA if needed */}
      <div className="mt-12 md:mt-16 pt-8 border-t border-foreground/10 flex justify-between items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">Bạn muốn thanh lý tài sản?</span>
        <Link
          href={APP_ROUTES.AUCTION_NEW}
          className="font-mono text-[10px] uppercase tracking-widest text-foreground hover:text-foreground/60 transition-colors border-b border-foreground/30 pb-1"
        >
          Đăng đấu giá ngay →
        </Link>
      </div>
    </section>
  );
}