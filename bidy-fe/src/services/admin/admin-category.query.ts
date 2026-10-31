import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/hooks";
import { categoryKeys } from "@/services/category";
import {
  AdminCategory,
  AdminCategoryNode,
  AdminCreateCategoryPayload,
  AdminUpdateCategoryPayload,
} from "@/types";
import { handleErrorMessage } from "@/utils/error.utils";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
  updateAdminCategoryStatus,
} from "./admin-category.fetcher";

export const adminCategoryKeys = {
  all: ["admin", "categories"] as const,
  list: () => [...adminCategoryKeys.all, "list"] as const,
};

/** Cấp sâu nhất backend cho phép (`MAX_CATEGORY_DEPTH` trong category.service). */
export const MAX_CATEGORY_DEPTH = 3;

/**
 * Dựng cây từ danh sách phẳng.
 *
 * Node có `parentId` trỏ tới danh mục không nằm trong danh sách (đã xoá mềm
 * chẳng hạn) được nâng lên làm gốc, để không biến mất khỏi màn quản trị.
 */
export const buildCategoryTree = (
  categories: AdminCategory[]
): AdminCategoryNode[] => {
  const nodeMap = new Map<string, AdminCategoryNode>();

  for (const category of categories) {
    nodeMap.set(category.id, { ...category, children: [], depth: 1 });
  }

  const roots: AdminCategoryNode[] = [];

  for (const category of categories) {
    const node = nodeMap.get(category.id) as AdminCategoryNode;
    const parent = category.parentId ? nodeMap.get(category.parentId) : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // `depth` chỉ tính đúng sau khi cây đã nối xong, nên gán ở lượt duyệt riêng.
  const assignDepth = (nodes: AdminCategoryNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots, 1);

  return roots;
};

/** Làm phẳng cây theo thứ tự hiển thị, giữ nguyên `depth`. */
export const flattenCategoryTree = (
  nodes: AdminCategoryNode[]
): AdminCategoryNode[] =>
  nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);

/** Id của chính node và toàn bộ hậu duệ — dùng để chặn chọn cha gây vòng lặp. */
export const collectSubtreeIds = (node: AdminCategoryNode): string[] => [
  node.id,
  ...node.children.flatMap(collectSubtreeIds),
];

export const useAdminCategoryTree = () => {
  const { isAuthenticated } = useAuth();
  const { data, refetch, isLoading, isError, error } = useQuery({
    queryKey: adminCategoryKeys.list(),
    queryFn: fetchAdminCategories,
    enabled: isAuthenticated,
  });

  const categories = useMemo(() => data ?? [], [data]);
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatNodes = useMemo(() => flattenCategoryTree(tree), [tree]);

  return {
    categories,
    tree,
    flatNodes,
    refetchCategories: refetch,
    isLoading,
    isError,
    error,
  };
};

/**
 * Mọi mutation danh mục đều làm cây đổi hình, nên invalidate cả key quản trị
 * lẫn `categoryKeys` của luồng công khai (cây công khai còn bị cache 30 phút
 * ở client và 30 phút ở Redis).
 */
const useAdminCategoryMutation = <TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  successMessage: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onError: handleErrorMessage,
    onSuccess: () => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: adminCategoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

export const useCreateAdminCategory = () =>
  useAdminCategoryMutation(
    (payload: AdminCreateCategoryPayload) => createAdminCategory(payload),
    "Tạo danh mục thành công!"
  );

export const useUpdateAdminCategory = () =>
  useAdminCategoryMutation(
    ({ id, payload }: { id: string; payload: AdminUpdateCategoryPayload }) =>
      updateAdminCategory(id, payload),
    "Cập nhật danh mục thành công!"
  );

export const useUpdateAdminCategoryStatus = () =>
  useAdminCategoryMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAdminCategoryStatus(id, { isActive }),
    "Đã đổi trạng thái danh mục."
  );

export const useDeleteAdminCategory = () =>
  useAdminCategoryMutation(
    (id: string) => deleteAdminCategory(id),
    "Đã xoá danh mục."
  );
