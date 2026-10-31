"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface PaginationCustomProps {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export default function PaginationCustom({
  totalPages,
  currentPage,
  onPageChange,
}: PaginationCustomProps) {
  const generatePages = () => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);

    if (currentPage <= 3) return [1, 2, 3, "...", totalPages];
    if (currentPage >= totalPages - 2)
      return [1, "...", totalPages - 2, totalPages - 1, totalPages];

    return [1, "...", currentPage, "...", totalPages];
  };

  const pages = generatePages();

  return (
    <Pagination className="mt-6">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            className={cn(
              "bg-background hover:bg-secondary text-foreground hover:text-foreground border border-muted cursor-pointer",
              currentPage <= 1 &&
                "opacity-50 cursor-default pointer-events-none"
            )}
            onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          />
        </PaginationItem>

        {pages.map((page, idx) =>
          page === "..." ? (
            <PaginationItem key={idx}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={idx}>
              <PaginationLink
                className={cn(
                  "hover:bg-secondary hover:text-foreground border border-muted",
                  page === currentPage &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                )}
                isActive={page === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(Number(page));
                }}
                href="#"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            className={cn(
              "bg-background hover:bg-secondary text-foreground hover:text-foreground border border-muted cursor-pointer",
              currentPage >= totalPages &&
                "opacity-50 cursor-default pointer-events-none"
            )}
            onClick={() =>
              currentPage < totalPages && onPageChange(currentPage + 1)
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
