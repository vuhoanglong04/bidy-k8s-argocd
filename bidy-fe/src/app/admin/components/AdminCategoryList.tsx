"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import ConfirmationDialog from "@/components/common/confirmation-dialog";
import { LoadingState } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MAX_CATEGORY_DEPTH,
  useAdminCategoryTree,
  useDeleteAdminCategory,
  useUpdateAdminCategoryStatus,
} from "@/services/admin";
import { AdminCategoryNode } from "@/types";
import AdminPanel from "./AdminPanel";
import StatTile from "./StatTile";
import StatusPill from "./StatusPill";
import CategoryWizardDialog, {
  type CategoryWizardTarget,
} from "./CategoryWizardDialog";

/** Lọc cây theo từ khoá, giữ lại nhánh cha của mọi node khớp. */
const filterTree = (
  nodes: AdminCategoryNode[],
  keyword: string
): AdminCategoryNode[] => {
  if (!keyword) return nodes;

  return nodes.reduce<AdminCategoryNode[]>((acc, node) => {
    const children = filterTree(node.children, keyword);
    const isMatch = node.name.toLowerCase().includes(keyword);

    if (isMatch || children.length > 0) {
      acc.push({ ...node, children });
    }

    return acc;
  }, []);
};

export default function AdminCategoryList() {
  const { tree, categories, flatNodes, isLoading, isError, error, refetchCategories } =
    useAdminCategoryTree();
  const { mutate: updateStatus } = useUpdateAdminCategoryStatus();
  const { mutate: deleteCategory } = useDeleteAdminCategory();

  const [keyword, setKeyword] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<CategoryWizardTarget>({
    mode: "create",
    node: null,
  });

  const normalizedKeyword = keyword.trim().toLowerCase();
  const visibleTree = useMemo(
    () => filterTree(tree, normalizedKeyword),
    [tree, normalizedKeyword]
  );

  const activeCount = categories.filter((c) => c.isActive).length;
  const rootCount = tree.length;

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openWizard = (target: CategoryWizardTarget) => {
    setWizardTarget(target);
    setWizardOpen(true);
  };

  const renderNode = (node: AdminCategoryNode) => {
    // Khi đang tìm kiếm thì luôn mở nhánh, nếu không kết quả sẽ bị giấu sau
    // một node cha đang thu gọn.
    const isCollapsed = !normalizedKeyword && collapsedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const canAddChild = node.depth < MAX_CATEGORY_DEPTH;

    return (
      <li key={node.id}>
        <div
          className={cn(
            "flex items-center gap-3 border-b border-border py-2.5 pr-4 transition-colors hover:bg-accent",
            !node.isActive && "opacity-60"
          )}
          style={{ paddingLeft: `${(node.depth - 1) * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapse(node.id)}
              aria-label={isCollapsed ? "Mở nhánh" : "Thu gọn nhánh"}
              aria-expanded={!isCollapsed}
              className="cursor-pointer p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <span className="w-[22px]" aria-hidden />
          )}

          <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted">
            {node.imageUrl ? (
              <Image
                src={node.imageUrl}
                alt={node.name}
                fill
                sizes="36px"
                className="object-cover"
              />
            ) : (
              <ImageOff size={14} className="text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{node.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              /{node.slug}
            </p>
          </div>

          {hasChildren && (
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {node.children.length} danh mục con
            </span>
          )}

          <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
            Cấp {node.depth}
          </span>

          {node.isActive ? (
            <StatusPill label="Hiển thị" tone="success" />
          ) : (
            <StatusPill label="Đang ẩn" tone="neutral" />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hành động cho ${node.name}`}
                className="size-8 shrink-0 cursor-pointer rounded-none"
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-none">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => openWizard({ mode: "edit", node })}
              >
                <Pencil size={14} /> Sửa danh mục
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer"
                disabled={!canAddChild}
                onClick={() => openWizard({ mode: "create", node })}
              >
                <Plus size={14} />
                {canAddChild ? "Thêm danh mục con" : `Đã đạt ${MAX_CATEGORY_DEPTH} cấp`}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => updateStatus({ id: node.id, isActive: !node.isActive })}
              >
                {node.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                {node.isActive ? "Ẩn danh mục" : "Hiện danh mục"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <ConfirmationDialog
                trigger={
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 size={14} /> Xoá danh mục
                  </DropdownMenuItem>
                }
                title={`Xoá "${node.name}"?`}
                description="Chỉ xoá được khi danh mục không còn danh mục con và không còn sản phẩm nào."
                confirmText="Xoá"
                cancelText="Huỷ"
                onConfirm={() => deleteCategory(node.id)}
                confirmButtonClassName="cursor-pointer"
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChildren && !isCollapsed && <ul>{node.children.map(renderNode)}</ul>}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Tổng danh mục" value={categories.length} />
        <StatTile label="Đang hiển thị" value={activeCount} />
        <StatTile label="Danh mục gốc" value={rootCount} />
      </div>

      <AdminPanel
        title="Cây danh mục"
        description={`Tối đa ${MAX_CATEGORY_DEPTH} cấp — tên phải khác nhau trong cùng một cấp cha`}
        action={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm danh mục…"
                className="rounded-none pl-9"
              />
            </div>
            <Button
              type="button"
              className="cursor-pointer rounded-none"
              onClick={() => openWizard({ mode: "create", node: null })}
            >
              <Plus size={16} /> Thêm danh mục
            </Button>
          </div>
        }
        flush
      >
        <LoadingState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={visibleTree.length === 0}
          onRetry={refetchCategories}
          emptyMessage={
            normalizedKeyword
              ? "Không có danh mục nào khớp từ khoá."
              : "Chưa có danh mục nào. Bấm “Thêm danh mục” để bắt đầu."
          }
        >
          <ul className="border-t border-border">{visibleTree.map(renderNode)}</ul>
        </LoadingState>
      </AdminPanel>

      <CategoryWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        target={wizardTarget}
        tree={tree}
        flatNodes={flatNodes}
      />
    </div>
  );
}
