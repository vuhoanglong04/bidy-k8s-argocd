"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, CheckCircle, LinkIcon } from "lucide-react";
import { useResetPassword } from "@/services/user";
import { APP_ROUTES } from "@/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AuthShell from "@/components/auth/AuthShell";
import AuthAlert from "@/components/auth/AuthAlert";
import PasswordField from "@/components/auth/PasswordField";

const schema = z
  .object({
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type FormSchema = z.infer<typeof schema>;

const EYEBROW = "Khôi phục mật khẩu";
const STEP = { current: 2, total: 2 };

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");
  const [isSuccess, setIsSuccess] = useState(false);
  const { mutate: resetPassword, isPending, error } = useResetPassword();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isValid },
  } = useForm<FormSchema>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const onSubmit = (data: FormSchema) => {
    if (!userId || !token) return;
    resetPassword(
      { userId, token, newPassword: data.password },
      { onSuccess: () => setIsSuccess(true) }
    );
  };

  if (!userId || !token) {
    return (
      <AuthShell
        eyebrow={EYEBROW}
        step={STEP}
        icon={LinkIcon}
        tone="danger"
        title="Liên kết không dùng được"
        description="Liên kết này thiếu thông tin cần thiết. Mở lại liên kết trong email đặt lại mật khẩu, hoặc yêu cầu một email mới."
      >
        <div className="space-y-3">
          <Button asChild size="lg" className="h-11 w-full">
            <Link href={APP_ROUTES.FORGOT_PASS}>Gửi lại email đặt lại mật khẩu</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href={APP_ROUTES.SIGN_IN}>Quay lại đăng nhập</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthShell
        eyebrow={EYEBROW}
        step={STEP}
        icon={CheckCircle}
        tone="success"
        title="Mật khẩu đã được cập nhật"
        description="Từ giờ hãy dùng mật khẩu mới để đăng nhập vào Bidy."
      >
        <Button asChild size="lg" className="h-11 w-full">
          <Link href={APP_ROUTES.SIGN_IN}>Đăng nhập ngay</Link>
        </Button>
      </AuthShell>
    );
  }

  const serverMessage = (error as Error & {
    response?: { data?: { message?: string } };
  })?.response?.data?.message;

  return (
    <AuthShell
      eyebrow={EYEBROW}
      step={STEP}
      icon={Lock}
      title="Đặt mật khẩu mới"
      description="Chọn một mật khẩu mới cho tài khoản của bạn."
      footer={
        <Link
          href={APP_ROUTES.SIGN_IN}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <PasswordField
          label="Mật khẩu mới"
          {...register("password")}
          value={password}
          error={errors.password?.message}
          placeholder="Nhập mật khẩu mới"
          autoComplete="new-password"
          disabled={isPending}
          showStrength
          requiredMark
        />

        <PasswordField
          label="Xác nhận mật khẩu"
          {...register("confirmPassword")}
          value={confirmPassword}
          matchAgainst={password}
          error={errors.confirmPassword?.message}
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          disabled={isPending}
          requiredMark
        />

        {error && (
          <AuthAlert>
            {serverMessage ||
              "Không cập nhật được mật khẩu. Liên kết có thể đã hết hạn."}
          </AuthAlert>
        )}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full"
          disabled={!isDirty || !isValid || isPending}
        >
          {isPending ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
        </Button>
      </form>
    </AuthShell>
  );
}

const ResetPasswordLoading = () => (
  <AuthShell eyebrow={EYEBROW} step={STEP} icon={Lock} title="Đặt mật khẩu mới">
    <div className="space-y-5">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  </AuthShell>
);

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
