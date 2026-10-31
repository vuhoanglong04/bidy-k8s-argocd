"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MoneyInput from "@/components/ui/MoneyInput";
import {
  useCreateWithdrawal,
  getWithdrawalErrorMessage,
} from "@/services/wallet";
import { Spinner } from "@/components/common/loading";
import { formatCurrency, getValidNumber } from "@/utils";
import { toast } from "sonner";
import { AlertCircle, Landmark } from "lucide-react";

export interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number | string;
  onSuccess?: () => void;
}

const withdrawSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Vui lòng nhập số tiền hợp lệ" })
    .positive("Số tiền rút phải lớn hơn 0"),
  bankCode: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã ngân hàng (ví dụ: MB, VCB, TCB)"),
  bankAccountNo: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số tài khoản ngân hàng"),
  bankAccountName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên chủ tài khoản"),
});

type WithdrawFormData = z.infer<typeof withdrawSchema>;

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  onSuccess,
}: WithdrawDialogProps) {
  const numBalance = getValidNumber(balance);
  const [formattedAmount, setFormattedAmount] = useState<string>("");

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      amount: 0,
      bankCode: "",
      bankAccountNo: "",
      bankAccountName: "",
    },
  });

  const { mutate: createWithdrawal, isPending } = useCreateWithdrawal();

  useEffect(() => {
    if (open) {
      reset({
        amount: 0,
        bankCode: "",
        bankAccountNo: "",
        bankAccountName: "",
      });
      setFormattedAmount("");
    }
  }, [open, reset]);

  const handleMaxAmount = () => {
    if (numBalance <= 0) return;
    setValue("amount", numBalance, { shouldValidate: true });
    setFormattedAmount(
      numBalance.toLocaleString("vi-VN").replace(/,/g, ".")
    );
  };

  const onSubmit = (data: WithdrawFormData) => {
    if (data.amount > numBalance) {
      setError("amount", {
        type: "manual",
        message: `Số tiền rút vượt quá số dư khả dụng (${formatCurrency(numBalance)})`,
      });
      return;
    }

    createWithdrawal(
      {
        amount: data.amount,
        bankCode: data.bankCode.trim().toUpperCase(),
        bankAccountNo: data.bankAccountNo.trim(),
        bankAccountName: data.bankAccountName.trim().toUpperCase(),
      },
      {
        onSuccess: () => {
          toast.success("Tạo yêu cầu rút tiền thành công. Số tiền đã được tạm giữ.");
          onSuccess?.();
          onOpenChange(false);
        },
        onError: (error) => {
          const msg = getWithdrawalErrorMessage(error);
          toast.error(msg);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-border bg-card p-6 rounded-none">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-tight text-foreground">
            <Landmark className="size-5 text-primary" />
            Yêu cầu rút tiền
          </DialogTitle>
          <DialogDescription className="text-xs text-foreground-secondary">
            Tiền sẽ được chuyển về tài khoản ngân hàng của bạn sau khi quản trị viên phê duyệt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Balance overview */}
          <div className="flex items-center justify-between border border-border bg-muted/40 p-3 text-sm">
            <span className="text-foreground-secondary">Số dư khả dụng:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">
                {formatCurrency(numBalance)}
              </span>
              {numBalance > 0 && (
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                >
                  Rút tất cả
                </button>
              )}
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs font-medium text-foreground">
              Số tiền muốn rút (VNĐ) <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  id="amount"
                  value={formattedAmount}
                  disabled={isPending}
                  error={!!errors.amount}
                  onChange={(formatted, numeric) => {
                    setFormattedAmount(formatted);
                    field.onChange(numeric);
                  }}
                  placeholder="Nhập số tiền cần rút"
                />
              )}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* Bank Code */}
          <div className="space-y-1.5">
            <Label htmlFor="bankCode" className="text-xs font-medium text-foreground">
              Mã ngân hàng (Bank Code) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bankCode"
              placeholder="VD: MB, VCB, TCB, BIDV, VPB, TPB..."
              disabled={isPending}
              {...register("bankCode")}
            />
            {errors.bankCode && (
              <p className="text-xs text-destructive">{errors.bankCode.message}</p>
            )}
          </div>

          {/* Bank Account No */}
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountNo" className="text-xs font-medium text-foreground">
              Số tài khoản ngân hàng <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bankAccountNo"
              placeholder="Nhập số tài khoản thụ hưởng"
              disabled={isPending}
              {...register("bankAccountNo")}
            />
            {errors.bankAccountNo && (
              <p className="text-xs text-destructive">{errors.bankAccountNo.message}</p>
            )}
          </div>

          {/* Bank Account Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountName" className="text-xs font-medium text-foreground">
              Tên chủ tài khoản <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bankAccountName"
              placeholder="VD: NGUYEN VAN A (in hoa không dấu)"
              disabled={isPending}
              {...register("bankAccountName")}
            />
            {errors.bankAccountName && (
              <p className="text-xs text-destructive">
                {errors.bankAccountName.message}
              </p>
            )}
          </div>

          {/* Notice info box */}
          <div className="flex items-start gap-2 border border-border bg-accent/40 p-3 text-xs text-foreground-secondary">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-info" />
            <div className="space-y-1">
              <p>
                Số tiền rút sẽ được tạm giữ khỏi số dư khả dụng ngay khi bạn gửi yêu cầu.
              </p>
              <p>
                Thời hạn xử lý (SLA): tối đa 10 ngày làm việc. Mỗi tài khoản chỉ có thể gửi 1 yêu cầu rút tiền tại một thời điểm.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={isPending || numBalance <= 0}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {isPending ? (
                <>
                  <Spinner size="xs" tone="onColor" className="mr-2" />
                  Đang xử lý...
                </>
              ) : (
                "Xác nhận rút tiền"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
