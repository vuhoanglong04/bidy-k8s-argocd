"use client";

import { useState } from "react";
import { Eye, EyeOff, Package, Search } from "lucide-react";
import { FieldErrors, useForm, UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { useChangePassword, useUpdateUser } from "@/services/user";
import { useAuth } from "@/hooks";
import { getValidText } from "@/utils";
import { ProfileFormSchema, ProfileForm } from "./schema";
import AddressBook from "./components/AddressBook";

/** Cùng một khuôn input cho mọi tab để form không lệch nhau. */
const inputClass =
  "mt-2 w-full border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-ring disabled:text-foreground-secondary";

const panelClass = "flex w-full flex-col gap-6 border border-border bg-card p-6 sm:p-8";

function ProfileGeneralInfoForm({
  register,
  errors,
}: {
  register: UseFormRegister<ProfileForm>;
  errors: FieldErrors<ProfileForm>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Username */}
      <div>
        <label className="text-sm font-medium text-foreground">Username</label>
        <input {...register("username")} disabled className={inputClass} />
        {errors.username && (
          <p className="mt-1 text-sm text-destructive">
            {errors.username.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="text-sm font-medium text-foreground">Email</label>
        <input {...register("email")} disabled className={inputClass} />
        {errors.email && (
          <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Full name */}
      <div>
        <label className="text-sm font-medium text-foreground">Họ và tên</label>
        <input
          {...register("name")}
          placeholder="Nhập họ và tên"
          className={inputClass}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="text-sm font-medium text-foreground">Số điện thoại</label>
        <input
          {...register("phone")}
          placeholder="Nhập số điện thoại"
          className={inputClass}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>
    </div>
  );
}

function ProfileActionButtons({
  onCancel,
  isValid,
  isDirty,
}: {
  onCancel: () => void;
  isValid: boolean;
  isDirty: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={!isDirty}
        className="inline-flex h-10 items-center border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:text-btn-disabled-text disabled:hover:bg-transparent"
      >
        Huỷ
      </button>
      <button
        type="submit"
        disabled={!isValid || !isDirty}
        className="inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
      >
        Lưu thay đổi
      </button>
    </div>
  );
}

const SETTINGS_TABS = [
  { value: "general", label: "Thông tin chung" },
  { value: "address", label: "Địa chỉ" },
  { value: "delivery", label: "Vận chuyển" },
  { value: "security", label: "Bảo mật" },
] as const;

function ProfileQuickNavTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Mục cài đặt"
      className="-mb-px flex flex-wrap gap-1 border-b border-border"
    >
      {SETTINGS_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            active === tab.value
              ? "border-primary text-foreground"
              : "border-transparent text-foreground-secondary hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
const formSchema = z
  .object({
    currentPassword: z.string().min(1, "Bắt buộc nhập mật khẩu hiện tại"),
    newPassword: z.string().min(8, "Tối thiểu 8 ký tự"),
    confirmPassword: z.string().min(1, "Xác nhận lại mật khẩu"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu không khớp",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;
function SecuritySettingsForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: changePassword } = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  });

  const onSubmit = (data: FormValues) => {
    changePassword({
      old_password: data.currentPassword,
      new_password: data.newPassword,
    });
    reset();
  };

  const fields = [
    {
      name: "currentPassword" as const,
      label: "Mật khẩu hiện tại",
      placeholder: "Nhập mật khẩu hiện tại",
      visible: showCurrent,
      toggle: () => setShowCurrent((v) => !v),
    },
    {
      name: "newPassword" as const,
      label: "Mật khẩu mới",
      placeholder: "Tối thiểu 8 ký tự",
      visible: showNew,
      toggle: () => setShowNew((v) => !v),
    },
    {
      name: "confirmPassword" as const,
      label: "Nhập lại mật khẩu mới",
      placeholder: "Nhập lại mật khẩu mới",
      visible: showConfirm,
      toggle: () => setShowConfirm((v) => !v),
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={panelClass}>
      <div>
        <h2 className="text-lg font-bold text-foreground">Đổi mật khẩu</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Sau khi đổi, các phiên đăng nhập khác vẫn giữ nguyên.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="text-sm font-medium text-foreground">
              {field.label} <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type={field.visible ? "text" : "password"}
                {...register(field.name)}
                placeholder={field.placeholder}
                className={cn(inputClass, "pr-12")}
              />
              <button
                type="button"
                onClick={field.toggle}
                tabIndex={-1}
                aria-label={field.visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-foreground-secondary transition-colors hover:text-foreground"
              >
                {field.visible ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            {errors[field.name] && (
              <p className="mt-1 text-sm text-destructive">
                {errors[field.name]?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
        <button
          type="button"
          disabled={!isValid || !isDirty}
          onClick={() => reset()}
          className="inline-flex h-10 items-center border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:text-btn-disabled-text disabled:hover:bg-transparent"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={!isValid || !isDirty}
          className="inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
        >
          Đổi mật khẩu
        </button>
      </div>
    </form>
  );
}

function DeliverySettingsTab() {
  // TODO: Connect to real API data
  const summary = [
    { count: 0, label: "Tất cả", active: true },
    { count: 0, label: "Tự vận chuyển" },
    { count: 0, label: "Vận chuyển bởi chúng tôi" },
    { count: 0, label: "Đã tới người mua" },
  ];
  const rows: Array<{
    date: string;
    name: string;
    code: string;
    buyer: string;
    price: string;
  }> = []; // Empty array - no mock data
  return (
    <div className={panelClass}>
      <div>
        <h2 className="text-lg font-bold text-foreground">Vận chuyển</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Các đơn bạn cần giao sau khi phiên đấu giá kết thúc.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
        {summary.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 bg-card px-4 py-3"
          >
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {item.count}
            </span>
            <span className="text-xs text-foreground-secondary">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Search and date filter */}
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-secondary"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Tìm theo mã sản phẩm"
            className="h-10 w-full border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <input
          type="date"
          aria-label="Lọc theo ngày"
          className="h-10 border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border bg-muted text-muted-foreground">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Ngày kết thúc
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Tên sản phẩm
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Mã sản phẩm
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Người mua
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Giá cuối cùng
              </th>
              <th className="px-4 py-3 text-center">
                <span className="sr-only">Chọn</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <Package
                    className="mx-auto size-8 text-foreground-secondary"
                    aria-hidden
                  />
                  <p className="mt-3 text-base font-medium text-foreground">
                    Chưa có dữ liệu vận chuyển
                  </p>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    Dữ liệu sẽ xuất hiện khi bạn có đơn hàng cần giao.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-secondary">
                    {row.date}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground">
                    {row.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-secondary">
                    {row.code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-secondary">
                    {row.buyer}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                    {row.price}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" className="size-4 accent-primary" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// function PaymentSettingsTab() {
//   return (
//     <div
//       className="w-full max-w-[92vw] lg:max-w-4xl mx-auto bg-card rounded-2xl shadow-lg border border-border p-8 flex flex-col gap-8"
//       style={{ boxShadow: "0 0 8px 0 rgba(108,108,108,0.25)" }}
//     >
//       <h2 className="text-xl font-bold text-foreground mb-2">
//         Thanh toán
//       </h2>
//       {/* Saved credit cards */}
//       <div className="bg-secondary rounded-xl p-6 flex flex-col items-center justify-center border border-border">
//         <div className="w-full flex flex-col items-center justify-center gap-4 min-h-[120px]">
//           {/* Empty state illustration (simple SVG placeholder) */}
//           <Image src={"/nocard.svg"} alt="No card" width={128} height={128} />
//           <div className="text-foreground font-semibold text-base">
//             Thẻ tín dụng đã lưu
//           </div>
//           <div className="text-foreground text-sm text-center max-w-md">
//             Chưa có thẻ tín dụng nào được lưu. Thêm thẻ tín dụng để thanh toán
//             nhanh gọn hơn!
//           </div>
//           <button className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-lg px-6 py-2 text-base shadow hover:bg-primary/80 transition">
//             Thêm thẻ tín dụng
//           </button>
//         </div>
//       </div>
//       {/* Default payment method row as dropdown */}
//       <div className="flex flex-col md:flex-row items-center gap-4 bg-background rounded-lg border border-border px-6 py-4">
//         <div className="flex-1 flex flex-col md:flex-row items-center w-full justify-between gap-4">
//           <div className="font-semibold text-foreground">
//             Phương thức thanh toán mặc định
//           </div>
//           <select
//             className="w-full md:w-fit px-4 py-2 rounded border border-border bg-secondary text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
//             defaultValue="credit"
//           >
//             <option value="credit">Thẻ tín dụng</option>
//             <option value="qr">Quét mã QR chuyển khoản</option>
//           </select>
//         </div>
//       </div>
//     </div>
//   );
// }


export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const { mutate: updateUser } = useUpdateUser();
  const formMethods = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      name: getValidText(user?.fullname),
      username: getValidText(user?.username),
      phone: getValidText(user?.phone),
      email: getValidText(user?.email),
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    reset,
  } = formMethods;

  const onSubmit = (data: ProfileForm) => {
    const payload = {
      fullName: data.name,
      email: data.email,
      identity: getValidText(user?.identity),
      phone: data.phone,
    };
    updateUser(payload, {
      onSuccess: () => {
        reset(data);
      },
    });
  };

  const onCancel = () => {
    reset();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Thông tin tài khoản, địa chỉ giao hàng và bảo mật.
        </p>
      </header>

      <ProfileQuickNavTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "general" && (
        <form className={panelClass} onSubmit={handleSubmit(onSubmit)}>
          <div>
            <h2 className="text-lg font-bold text-foreground">Thông tin chung</h2>
            <p className="mt-1 text-sm text-foreground-secondary">
              Username và email không đổi được — liên hệ hỗ trợ nếu cần.
            </p>
          </div>
          <ProfileGeneralInfoForm register={register} errors={errors} />
          <ProfileActionButtons
            onCancel={onCancel}
            isValid={isValid}
            isDirty={isDirty}
          />
        </form>
      )}
      {activeTab === "address" && <AddressBook />}
      {activeTab === "security" && <SecuritySettingsForm />}
      {activeTab === "delivery" && <DeliverySettingsTab />}
    </div>
  );
}
