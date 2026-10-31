"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, LogOut, ShieldOff, UserX } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/constants";
import {
  clearAccountLock,
  readAccountLock,
  type AccountLockDetails,
  type AccountLockKind,
} from "@/lib/account-lock";

/**
 * `tone` tách khỏi nội dung vì `revoked` KHÔNG phải chuyện tài khoản có vấn đề:
 * admin thu hồi phiên hoặc buộc đổi mật khẩu, user đăng nhập lại được ngay. Tô
 * đỏ như ban là doạ nhầm người không bị làm sao.
 */
const COPY: Record<
  AccountLockKind,
  { icon: typeof Ban; title: string; body: string; tone: "destructive" | "muted" }
> = {
  banned: {
    icon: Ban,
    title: "Tài khoản đã bị cấm",
    body: "Tài khoản của bạn đã bị cấm vĩnh viễn và không thể tiếp tục sử dụng dịch vụ.",
    tone: "destructive",
  },
  suspended: {
    icon: UserX,
    title: "Tài khoản đang bị tạm ngưng",
    body: "Tài khoản của bạn đang bị tạm ngưng. Trong thời gian này bạn không thể đăng nhập hay tham gia đấu giá.",
    tone: "destructive",
  },
  unavailable: {
    icon: ShieldOff,
    title: "Tài khoản hiện không khả dụng",
    body: "Tài khoản của bạn đang bị hạn chế nên không thể đăng nhập. Liên hệ hỗ trợ để biết chi tiết.",
    tone: "destructive",
  },
  // Tài khoản KHÔNG bị làm sao: admin thu hồi phiên hoặc buộc đổi mật khẩu, đăng
  // nhập lại là vào được ngay. Không ám chỉ gì về tình trạng tài khoản.
  revoked: {
    icon: LogOut,
    title: "Bạn đã được đăng xuất",
    body: "Phiên đăng nhập trên thiết bị này đã được thu hồi vì lý do bảo mật. Đăng nhập lại để tiếp tục.",
    tone: "muted",
  },
};

export default function AccountLockedPage() {
  // Đọc trong effect: sessionStorage không tồn tại lúc render trên server, đọc
  // thẳng khi render sẽ lệch hydration.
  const [details, setDetails] = useState<AccountLockDetails | null>(null);

  useEffect(() => {
    setDetails(readAccountLock());
  }, []);

  const copy = COPY[details?.kind ?? "revoked"];
  const Icon = copy.icon;

  const until = details?.suspendedUntil
    ? (() => {
        try {
          return format(new Date(details.suspendedUntil), "HH:mm 'ngày' dd/MM/yyyy", {
            locale: vi,
          });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg border border-border bg-card">
        <div className="flex flex-col items-center gap-4 border-b border-border px-6 py-10 text-center">
          <div
            className={cn(
              "flex size-20 items-center justify-center",
              copy.tone === "destructive" ? "bg-destructive/10" : "bg-muted"
            )}
          >
            <Icon
              className={cn(
                "size-10",
                copy.tone === "destructive"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
              aria-hidden
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-sm text-foreground-secondary">{copy.body}</p>
        </div>

        {(details?.reason || until) && (
          <dl className="flex flex-col gap-4 border-b border-border px-6 py-5">
            {details?.reason && (
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Lý do
                </dt>
                {/* Câu admin tự viết — hiển thị nguyên văn, không diễn giải lại. */}
                <dd className="text-sm break-words text-foreground">
                  {details.reason}
                </dd>
              </div>
            )}
            {until && (
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Được mở lại vào
                </dt>
                <dd className="text-sm tabular-nums text-foreground">{until}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row">
          {/* Phiên bị thu hồi thì không có gì phải khiếu nại — chỉ đăng nhập lại. */}
          {copy.tone === "destructive" && (
            <Button asChild variant="outline" className="flex-1">
              <Link href={APP_ROUTES.CONTACT}>Liên hệ hỗ trợ</Link>
            </Button>
          )}
          <Button asChild className="flex-1">
            {/* Dọn cờ trước khi rời đi: giữ lại sẽ khiến lần khoá sau hiện nhầm
                lý do cũ nếu tín hiệu mới không kèm chi tiết. */}
            <Link href={APP_ROUTES.SIGN_IN} onClick={clearAccountLock}>
              Đăng nhập lại
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
