"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { APP_ROUTES } from "@/constants/routes.constants";
import { cn } from "@/lib/utils";
import { GUIDE_SECTIONS } from "./guide.data";
import { GuideAccordionItem } from "./GuideAccordionItem";

export default function GuideMain() {
  const [searchTerm, setSearchTerm] = useState("");
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(
    new Set()
  );
  const [collapsedDuringSearch, setCollapsedDuringSearch] = useState<
    Set<string>
  >(new Set());

  const isSearching = searchTerm.trim().length > 0;
  const searchLower = searchTerm.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!isSearching) return GUIDE_SECTIONS;

    return GUIDE_SECTIONS.map((section) => {
      const matchingItems = section.items.filter((item) => {
        if (item.title.toLowerCase().includes(searchLower)) return true;
        return item.blocks.some((block) => {
          if (block.heading && block.heading.toLowerCase().includes(searchLower))
            return true;
          return block.lines.some((line) =>
            line.toLowerCase().includes(searchLower)
          );
        });
      });

      return {
        ...section,
        items: matchingItems,
      };
    }).filter((section) => section.items.length > 0);
  }, [isSearching, searchLower]);

  const totalResults = useMemo(
    () => filteredSections.reduce((acc, s) => acc + s.items.length, 0),
    [filteredSections]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCollapsedDuringSearch(new Set());
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setCollapsedDuringSearch(new Set());
  };

  const isItemExpanded = (itemId: string) => {
    if (isSearching) {
      return !collapsedDuringSearch.has(itemId);
    }
    return manuallyExpanded.has(itemId);
  };

  const toggleItem = (itemId: string) => {
    if (isSearching) {
      setCollapsedDuringSearch((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
    } else {
      setManuallyExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
    }
  };

  return (
    <div className="w-full bg-background min-h-screen">
      {/* Header Section */}
      <section className="w-full border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Trung tâm trợ giúp
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-foreground mt-4">
            Hướng dẫn sử dụng
          </h1>
          <p className="text-foreground-secondary text-base md:text-lg mt-4 max-w-2xl leading-relaxed">
            Tìm hiểu chi tiết về quy trình đấu giá, thanh toán, quản lý tài
            khoản và các chính sách an toàn trên nền tảng Bidy.
          </p>

          {/* Search Box */}
          <div className="max-w-xl mt-8">
            <div className="relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Tìm chủ đề hướng dẫn..."
                aria-label="Tìm chủ đề hướng dẫn"
                className="rounded-none h-12 pl-11 pr-4 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {isSearching ? (
              <div className="flex items-center justify-between mt-2.5 px-1 text-xs">
                <span className="text-muted-foreground font-mono">
                  {totalResults} kết quả
                </span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-primary font-bold uppercase tracking-wider hover:underline cursor-pointer"
                >
                  Xóa
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Sidebar */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24">
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-4 block">
              Chủ đề
            </span>
            <nav
              aria-label="Danh mục chủ đề hướng dẫn"
              className="flex lg:flex-col overflow-x-auto lg:overflow-visible scrollbar-hide gap-1 lg:gap-1 text-sm"
            >
              {filteredSections.map((section) => {
                const originalIndex = GUIDE_SECTIONS.findIndex(
                  (s) => s.id === section.id
                );
                const sectionNumber = String(originalIndex + 1).padStart(
                  2,
                  "0"
                );

                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={cn(
                      "block whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors shrink-0",
                      "border-b-2 lg:border-b-0 lg:border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-accent-subtle"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {sectionNumber}
                        </span>
                        <span>{section.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({section.items.length})
                      </span>
                    </div>
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-9 min-w-0">
            {filteredSections.length > 0 ? (
              <div className="space-y-16">
                {filteredSections.map((section) => {
                  const originalIndex = GUIDE_SECTIONS.findIndex(
                    (s) => s.id === section.id
                  );
                  const sectionNumber = String(originalIndex + 1).padStart(
                    2,
                    "0"
                  );

                  return (
                    <section
                      key={section.id}
                      id={section.id}
                      aria-labelledby={`section-heading-${section.id}`}
                      className="scroll-mt-24"
                    >
                      <div className="flex items-baseline gap-3 mb-6 pb-3 border-b border-border">
                        <span className="font-mono text-base font-bold text-primary">
                          {sectionNumber}
                        </span>
                        <h2
                          id={`section-heading-${section.id}`}
                          className="font-heading text-2xl md:text-3xl font-bold uppercase tracking-tight text-foreground"
                        >
                          {section.title}
                        </h2>
                      </div>

                      <ul className="w-full">
                        {section.items.map((item, index) => {
                          const isLast = index === section.items.length - 1;
                          const isExpanded = isItemExpanded(item.id);

                          return (
                            <GuideAccordionItem
                              key={item.id}
                              item={item}
                              isExpanded={isExpanded}
                              onToggle={() => toggleItem(item.id)}
                              searchTerm={searchTerm}
                              isLast={isLast}
                            />
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="border border-border p-10 md:p-16 text-center bg-background">
                <p className="text-foreground text-base md:text-lg font-medium">
                  Không tìm thấy kết quả cho &ldquo;{searchTerm}&rdquo;
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Thử tìm kiếm với từ khóa khác hoặc kiểm tra lại chính tả.
                </p>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-6 inline-flex items-center justify-center h-10 px-5 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  Xóa tìm kiếm
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer CTA Section */}
      <section className="border-t border-border w-full bg-background mt-16 md:mt-24">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7">
              <h2 className="font-heading text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-foreground">
                Không tìm thấy câu trả lời?
              </h2>
              <p className="text-foreground-secondary text-sm md:text-base mt-2 leading-relaxed">
                Đội ngũ chăm sóc khách hàng của Bidy luôn sẵn sàng hỗ trợ giải
                đáp mọi thắc mắc và hướng dẫn chi tiết cho bạn.
              </p>
            </div>
            <div className="md:col-span-5 flex flex-col sm:flex-row gap-3 md:justify-end">
              <Link
                href={APP_ROUTES.CONTACT}
                className="h-12 px-6 inline-flex items-center justify-center uppercase tracking-widest text-sm font-bold bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shrink-0 text-center"
              >
                Liên hệ hỗ trợ
              </Link>
              <Link
                href={APP_ROUTES.POLICIES}
                className="h-12 px-6 inline-flex items-center justify-center uppercase tracking-widest text-sm font-bold border border-border text-foreground hover:bg-accent-subtle transition-colors shrink-0 text-center"
              >
                Điều khoản & chính sách
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
