"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronRight, FolderTree, ImageOff, Upload, X } from "lucide-react";

import WizardStepper, { type WizardStep } from "@/components/common/WizardStepper";
import { Spinner } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUploadFile } from "@/services/file/file.query";
import {
  MAX_CATEGORY_DEPTH,
  collectSubtreeIds,
  useCreateAdminCategory,
  useUpdateAdminCategory,
} from "@/services/admin";
import { AdminCategoryNode } from "@/types";
import { cn } from "@/lib/utils";

const STEPS: readonly WizardStep[] = [
  { id: 1, title: "Vị trí trong cây", hint: "Chọn danh mục cha hoặc để ở cấp gốc" },
  { id: 2, title: "Thông tin", hint: "Đặt tên hiển thị cho danh mục" },
  { id: 3, title: "Hình ảnh", hint: "Ảnh đại diện, có thể bỏ qua" },
  { id: 4, title: "Xem lại", hint: "Kiểm tra rồi lưu" },
];

/** Ảnh danh mục: giới hạn theo cấu hình upload chung của backend. */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface CategoryWizardTarget {
  /** `edit` sửa chính node; `create` thêm mới với `node` là cha gợi ý sẵn. */
  mode: "create" | "edit";
  node: AdminCategoryNode | null;
}

interface CategoryWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CategoryWizardTarget;
  /** Cây hiện tại, dùng để chọn cha và kiểm tra ràng buộc. */
  tree: AdminCategoryNode[];
  flatNodes: AdminCategoryNode[];
}

export default function CategoryWizardDialog({
  open,
  onOpenChange,
  target,
  tree,
  flatNodes,
}: CategoryWizardDialogProps) {
  const isEdit = target.mode === "edit";
  const editing = isEdit ? target.node : null;

  const [step, setStep] = useState(1);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: uploadImage, isPending: isUploading } = useUploadFile();
  const { mutate: createCategory, isPending: isCreating } = useCreateAdminCategory();
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateAdminCategory();
  const isSaving = isCreating || isUpdating;

  // Mở dialog là nạp lại state từ target — cùng một instance dialog phục vụ cả
  // thêm mới lẫn sửa, nên không được giữ giá trị của lượt trước.
  useEffect(() => {
    if (!open) return;

    setStep(1);
    setImageError(null);

    if (isEdit && target.node) {
      setParentId(target.node.parentId);
      setName(target.node.name);
      setImageFileId(target.node.imageFileId);
      setImagePreview(target.node.imageUrl);
      return;
    }

    setParentId(target.node?.id ?? null);
    setName("");
    setImageFileId(null);
    setImagePreview(null);
  }, [open, isEdit, target.node]);

  /**
   * Node không được chọn làm cha khi:
   * - nó nằm trong chính subtree đang sửa (tạo vòng lặp), hoặc
   * - chọn nó sẽ đẩy danh mục xuống quá `MAX_CATEGORY_DEPTH`.
   */
  const blockedParentIds = useMemo(
    () => new Set(editing ? collectSubtreeIds(editing) : []),
    [editing]
  );

  /** Chiều cao subtree đang sửa — cha mới phải còn đủ chỗ chứa nó. */
  const subtreeHeight = useMemo(() => {
    const measure = (node: AdminCategoryNode): number =>
      node.children.length === 0
        ? 1
        : 1 + Math.max(...node.children.map(measure));
    return editing ? measure(editing) : 1;
  }, [editing]);

  const isParentSelectable = (node: AdminCategoryNode) =>
    !blockedParentIds.has(node.id) &&
    node.depth + subtreeHeight <= MAX_CATEGORY_DEPTH;

  const selectedParent = parentId
    ? flatNodes.find((node) => node.id === parentId) ?? null
    : null;

  /** Đường dẫn từ gốc tới danh mục, hiển thị ở bước xem lại. */
  const parentPath = useMemo(() => {
    const path: AdminCategoryNode[] = [];
    let cursor = selectedParent;

    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentId
        ? flatNodes.find((node) => node.id === cursor?.parentId) ?? null
        : null;
    }

    return path;
  }, [selectedParent, flatNodes]);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0 && trimmedName.length <= 100;

  /** Trùng tên trong cùng cấp cha — backend cũng chặn, đây là phản hồi sớm. */
  const hasSiblingConflict = useMemo(() => {
    const siblings = parentId
      ? flatNodes.find((node) => node.id === parentId)?.children ?? []
      : tree;

    return siblings.some(
      (sibling) =>
        sibling.id !== editing?.id &&
        sibling.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
  }, [parentId, flatNodes, tree, trimmedName, editing?.id]);

  const canLeaveStep2 = isNameValid && !hasSiblingConflict;

  const isStepReachable = (candidate: number) => {
    if (candidate <= 1) return true;
    if (candidate === 2) return true;
    return canLeaveStep2;
  };

  const handlePickImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Chỉ nhận tệp hình ảnh.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Ảnh vượt quá 5MB.");
      return;
    }

    setImageError(null);
    uploadImage(
      { file, purpose: "category" },
      {
        onSuccess: (uploaded) => {
          setImageFileId(uploaded.id);
          setImagePreview(uploaded.url);
        },
        onError: () => setImageError("Tải ảnh thất bại, thử lại giúp tôi."),
      }
    );
  };

  const handleSubmit = () => {
    const payload = {
      name: trimmedName,
      parentId,
      imageFileId,
    };

    if (isEdit && editing) {
      updateCategory(
        { id: editing.id, payload },
        { onSuccess: () => onOpenChange(false) }
      );
      return;
    }

    createCategory(payload, { onSuccess: () => onOpenChange(false) });
  };

  /** Cây chọn cha, đệ quy theo `children`. */
  const renderParentOption = (node: AdminCategoryNode) => {
    const selectable = isParentSelectable(node);
    const isSelected = parentId === node.id;

    return (
      <li key={node.id}>
        <button
          type="button"
          disabled={!selectable}
          onClick={() => setParentId(node.id)}
          style={{ paddingLeft: `${(node.depth - 1) * 20 + 12}px` }}
          className={cn(
            "flex w-full items-center gap-2 py-2 pr-3 text-left text-sm transition-colors",
            selectable
              ? "cursor-pointer hover:bg-accent"
              : "cursor-not-allowed text-muted-foreground opacity-60",
            isSelected && "bg-accent font-semibold text-accent-foreground"
          )}
        >
          <FolderTree size={14} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
          {!node.isActive && (
            <span className="text-xs text-muted-foreground">(đang ẩn)</span>
          )}
          {!selectable && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {blockedParentIds.has(node.id) ? "không hợp lệ" : "quá 3 cấp"}
            </span>
          )}
          {isSelected && <Check size={14} className="ml-auto shrink-0 text-primary" />}
        </button>
        {node.children.length > 0 && (
          <ul>{node.children.map(renderParentOption)}</ul>
        )}
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Sửa danh mục: ${editing?.name}` : "Thêm danh mục"}
          </DialogTitle>
          <DialogDescription>
            Cây danh mục tối đa {MAX_CATEGORY_DEPTH} cấp. Tên phải khác nhau trong
            cùng một cấp cha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <WizardStepper
            steps={STEPS}
            currentStep={step}
            completedSteps={STEPS.filter((s) => s.id < step).map((s) => s.id)}
            isStepReachable={isStepReachable}
            onStepChange={setStep}
          />

          <div className="min-w-0">
            {/* ---------- B1: vị trí ---------- */}
            {step === 1 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Chọn danh mục cha. Để ở cấp gốc nếu đây là nhóm lớn nhất.
                </p>

                <div className="max-h-72 overflow-y-auto border border-border">
                  <button
                    type="button"
                    onClick={() => setParentId(null)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      parentId === null && "bg-accent font-semibold text-accent-foreground"
                    )}
                  >
                    <FolderTree size={14} className="shrink-0 text-muted-foreground" />
                    Cấp gốc (không có cha)
                    {parentId === null && (
                      <Check size={14} className="ml-auto shrink-0 text-primary" />
                    )}
                  </button>
                  <ul className="border-t border-border">
                    {tree.map(renderParentOption)}
                  </ul>
                </div>

                {editing && (
                  <p className="text-xs text-muted-foreground">
                    Không thể chọn chính danh mục này hoặc các danh mục con của nó
                    làm cha.
                  </p>
                )}
              </div>
            )}

            {/* ---------- B2: thông tin ---------- */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="category-name">Tên danh mục</Label>
                  <Input
                    id="category-name"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Đồng hồ cơ"
                    className="rounded-none"
                  />
                  {!isNameValid && trimmedName.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Tên không được để trống, tối đa 100 ký tự.
                    </p>
                  )}
                  {hasSiblingConflict && (
                    <p className="text-xs text-destructive">
                      Đã có danh mục cùng tên trong cấp cha này.
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Slug được backend sinh tự động từ tên, không cần nhập.
                </p>
              </div>
            )}

            {/* ---------- B3: ảnh ---------- */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt={trimmedName || "Ảnh danh mục"}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageOff size={22} className="text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-none"
                    >
                      {isUploading ? <Spinner size="xs" tone="current" /> : <Upload size={16} />}
                      {imagePreview ? "Đổi ảnh" : "Tải ảnh lên"}
                    </Button>

                    {imagePreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setImageFileId(null);
                          setImagePreview(null);
                        }}
                        className="cursor-pointer justify-start rounded-none text-destructive hover:text-destructive"
                      >
                        <X size={16} /> Gỡ ảnh
                      </Button>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Ảnh tối đa 5MB. Bước này có thể bỏ qua.
                    </p>
                    {imageError && (
                      <p className="text-xs text-destructive">{imageError}</p>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePickImage}
                />
              </div>
            )}

            {/* ---------- B4: xem lại ---------- */}
            {step === 4 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 border border-border p-4">
                  <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden bg-muted">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt={trimmedName}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageOff size={18} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">
                      {trimmedName || "(chưa đặt tên)"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Cấp {parentPath.length + 1}/{MAX_CATEGORY_DEPTH}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Vị trí
                  </p>
                  <nav className="mt-1.5 flex flex-wrap items-center gap-1 text-sm text-foreground">
                    <span className="text-muted-foreground">Gốc</span>
                    {parentPath.map((node) => (
                      <React.Fragment key={node.id}>
                        <ChevronRight size={12} className="text-muted-foreground" />
                        <span className="text-muted-foreground">{node.name}</span>
                      </React.Fragment>
                    ))}
                    <ChevronRight size={12} className="text-muted-foreground" />
                    <span className="font-semibold">{trimmedName || "(chưa đặt tên)"}</span>
                  </nav>
                </div>
              </div>
            )}

            {/* ---------- Điều hướng ---------- */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer rounded-none"
                onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
              >
                {step === 1 ? "Huỷ" : "Quay lại"}
              </Button>

              {step < STEPS.length ? (
                <Button
                  type="button"
                  className="cursor-pointer rounded-none"
                  disabled={step === 2 && !canLeaveStep2}
                  onClick={() => setStep(step + 1)}
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  type="button"
                  className="cursor-pointer rounded-none"
                  disabled={isSaving || !canLeaveStep2}
                  onClick={handleSubmit}
                >
                  {isSaving && <Spinner size="xs" tone="onColor" />}
                  {isEdit ? "Lưu thay đổi" : "Tạo danh mục"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
