"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Receipt,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  useCreateAdminAdjustment,
  type AdjustmentResultData,
} from "@/services/admin-wallet";
import { formatCurrency, getValidNumber } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MoneyInput from "@/components/ui/MoneyInput";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/common/loading";
import AdminPanel from "./AdminPanel";

const adjustmentSchema = z.object({
  walletId: z.string().min(1, "Vui lòng nhập mã ví cần điều chỉnh"),
  type: z.enum(["credit", "debit"]),
  amount: z.number().min(1000, "Số tiền điều chỉnh tối thiểu là 1.000 đ"),
  reason: z
    .string()
    .min(5, "Lý do điều chỉnh tối thiểu 5 ký tự"),
  bank_reference: z.string().optional(),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

export default function AdminFinanceAdjustment() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] =
    useState<AdjustmentFormValues | null>(null);
  const [result, setResult] = useState<AdjustmentResultData | null>(null);

  const { mutateAsync: createAdjustment, isPending } =
    useCreateAdminAdjustment();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      walletId: "",
      type: "credit",
      amount: 0,
      reason: "",
      bank_reference: "",
    },
  });

  const selectedType = watch("type");

  const onSubmit = (values: AdjustmentFormValues) => {
    setPendingValues(values);
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingValues) return;

    const signedAmount =
      pendingValues.type === "credit"
        ? Math.abs(pendingValues.amount).toFixed(2)
        : (-Math.abs(pendingValues.amount)).toFixed(2);

    try {
      const res = await createAdjustment({
        walletId: pendingValues.walletId.trim(),
        amount: signedAmount,
        reason: pendingValues.reason.trim(),
        bank_reference: pendingValues.bank_reference?.trim() || undefined,
      });

      setResult(res);
      toast.success("Đã ghi nhận giao dịch điều chỉnh số dư thành công!");
      setIsConfirmOpen(false);
      reset();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể điều chỉnh số dư ví. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Form điều chỉnh số dư */}
      <AdminPanel
        title="Điều chỉnh số dư ví"
        description="Tạo giao dịch cộng hoặc trừ tiền vào ví người dùng để đối soát"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          {/* Cảnh báo an toàn */}
          <div className="flex items-start gap-2.5 border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
            <p>
              Mọi thay đổi số dư sẽ được lưu vết vĩnh viễn kèm thông tin người thực
              hiện. Vui lòng đối soát kỹ với sao kê ngân hàng trước khi gửi lệnh.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Wallet ID */}
            <div className="space-y-1.5">
              <Label htmlFor="adj-walletId" className="text-xs font-semibold">
                Mã ví <span className="text-destructive">*</span>
              </Label>
              <Input
                id="adj-walletId"
                placeholder="VD: 42"
                className="h-9 rounded-none font-mono text-xs"
                {...register("walletId")}
              />
              {errors.walletId && (
                <p className="text-[11px] text-destructive">
                  {errors.walletId.message}
                </p>
              )}
            </div>

            {/* Loại điều chỉnh: Cộng hoặc Trừ */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Loại giao dịch <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={selectedType === "credit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setValue("type", "credit")}
                  className={`h-9 cursor-pointer rounded-none text-xs font-semibold ${
                    selectedType === "credit"
                      ? "bg-success text-success-foreground hover:bg-success/90"
                      : ""
                  }`}
                >
                  <PlusCircle size={14} className="mr-1.5" /> Cộng tiền (+)
                </Button>
                <Button
                  type="button"
                  variant={selectedType === "debit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setValue("type", "debit")}
                  className={`h-9 cursor-pointer rounded-none text-xs font-semibold ${
                    selectedType === "debit"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : ""
                  }`}
                >
                  <MinusCircle size={14} className="mr-1.5" /> Trừ tiền (-)
                </Button>
              </div>
            </div>
          </div>

          {/* Số tiền điều chỉnh */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount" className="text-xs font-semibold">
              Số tiền điều chỉnh (VNĐ){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  id="adj-amount"
                  value={
                    field.value
                      ? field.value.toLocaleString("vi-VN").replace(/,/g, ".")
                      : ""
                  }
                  onChange={(_formatted, numeric) => field.onChange(numeric)}
                  placeholder="Nhập số tiền"
                  suffix="đ"
                  className={`h-10 rounded-none text-sm font-bold ${
                    selectedType === "credit"
                      ? "text-success"
                      : "text-destructive"
                  }`}
                />
              )}
            />
            {errors.amount && (
              <p className="text-[11px] text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Lý do điều chỉnh */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason" className="text-xs font-semibold">
              Lý do điều chỉnh <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="adj-reason"
              placeholder="VD: Ngân hàng xác nhận nạp tiền thành công nhưng hệ thống chưa ghi nhận..."
              rows={3}
              className="rounded-none text-xs"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-[11px] text-destructive">
                {errors.reason.message}
              </p>
            )}
          </div>

          {/* Mã giao dịch ngân hàng đối soát */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-bank-ref" className="text-xs font-semibold">
              Mã giao dịch ngân hàng
            </Label>
            <Input
              id="adj-bank-ref"
              placeholder="VD: FT24010112345 hoặc MB987654321"
              className="h-9 rounded-none font-mono text-xs"
              {...register("bank_reference")}
            />
            <p className="text-[11px] text-muted-foreground">
              Nhập mã giao dịch từ sao kê ngân hàng để phục vụ đối soát.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-none text-xs font-semibold"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang xử lý...
                </span>
              ) : (
                "Xác nhận điều chỉnh"
              )}
            </Button>
          </div>
        </form>
      </AdminPanel>

      {/* Panel kết quả sau khi điều chỉnh hoặc hướng dẫn */}
      <div className="flex flex-col gap-4">
        {result ? (
          <AdminPanel
            title="Kết quả điều chỉnh"
            description="Giao dịch điều chỉnh số dư đã được ghi nhận thành công"
          >
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-success font-semibold">
                <CheckCircle2 size={16} /> Đã cập nhật số dư ví #{result.walletId}
              </div>

              <div className="divide-y divide-border border border-border bg-card">
                <div className="p-2.5 flex justify-between">
                  <span className="text-muted-foreground">Mã giao dịch:</span>
                  <span className="font-mono font-bold text-foreground">
                    #{result.id}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-muted-foreground">Biến động số dư:</span>
                  <span
                    className={`font-mono font-bold ${
                      getValidNumber(result.amount) >= 0
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {getValidNumber(result.amount) >= 0 ? "+" : ""}
                    {formatCurrency(getValidNumber(result.amount))}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-muted-foreground">Số dư sau điều chỉnh:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(getValidNumber(result.balanceAfter))}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between">
                  <span className="text-muted-foreground">Mã tham chiếu:</span>
                  <span className="font-mono text-[11px] truncate max-w-36">
                    {result.referenceId}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setResult(null)}
                className="w-full rounded-none text-xs"
              >
                Tạo điều chỉnh khác
              </Button>
            </div>
          </AdminPanel>
        ) : (
          <AdminPanel
            title="Nguyên tắc điều chỉnh số dư"
            description="Quy định và lưu ý khi điều chỉnh số dư ví"
          >
            <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-start gap-2">
                <Receipt size={14} className="shrink-0 mt-0.5 text-primary" />
                <p>
                  <strong>Cộng tiền (+):</strong> Dùng khi người dùng nạp tiền
                  thành công qua ngân hàng nhưng hệ thống chưa ghi nhận hoặc xử lý
                  bồi thường.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <FileText size={14} className="shrink-0 mt-0.5 text-warning" />
                <p>
                  <strong>Trừ tiền (-):</strong> Dùng khi cần thu hồi số dư nạp thừa
                  hoặc khắc phục sai sót. Lệnh trừ sẽ không thành công nếu số dư
                  ví hiện tại không đủ.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-destructive" />
                <p>
                  Tuyệt đối không thực hiện điều chỉnh số dư khi chưa có sao kê ngân
                  hàng đối ứng hợp lệ.
                </p>
              </div>
            </div>
          </AdminPanel>
        )}
      </div>

      {/* ALERT DIALOG XÁC NHẬN TRƯỚC KHI SUBMIT */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-none sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Xác nhận điều chỉnh số dư ví #{pendingValues?.walletId}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <div className="p-3 bg-muted/40 border border-border space-y-1.5 text-foreground">
                <div className="flex justify-between">
                  <span>Hành động:</span>
                  <span
                    className={`font-bold ${
                      pendingValues?.type === "credit"
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {pendingValues?.type === "credit"
                      ? "CỘNG TIỀN (+)"
                      : "TRỪ TIỀN (-)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Số tiền:</span>
                  <span className="font-bold font-mono">
                    {formatCurrency(getValidNumber(pendingValues?.amount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Lý do:</span>
                  <span className="text-right truncate max-w-44 font-medium">
                    {pendingValues?.reason}
                  </span>
                </div>
                {pendingValues?.bank_reference && (
                  <div className="flex justify-between">
                    <span>Mã giao dịch ngân hàng:</span>
                    <span className="font-mono">
                      {pendingValues?.bank_reference}
                    </span>
                  </div>
                )}
              </div>
              <p>Bạn có chắc chắn muốn thực hiện điều chỉnh số dư này?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isPending}
              className="rounded-none text-xs"
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              disabled={isPending}
              className="rounded-none text-xs font-semibold"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang xử lý...
                </span>
              ) : (
                "Xác nhận điều chỉnh"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
