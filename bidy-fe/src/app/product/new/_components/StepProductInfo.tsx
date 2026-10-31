"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/common/loading";
import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from "@/constants/app.enum";
import { useActiveCategories } from "@/services/category";
import { cn } from "@/lib/utils";

import { ProductInfoSchema, type ProductInfoForm } from "@/app/product/new/schema";

interface StepProductInfoProps {
  /**
   * Giá trị điền sẵn. Khi sửa (`?edit=<id>`) dữ liệu về SAU khi form đã mount,
   * nên phải đi qua `values` chứ không phải `defaultValues` — `defaultValues`
   * chỉ được react-hook-form đọc đúng một lần lúc mount, mọi thay đổi sau đó bị
   * bỏ qua và form đứng rỗng.
   */
  defaultValues?: Partial<ProductInfoForm>;
  /** Đã tạo draft rồi thì bước này là sửa, đổi nhãn nút cho đúng việc. */
  isSaved: boolean;
  isSubmitting: boolean;
  onSubmit: (values: ProductInfoForm) => void;
}

const CONDITION_OPTIONS = Object.values(PRODUCT_CONDITION);

export default function StepProductInfo({
  defaultValues,
  isSaved,
  isSubmitting,
  onSubmit,
}: Readonly<StepProductInfoProps>) {
  const { categories, isPending: isCategoriesPending } = useActiveCategories();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductInfoForm>({
    resolver: zodResolver(ProductInfoSchema),
    values: defaultValues as ProductInfoForm | undefined,
    // `useProductDetail` có `staleTime: 0` nên một lần refetch khi focus lại tab
    // sẽ đẩy `values` mới xuống; giữ lại field người dùng đang sửa dở.
    resetOptions: { keepDirtyValues: true },
  });

  const categoryId = watch("categoryId");
  const condition = watch("condition");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Thông tin sản phẩm</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Món hàng này là gì. Bước sau mới tới ảnh, và sản phẩm chỉ hiện ra công
          khai khi bạn bấm đăng bán ở bước cuối.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="product-name">
          Tên sản phẩm <span className="text-destructive">*</span>
        </Label>
        <Input
          id="product-name"
          placeholder="Ví dụ: MacBook Pro 14 M3 2023"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="product-category">
          Danh mục <span className="text-destructive">*</span>
        </Label>
        <Select
          value={categoryId ?? ""}
          onValueChange={(value) => {
            // Nằm trong <form>, Radix dựng thêm một <select> ẩn và lần đồng bộ
            // đầu tiên của nó bắn `onValueChange("")`. Ghi đè chuỗi rỗng đó sẽ
            // xoá đúng danh mục vừa nạp khi sửa sản phẩm. Không có SelectItem
            // nào mang value rỗng nên bỏ qua là không mất lựa chọn hợp lệ nào.
            if (!value) return;
            setValue("categoryId", value, { shouldValidate: true });
          }}
        >
          <SelectTrigger id="product-category" aria-invalid={Boolean(errors.categoryId)}>
            <SelectValue
              placeholder={isCategoriesPending ? "Đang tải danh mục…" : "Chọn danh mục"}
            />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="text-sm text-destructive">{errors.categoryId.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          Tình trạng <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {CONDITION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={condition === option}
              onClick={() =>
                setValue("condition", option, { shouldValidate: true })
              }
              className={cn(
                "h-10 border px-4 text-sm font-medium transition-colors",
                condition === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-accent"
              )}
            >
              {PRODUCT_CONDITION_LABELS[option]}
            </button>
          ))}
        </div>
        {errors.condition && (
          <p className="text-sm text-destructive">{errors.condition.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="product-description">Mô tả</Label>
        <textarea
          id="product-description"
          rows={6}
          placeholder="Cấu hình, phụ kiện đi kèm, vết xước nếu có…"
          className="w-full border border-border bg-transparent px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
        >
          {isSubmitting && <Spinner size="xs" tone="onColor" />}
          {isSaved ? "Lưu thay đổi" : "Lưu và tiếp tục"}
        </button>
        {!isSaved && (
          <p className="text-xs text-muted-foreground">
            Sản phẩm được lưu thành bản nháp, chưa ai nhìn thấy.
          </p>
        )}
      </div>
    </form>
  );
}
