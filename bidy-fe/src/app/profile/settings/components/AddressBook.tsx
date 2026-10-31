"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import ConfirmationDialog from "@/components/common/confirmation-dialog";
import { LoadingState, Skeleton, Spinner } from "@/components/common/loading";
import { cn } from "@/lib/utils";
import {
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
  type Address,
} from "@/services/user";
import { AddressFormSchema, type AddressForm } from "@/app/profile/settings/schema";

const inputClass =
  "mt-2 w-full border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-ring";

function AddressFields({
  address,
  onCancel,
  onSubmit,
  isSubmitting,
}: Readonly<{
  address?: Address;
  onCancel: () => void;
  onSubmit: (values: AddressForm) => void;
  isSubmitting: boolean;
}>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(AddressFormSchema),
    mode: "onBlur",
    defaultValues: {
      street: address?.street ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      zipCode: address?.zipCode ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border border-border bg-background p-5"
    >
      <h3 className="text-base font-semibold text-foreground">
        {address ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Địa chỉ (số nhà, đường)
          </label>
          <input
            {...register("street")}
            placeholder="12 Nguyễn Huệ"
            className={inputClass}
          />
          {errors.street && (
            <p className="mt-1 text-sm text-destructive">
              {errors.street.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">
            Tỉnh / Thành phố
          </label>
          <input
            {...register("city")}
            placeholder="TP. Hồ Chí Minh"
            className={inputClass}
          />
          {errors.city && (
            <p className="mt-1 text-sm text-destructive">
              {errors.city.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">
            Quận / Huyện
          </label>
          <input {...register("state")} placeholder="Quận 1" className={inputClass} />
          {errors.state && (
            <p className="mt-1 text-sm text-destructive">
              {errors.state.message}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">
            Mã bưu chính{" "}
            <span className="font-normal text-foreground-secondary">
              (không bắt buộc)
            </span>
          </label>
          <input {...register("zipCode")} placeholder="700000" className={inputClass} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
        >
          {isSubmitting && <Spinner size="sm" tone="onColor" />}
          {address ? "Lưu thay đổi" : "Thêm địa chỉ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}

/**
 * Sổ địa chỉ giao hàng.
 *
 * Backend giữ bất biến "có địa chỉ thì luôn có đúng một mặc định" (địa chỉ đầu
 * tiên tự thành mặc định, đặt mặc định mới tự gỡ cái cũ, xoá mặc định thì tự
 * đôn cái khác lên), nên màn này không tự suy luận gì về cờ `isDefault` — chỉ
 * hiển thị và gọi API rồi để danh sách tự nạp lại.
 */
export default function AddressBook() {
  const { addresses, defaultAddress, isLoading, isError, refetch } =
    useAddresses();
  const createMutation = useCreateAddress();
  const updateMutation = useUpdateAddress();
  const deleteMutation = useDeleteAddress();
  const setDefaultMutation = useSetDefaultAddress();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const closeForm = () => {
    setEditingId(null);
    setIsAdding(false);
  };

  const handleCreate = (values: AddressForm) =>
    createMutation.mutate(
      { ...values, zipCode: values.zipCode || null },
      { onSuccess: closeForm }
    );

  const handleUpdate = (id: string) => (values: AddressForm) =>
    updateMutation.mutate(
      { id, body: { ...values, zipCode: values.zipCode || null } },
      { onSuccess: closeForm }
    );

  return (
    <section className="flex w-full flex-col gap-5 border border-border bg-card p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Địa chỉ giao hàng</h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Địa chỉ mặc định được dùng khi bạn mua ngay hoặc thắng một phiên đấu
            giá.
          </p>
        </div>

        {!isAdding && !editingId && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex h-10 items-center gap-2 border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-4" aria-hidden />
            Thêm địa chỉ
          </button>
        )}
      </header>

      {!defaultAddress && addresses.length > 0 && (
        <p className="border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Chưa có địa chỉ mặc định. Hãy chọn một địa chỉ làm mặc định để dùng khi
          thanh toán.
        </p>
      )}

      {isAdding && (
        <AddressFields
          onCancel={closeForm}
          onSubmit={handleCreate}
          isSubmitting={createMutation.isPending}
        />
      )}

      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        isEmpty={addresses.length === 0 && !isAdding}
        loadingFallback={
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        }
        emptyFallback={
          <div className="border border-dashed border-border px-6 py-14 text-center">
            <MapPin
              className="mx-auto size-8 text-foreground-secondary"
              aria-hidden
            />
            <p className="mt-3 text-base font-medium text-foreground">
              Bạn chưa có địa chỉ giao hàng
            </p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Thêm một địa chỉ để có thể mua ngay và nhận hàng. Địa chỉ đầu tiên
              sẽ tự động là mặc định.
            </p>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-4 inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Plus className="size-4" aria-hidden />
              Thêm địa chỉ
            </button>
          </div>
        }
      >
        <ul className="flex flex-col gap-3">
          {addresses.map((address) =>
            editingId === address.id ? (
              <li key={address.id}>
                <AddressFields
                  address={address}
                  onCancel={closeForm}
                  onSubmit={handleUpdate(address.id)}
                  isSubmitting={updateMutation.isPending}
                />
              </li>
            ) : (
              <li
                key={address.id}
                className={cn(
                  "flex flex-col gap-3 border p-5 sm:flex-row sm:items-start sm:justify-between",
                  address.isDefault
                    ? "border-primary/50 bg-accent-subtle"
                    : "border-border bg-background"
                )}
              >
                <div className="min-w-0">
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                      <Star className="size-3.5 fill-primary" aria-hidden />
                      Mặc định
                    </span>
                  )}
                  <p className="mt-1 font-medium text-foreground">
                    {address.street}
                  </p>
                  <p className="text-sm text-foreground-secondary">
                    {[address.state, address.city, address.zipCode]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMutation.mutate(address.id)}
                      disabled={setDefaultMutation.isPending}
                      className="inline-flex h-9 items-center gap-1.5 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      <Star className="size-4" aria-hidden />
                      Đặt mặc định
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(address.id);
                    }}
                    aria-label="Sửa địa chỉ"
                    className="inline-flex size-9 items-center justify-center border border-border text-foreground transition-colors hover:bg-accent"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>

                  <ConfirmationDialog
                    title="Xoá địa chỉ này?"
                    description={`${address.street} — ${address.city}. Thao tác này không hoàn tác được.`}
                    confirmText="Xoá"
                    cancelText="Giữ lại"
                    onConfirm={() => deleteMutation.mutate(address.id)}
                    confirmButtonClassName="bg-destructive text-destructive-foreground hover:opacity-90 cursor-pointer"
                    trigger={
                      <button
                        type="button"
                        aria-label="Xoá địa chỉ"
                        className="inline-flex size-9 items-center justify-center border border-border text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    }
                  />
                </div>
              </li>
            )
          )}
        </ul>
      </LoadingState>
    </section>
  );
}
