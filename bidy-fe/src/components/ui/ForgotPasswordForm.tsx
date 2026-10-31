"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForgotPassword } from "@/services/user";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/constants/routes.constants";
import AuthShell from "@/components/auth/AuthShell";
import AuthField from "@/components/auth/AuthField";
import AuthAlert from "@/components/auth/AuthAlert";

interface ForgotPasswordFormProps {
  onBackToSignIn?: () => void;
}

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordForm({
  onBackToSignIn,
}: ForgotPasswordFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: forgotPassword } = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const email = watch("email");

  const onSubmit = (data: FormValues) => {
    setIsLoading(true);
    setError("");
    forgotPassword(
      { email: data.email },
      {
        onSuccess: () => setIsSubmitted(true),
        onError: () => setError("Không thể gửi email. Vui lòng thử lại."),
        onSettled: () => setIsLoading(false),
      }
    );
  };

  const handleResendEmail = () => {
    setIsSubmitted(false);
    setError("");
    reset();
  };

  const backToSignIn = onBackToSignIn ? (
    <button
      type="button"
      onClick={onBackToSignIn}
      className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Quay lại đăng nhập
    </button>
  ) : (
    <Link
      href={APP_ROUTES.SIGN_IN}
      className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Quay lại đăng nhập
    </Link>
  );

  if (isSubmitted) {
    return (
      <AuthShell
        eyebrow="Khôi phục mật khẩu"
        step={{ current: 1, total: 2 }}
        icon={MailCheck}
        tone="success"
        title="Email đã được gửi"
        description={
          <>
            Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến{" "}
            <strong className="font-medium text-foreground">{email}</strong>.
            Mở email đó để đặt mật khẩu mới.
          </>
        }
        footer={backToSignIn}
      >
        <div className="space-y-5">
          <ul className="space-y-1.5 rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <li>Kiểm tra cả thư mục Spam/Junk</li>
            <li>Email có thể mất vài phút để đến</li>
            <li>Liên kết có hiệu lực trong 24 giờ</li>
          </ul>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={handleResendEmail}
          >
            Gửi lại email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Khôi phục mật khẩu"
      step={{ current: 1, total: 2 }}
      icon={KeyRound}
      title="Quên mật khẩu"
      description="Nhập email của tài khoản. Chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <AuthField
          label="Địa chỉ email"
          type="email"
          {...register("email")}
          placeholder="Nhập địa chỉ email của bạn"
          autoComplete="email"
          disabled={isLoading}
          error={errors.email?.message}
          requiredMark
        />

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full"
          disabled={!isDirty || !isValid || isLoading}
        >
          {isLoading ? "Đang gửi…" : "Gửi email đặt lại mật khẩu"}
        </Button>
      </form>
    </AuthShell>
  );
}
