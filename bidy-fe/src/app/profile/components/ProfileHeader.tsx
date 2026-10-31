"use client";

import Link from "next/link";
import { useRef } from "react";
import { Mail, Phone, Pencil } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Spinner } from "@/components/common/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_ROUTES } from "@/constants";
import { getDefaultAvatar } from "@/lib/image-utils";
import { useUpdateAvatar } from "@/services/user/user.query";
import { User } from "@/types";
import { getImageURL, getValidText } from "@/utils";
import ProfileTabs from "./ProfileTabs";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ProfileHeaderProps {
  profile: User;
  isLoading: boolean;
  tab: string;
  setTab: (tab: string) => void;
}

const ProfileHeader: React.FC<Readonly<ProfileHeaderProps>> = ({
  profile,
  isLoading,
  tab,
  setTab,
}) => {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: updateAvatar, isPending } = useUpdateAvatar();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset ngay để chọn lại cùng 1 file vẫn trigger onChange
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Ảnh đại diện không được vượt quá 5MB");
      return;
    }

    updateAvatar(file);
  };

  if (isLoading) {
    return (
      <header className="border border-border bg-card p-6">
        <div className="flex items-center gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </header>
    );
  }

  const isActive = Boolean(profile?.status);

  return (
    <header className="border border-border bg-card">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative size-20 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageURL(profile?.avatarUrl) ?? getDefaultAvatar(theme)}
              alt={getValidText(profile?.fullname)}
              width={80}
              height={80}
              className="size-20 rounded-full border border-border object-cover"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AVATAR_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              disabled={isPending}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Đổi ảnh đại diện"
              className="absolute inset-0 grid place-items-center rounded-full bg-overlay text-primary-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-100"
            >
              {isPending ? (
                <Spinner size="sm" tone="onColor" label="Đang tải ảnh lên" />
              ) : (
                <Pencil className="size-5" aria-hidden />
              )}
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="truncate text-2xl font-bold text-foreground">
              {getValidText(profile?.fullname) || "Chưa cập nhật tên"}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${
                    isActive ? "bg-success" : "bg-destructive"
                  }`}
                  aria-hidden
                />
                {isActive ? "Đang hoạt động" : "Tài khoản bị khóa"}
              </span>
              {profile?.email && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{profile.email}</span>
                </span>
              )}
              {profile?.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {profile.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <ProfileTabs tab={tab} setTab={setTab} />
          <Link
            href={APP_ROUTES.SETTINGS}
            className="inline-flex h-9 items-center justify-center gap-2 border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Pencil className="size-4" aria-hidden />
            Chỉnh sửa hồ sơ
          </Link>
        </div>
      </div>
    </header>
  );
};

export default ProfileHeader;
