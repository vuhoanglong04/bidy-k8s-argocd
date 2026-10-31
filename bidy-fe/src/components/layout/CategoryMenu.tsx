'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Skeleton } from '@/components/common/loading';
import { APP_ROUTES } from '@/constants/routes.constants';
import { cn } from '@/lib/utils';
import { useCategoryTree } from '@/services/category';
import type { CategoryTreeNode } from '@/services/category';

interface CategoryMenuProps {
  /** Đánh dấu trạng thái active khi đang ở trang danh mục. */
  isActive?: boolean;
  className?: string;
}

const categoryHref = (node: CategoryTreeNode) => APP_ROUTES.CATEGORY_DETAIL(node.slug);

function SubcategoryPanel({ node }: Readonly<{ node: CategoryTreeNode }>) {
  return (
    <div className="flex flex-col gap-1">
      <Link
        href={categoryHref(node)}
        className="text-foreground hover:text-primary focus-visible:ring-ring text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        Tất cả {node.name.toLowerCase()}
      </Link>

      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
        {node.children.map((child) => (
          <li key={child.id}>
            <Link
              href={categoryHref(child)}
              className="text-muted-foreground hover:text-primary focus-visible:ring-ring block py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {child.name}
            </Link>

            {child.children.length > 0 && (
              <ul className="border-border mt-1 ml-3 flex flex-col gap-0.5 border-l pl-3">
                {child.children.map((grandChild) => (
                  <li key={grandChild.id}>
                    <Link
                      href={categoryHref(grandChild)}
                      className="text-muted-foreground/80 hover:text-primary focus-visible:ring-ring block py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {grandChild.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Menu danh mục đa cấp cho header.
 *
 * Cây danh mục là dữ liệu động (`GET /api/v1/categories/tree`), sâu tuỳ ý.
 * Layout hai cột: cột trái là danh mục gốc, cột phải hiện danh mục con của mục
 * đang chọn — tránh dropdown lồng nhau vốn rất khó dùng trên trackpad.
 * Khi cây chỉ có một cấp, menu tự thu về dạng danh sách đơn.
 */
export function CategoryMenu({ isActive = false, className }: Readonly<CategoryMenuProps>) {
  const [open, setOpen] = useState(false);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const { data: tree, isPending, isError, refetch } = useCategoryTree();

  const roots = tree ?? [];
  const hasNesting = roots.some((node) => node.children.length > 0);
  const activeRoot = roots.find((node) => node.id === activeRootId) ?? roots[0] ?? null;

  const close = useCallback(() => setOpen(false), []);

  // Đóng khi click ra ngoài hoặc nhấn Escape.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={containerRef} className={cn('relative flex h-full items-center', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'focus-visible:ring-ring flex items-center gap-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
          isActive || open ? 'text-primary' : 'text-foreground hover:text-primary',
        )}
      >
        Danh mục
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={menuId}
          className={cn(
            'bg-popover text-popover-foreground border-border absolute top-full left-0 z-50 mt-2 border shadow-lg',
            'animate-fade-in',
            hasNesting ? 'w-[680px]' : 'w-72',
          )}
        >
          {isPending && (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-start gap-2 p-4">
              <p className="text-destructive text-sm">Không tải được danh mục.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-primary hover:text-primary-hover focus-visible:ring-ring text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Thử lại
              </button>
            </div>
          )}

          {!isPending && !isError && roots.length === 0 && (
            <p className="text-muted-foreground p-4 text-sm">Chưa có danh mục nào.</p>
          )}

          {!isPending && !isError && roots.length > 0 && (
            <div className={cn('flex', hasNesting && 'divide-border divide-x')} onClick={close}>
              {/* Cột trái: danh mục gốc */}
              <nav aria-label="Danh mục" className={cn('py-2', hasNesting ? 'w-60 shrink-0' : 'w-full')}>
                <Link
                  href={APP_ROUTES.CATEGORY_ALL}
                  className="text-foreground hover:bg-accent-subtle hover:text-primary focus-visible:ring-ring block px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                >
                  Tất cả danh mục
                </Link>

                <ul className="mt-1">
                  {roots.map((node) => {
                    const selected = hasNesting && activeRoot?.id === node.id;
                    return (
                      <li key={node.id}>
                        <Link
                          href={categoryHref(node)}
                          onMouseEnter={() => setActiveRootId(node.id)}
                          onFocus={() => setActiveRootId(node.id)}
                          className={cn(
                            'focus-visible:ring-ring flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                            selected
                              ? 'bg-accent-subtle text-primary font-medium'
                              : 'text-foreground hover:bg-accent-subtle hover:text-primary',
                          )}
                        >
                          <span className="truncate">{node.name}</span>
                          {node.children.length > 0 && <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Cột phải: danh mục con */}
              {hasNesting && (
                <div className="min-w-0 flex-1 p-4">
                  {activeRoot && activeRoot.children.length > 0 ? (
                    <SubcategoryPanel node={activeRoot} />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {activeRoot ? `${activeRoot.name} chưa có danh mục con.` : 'Chọn một danh mục.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoryMenu;
