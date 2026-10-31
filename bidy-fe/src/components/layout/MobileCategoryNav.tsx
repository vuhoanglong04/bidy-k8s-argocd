'use client';

import Link from 'next/link';

import { Skeleton } from '@/components/common/loading';
import { APP_ROUTES } from '@/constants/routes.constants';
import { useCategoryTree } from '@/services/category';
import type { CategoryTreeNode } from '@/services/category';

/**
 * Danh mục trong menu mobile — cùng nguồn dữ liệu với `CategoryMenu` desktop.
 * Hiển thị thụt lề theo cấp thay vì dropdown lồng, vì trên mobile
 * menu trượt là mẫu tương tác dễ dùng hơn hẳn.
 */
function CategoryBranch({ node, depth }: { node: CategoryTreeNode; depth: number }) {
  return (
    <li>
      <Link
        href={APP_ROUTES.CATEGORY_DETAIL(node.slug)}
        className="text-muted-foreground hover:text-primary block py-1 transition-colors"
        style={{ paddingLeft: `${depth * 0.75}rem` }}
      >
        {node.name}
      </Link>

      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <CategoryBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function MobileCategoryNav() {
  const { data: tree, isPending, isError } = useCategoryTree();

  if (isPending) {
    return (
      <div className="border-border flex flex-col gap-2 border-l-2 pl-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-32" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="border-border text-destructive border-l-2 pl-4 text-sm">Không tải được danh mục.</p>;
  }

  if (!tree?.length) {
    return <p className="border-border text-muted-foreground border-l-2 pl-4 text-sm">Chưa có danh mục nào.</p>;
  }

  return (
    <ul className="border-border flex flex-col gap-1 border-l-2 pl-4 text-base">
      {tree.map((node) => (
        <CategoryBranch key={node.id} node={node} depth={0} />
      ))}
    </ul>
  );
}

export default MobileCategoryNav;
