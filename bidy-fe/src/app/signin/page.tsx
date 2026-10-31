"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignin } from "@/services/user";
import { APP_ROUTES } from "@/constants/routes.constants";
import { User } from "@/types/user";
import { useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/authSlice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AuthShell from "@/components/auth/AuthShell";
import AuthField from "@/components/auth/AuthField";
import AuthAlert from "@/components/auth/AuthAlert";
import PasswordField from "@/components/auth/PasswordField";

function SignInContent() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [validationError, setValidationError] = useState("");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const dispatch = useDispatch();
  const router = useRouter();

  const handleLoginSuccess = async (profile: User | null) => {
    try {
      dispatch(setAuth({ user: profile ?? null }));

      // Force page refresh in production to ensure middleware sees the cookie
      // This prevents the redirect issue after login
      // Admin luôn về `/admin`, kể cả khi có `?redirect=` trỏ vào route của
      // user — middleware sẽ chặn route đó, đi thẳng cho đỡ một lần nhảy.
      const targetUrl =
        profile?.role === "admin"
          ? APP_ROUTES.ADMIN
          : redirectTo || APP_ROUTES.PROFILE;

      if (process.env.NODE_ENV === 'production') {
        window.location.href = targetUrl;
      } else {
        // Use router.push for development
        router.push(targetUrl);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback navigation
      if (process.env.NODE_ENV === 'production') {
        window.location.href = APP_ROUTES.HOME;
      } else {
        router.push(APP_ROUTES.HOME);
      }
    }
  };

  const { mutate: signin, isPending, error: signInError } = useSignin(handleLoginSuccess);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (validationError) setValidationError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // The backend accepts either a username or an email in `identifier`,
    // so only length is checked here.
    if (form.identifier.trim().length < 3) {
      setValidationError("Tên đăng nhập hoặc email phải có ít nhất 3 ký tự.");
      return;
    }

    if (form.password.length < 6) {
      setValidationError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    signin({ identifier: form.identifier.trim(), password: form.password });
  };

  const serverMessage = (signInError as Error & {
    response?: { data?: { message?: string } };
  })?.response?.data?.message;

  return (
    <AuthShell
      eyebrow="Tài khoản Bidy"
      title="Đăng nhập"
      description="Tiếp tục theo dõi và ra giá ở những phiên bạn đang quan tâm."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link
            href={APP_ROUTES.SIGN_UP}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthField
          label="Tên đăng nhập hoặc email"
          name="identifier"
          value={form.identifier}
          onChange={handleChange}
          placeholder="ban@email.com"
          autoComplete="username"
          disabled={isPending}
          requiredMark
        />

        <div className="space-y-2">
          <PasswordField
            label="Mật khẩu"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            disabled={isPending}
            requiredMark
          />
          <div className="text-right">
            <Link
              href={APP_ROUTES.FORGOT_PASS}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
        </div>

        {(validationError || signInError) && (
          <AuthAlert>
            {validationError ||
              serverMessage ||
              signInError?.message ||
              "Đăng nhập không thành công. Kiểm tra lại tên đăng nhập và mật khẩu."}
          </AuthAlert>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full h-11"
          disabled={isPending || !form.identifier || !form.password}
        >
          {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
    </AuthShell>
  );
}

const SignInLoading = () => (
  <AuthShell eyebrow="Tài khoản Bidy" title="Đăng nhập">
    <div className="space-y-5">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  </AuthShell>
);

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </Suspense>
  );
}
