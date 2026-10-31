"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { useRegister } from "@/services/user";
import { BodyRegisterRequest } from "@/types";
import { APP_ROUTES } from "@/constants/routes.constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AuthShell from "@/components/auth/AuthShell";
import AuthField from "@/components/auth/AuthField";
import AuthAlert from "@/components/auth/AuthAlert";
import PasswordField from "@/components/auth/PasswordField";

const registerSchema = z
  .object({
    userName: z.string().min(1, "Tên đăng nhập là bắt buộc."),
    fullName: z.string().min(1, "Họ và tên là bắt buộc."),
    email: z.string().email("Email không hợp lệ."),
    phone: z.string().min(10, "Số điện thoại phải có ít nhất 10 chữ số."),
    identity: z.string().min(9, "CMND/CCCD là bắt buộc."),
    password: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Mật khẩu phải có chữ hoa, chữ thường và số."
      ),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
    news: z.boolean().optional(),
    agree: z.boolean().refine((val) => val === true, {
      message: "Bạn cần đồng ý với điều khoản để tạo tài khoản.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function SignUpPage() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      userName: "",
      fullName: "",
      email: "",
      phone: "",
      identity: "",
      password: "",
      confirmPassword: "",
      news: false,
      agree: false,
    },
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const {
    mutate: registerUser,
    error: registerError,
    isPending: isRegistering,
  } = useRegister();

  const onSubmit = (data: RegisterFormValues) => {
    const payload: BodyRegisterRequest = {
      userName: data.userName,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      identity: data.identity,
      password: data.password,
    };
    // Keep the entered data on failure so nothing has to be retyped.
    registerUser(payload, { onSuccess: () => reset() });
  };

  const busy = isSubmitting || isRegistering;
  const serverMessage = (registerError as Error & {
    response?: { data?: { message?: string } };
  })?.response?.data?.message;

  return (
    <AuthShell
      size="lg"
      eyebrow="Tạo tài khoản"
      step={{ current: 1, total: 2 }}
      title="Đăng ký tài khoản Bidy"
      description="Sau bước này, chúng tôi gửi một email để bạn xác thực và kích hoạt tài khoản."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link
            href={APP_ROUTES.SIGN_IN}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            label="Tên đăng nhập"
            {...register("userName")}
            error={errors.userName?.message}
            autoComplete="username"
            disabled={busy}
            requiredMark
          />
          <AuthField
            label="Họ và tên"
            {...register("fullName")}
            error={errors.fullName?.message}
            autoComplete="name"
            disabled={busy}
            requiredMark
          />
          <AuthField
            label="Email"
            type="email"
            {...register("email")}
            error={errors.email?.message}
            placeholder="ban@email.com"
            autoComplete="email"
            disabled={busy}
            requiredMark
          />
          <AuthField
            label="Số điện thoại"
            type="tel"
            {...register("phone")}
            error={errors.phone?.message}
            autoComplete="tel"
            disabled={busy}
            requiredMark
          />
          <div className="sm:col-span-2">
            <AuthField
              label="CMND/CCCD"
              {...register("identity")}
              error={errors.identity?.message}
              hint="Dùng để xác minh danh tính người tham gia đấu giá."
              disabled={busy}
              requiredMark
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            label="Mật khẩu"
            {...register("password")}
            value={password}
            error={errors.password?.message}
            placeholder="Tạo mật khẩu"
            autoComplete="new-password"
            disabled={busy}
            showStrength
            requiredMark
          />
          <PasswordField
            label="Xác nhận mật khẩu"
            {...register("confirmPassword")}
            value={confirmPassword}
            matchAgainst={password}
            error={errors.confirmPassword?.message}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
            disabled={busy}
            requiredMark
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex items-start gap-2.5">
            <Controller
              control={control}
              name="news"
              render={({ field }) => (
                <Checkbox
                  id="news"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={busy}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="news" className="text-sm font-normal leading-relaxed text-foreground">
              Gửi tôi email về phiên đấu giá mới và hướng dẫn sử dụng
            </Label>
          </div>

          <div className="flex items-start gap-2.5">
            <Controller
              control={control}
              name="agree"
              render={({ field }) => (
                <Checkbox
                  id="agree"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={busy}
                  aria-invalid={errors.agree ? true : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="agree" className="text-sm font-normal leading-relaxed text-foreground">
              Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật
            </Label>
          </div>
          {errors.agree && (
            <p className="ml-6 text-xs text-red-500">{errors.agree.message}</p>
          )}
        </div>

        {registerError && (
          <AuthAlert>
            {serverMessage ||
              registerError.message ||
              "Không tạo được tài khoản. Vui lòng thử lại."}
          </AuthAlert>
        )}

        <Button type="submit" size="lg" className="w-full h-11" disabled={busy}>
          {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </Button>
      </form>
    </AuthShell>
  );
}
