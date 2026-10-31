"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, CheckCircle, LinkIcon } from "lucide-react";
import { useVerifyEmail } from "@/services/user";
import { APP_ROUTES } from "@/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AuthShell from "@/components/auth/AuthShell";
import AuthAlert from "@/components/auth/AuthAlert";

const EYEBROW = "Tạo tài khoản";
const STEP = { current: 2, total: 2 };

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  const { mutate: verifyEmail, isPending, isSuccess, error } = useVerifyEmail();

  if (!userId || !token) {
    return (
      <AuthShell
        eyebrow={EYEBROW}
        step={STEP}
        icon={LinkIcon}
        tone="danger"
        title="Liên kết không dùng được"
        description="Liên kết xác thực này thiếu thông tin cần thiết. Mở lại liên kết trong email chúng tôi đã gửi cho bạn."
      >
        <Button asChild size="lg" className="h-11 w-full">
          <Link href={APP_ROUTES.SIGN_IN}>Quay lại đăng nhập</Link>
        </Button>
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
        title="Email đã được xác thực"
        description="Tài khoản của bạn đã kích hoạt. Đăng nhập để bắt đầu tham gia đấu giá."
      >
        <Button asChild size="lg" className="h-11 w-full">
          <Link href={APP_ROUTES.SIGN_IN}>Đăng nhập ngay</Link>
        </Button>
      </AuthShell>
    );
  }

  const serverMessage = (error as (Error & {
    response?: { data?: { message?: string } };
  }) | null)?.response?.data?.message;

  return (
    <AuthShell
      eyebrow={EYEBROW}
      step={STEP}
      icon={MailCheck}
      title="Xác thực email"
      description="Nhấn nút bên dưới để hoàn tất xác thực và kích hoạt tài khoản."
      footer={
        <Link
          href={APP_ROUTES.SIGN_IN}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      }
    >
      <div className="space-y-5">
        {error && (
          <AuthAlert>
            {serverMessage || "Xác thực không thành công. Liên kết có thể đã hết hạn."}
          </AuthAlert>
        )}

        {/*
          Deliberately click-to-verify: the token is single-use and mail clients
          and link scanners routinely prefetch URLs, so verifying on mount would
          burn the token before the person ever sees this page.
        */}
        <Button
          type="button"
          size="lg"
          className="h-11 w-full"
          onClick={() => verifyEmail({ userId, token })}
          disabled={isPending}
        >
          {isPending ? "Đang xác thực…" : "Xác thực email"}
        </Button>
      </div>
    </AuthShell>
  );
}

const VerifyEmailLoading = () => (
  <AuthShell eyebrow={EYEBROW} step={STEP} icon={MailCheck} title="Xác thực email">
    <Skeleton className="h-11 w-full" />
  </AuthShell>
);

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
