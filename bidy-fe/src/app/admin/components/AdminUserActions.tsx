"use client";

import React, { useState } from "react";
import {
  KeyRound,
  LogOut,
  Pencil,
  ShieldCheck,
  ShieldX,
  Timer,
  Unlock,
  UserCheck,
} from "lucide-react";

import ConfirmationDialog from "@/components/common/confirmation-dialog";
import { Spinner } from "@/components/common/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLE, USER_ROLE_LABELS, USER_STATUS } from "@/constants/app.enum";
import { useAuth } from "@/hooks";
import {
  useActivateAdminUser,
  useBanAdminUser,
  useChangeAdminUserRole,
  useForceAdminUserPasswordReset,
  useRevokeAdminUserSessions,
  useSuspendAdminUser,
  useUnlockAdminUser,
} from "@/services/admin";
import { AdminUser } from "@/types";
import AdminPanel from "./AdminPanel";
import EditAdminUserDialog from "./EditAdminUserDialog";

interface AdminUserActionsProps {
  user: AdminUser;
}

/** Nút hành động chiếm trọn chiều ngang của panel, canh trái đồng nhất. */
function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "outline",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "outline" | "destructive" | "default";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className="w-full cursor-pointer justify-start rounded-none"
    >
      {icon}
      {label}
    </Button>
  );
}

export default function AdminUserActions({ user }: AdminUserActionsProps) {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id ?? currentUser?.idUser;
  const isSelf = Boolean(currentUserId) && currentUserId === user.id;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isBanOpen, setIsBanOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);

  const [suspendReason, setSuspendReason] = useState("");
  const [suspendUntil, setSuspendUntil] = useState("");
  const [banReason, setBanReason] = useState("");
  const [nextRole, setNextRole] = useState<`${USER_ROLE}`>(user.role);
  const [roleReason, setRoleReason] = useState("");

  const { mutate: suspendUser, isPending: isSuspending } = useSuspendAdminUser();
  const { mutate: banUser, isPending: isBanning } = useBanAdminUser();
  const { mutate: changeRole, isPending: isChangingRole } = useChangeAdminUserRole();
  const { mutate: activateUser, isPending: isActivating } = useActivateAdminUser();
  const { mutate: unlockUser, isPending: isUnlocking } = useUnlockAdminUser();
  const { mutate: revokeSessions, isPending: isRevoking } = useRevokeAdminUserSessions();
  const { mutate: forcePasswordReset, isPending: isForcingReset } =
    useForceAdminUserPasswordReset();

  const isActive = user.status === USER_STATUS.ACTIVE;
  const isBanned = user.status === USER_STATUS.BANNED;

  const handleSuspend = () => {
    suspendUser(
      {
        id: user.id,
        payload: {
          reason: suspendReason.trim(),
          // `datetime-local` không có timezone — chuyển sang ISO trước khi gửi.
          until: suspendUntil ? new Date(suspendUntil).toISOString() : undefined,
        },
      },
      {
        onSuccess: () => {
          setIsSuspendOpen(false);
          setSuspendReason("");
          setSuspendUntil("");
        },
      }
    );
  };

  const handleBan = () => {
    banUser(
      { id: user.id, payload: { reason: banReason.trim() } },
      {
        onSuccess: () => {
          setIsBanOpen(false);
          setBanReason("");
        },
      }
    );
  };

  const handleChangeRole = () => {
    changeRole(
      {
        id: user.id,
        payload: {
          role: nextRole,
          reason: roleReason.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setIsRoleOpen(false);
          setRoleReason("");
        },
      }
    );
  };

  return (
    <>
      <AdminPanel title="Hành động quản trị">
        <div className="flex flex-col gap-2">
          <ActionButton
            icon={<Pencil size={16} />}
            label="Sửa hồ sơ"
            onClick={() => setIsEditOpen(true)}
          />

          <ActionButton
            icon={<ShieldCheck size={16} />}
            label="Đổi vai trò"
            onClick={() => {
              setNextRole(user.role);
              setIsRoleOpen(true);
            }}
          />

          {!isActive && (
            <ConfirmationDialog
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isActivating}
                  className="w-full cursor-pointer justify-start rounded-none"
                >
                  <UserCheck size={16} /> Kích hoạt lại
                </Button>
              }
              title="Kích hoạt lại tài khoản"
              description="Gỡ trạng thái tạm khoá/cấm và xoá lý do đã ghi. Người dùng đăng nhập lại được ngay."
              confirmText="Kích hoạt"
              cancelText="Huỷ"
              onConfirm={() => activateUser({ id: user.id })}
              confirmButtonClassName="cursor-pointer"
            />
          )}

          {!isBanned && (
            <ActionButton
              icon={<Timer size={16} />}
              label="Tạm khoá có thời hạn"
              onClick={() => setIsSuspendOpen(true)}
              disabled={isSelf}
            />
          )}

          {user.accountLocked && (
            <ConfirmationDialog
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUnlocking}
                  className="w-full cursor-pointer justify-start rounded-none"
                >
                  <Unlock size={16} /> Mở khoá đăng nhập
                </Button>
              }
              title="Mở khoá đăng nhập"
              description="Tài khoản đang bị hệ thống khoá do đăng nhập sai nhiều lần. Mở khoá để người dùng thử lại."
              confirmText="Mở khoá"
              cancelText="Huỷ"
              onConfirm={() => unlockUser({ id: user.id })}
              confirmButtonClassName="cursor-pointer"
            />
          )}

          <ConfirmationDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                disabled={isRevoking}
                className="w-full cursor-pointer justify-start rounded-none"
              >
                <LogOut size={16} /> Thu hồi phiên đăng nhập
              </Button>
            }
            title="Thu hồi toàn bộ phiên đăng nhập"
            description="Người dùng sẽ bị đăng xuất khỏi mọi thiết bị đang mở."
            confirmText="Thu hồi"
            cancelText="Huỷ"
            onConfirm={() => revokeSessions({ id: user.id })}
            confirmButtonClassName="cursor-pointer"
          />

          <ConfirmationDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                disabled={isForcingReset}
                className="w-full cursor-pointer justify-start rounded-none"
              >
                <KeyRound size={16} /> Buộc đặt lại mật khẩu
              </Button>
            }
            title="Buộc đặt lại mật khẩu"
            description="Người dùng phải đổi mật khẩu ở lần đăng nhập tới. Mọi phiên hiện tại cũng bị thu hồi."
            confirmText="Xác nhận"
            cancelText="Huỷ"
            onConfirm={() => forcePasswordReset({ id: user.id })}
            confirmButtonClassName="cursor-pointer"
          />

          {!isBanned && (
            <ActionButton
              icon={<ShieldX size={16} />}
              label="Cấm vĩnh viễn"
              variant="destructive"
              onClick={() => setIsBanOpen(true)}
              disabled={isSelf}
            />
          )}
        </div>

        {isSelf && (
          <p className="mt-3 text-xs text-muted-foreground">
            Bạn không thể tự tạm khoá hoặc tự cấm tài khoản của chính mình.
          </p>
        )}
      </AdminPanel>

      <EditAdminUserDialog
        user={user}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      {/* ---------- Tạm khoá ---------- */}
      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạm khoá tài khoản</DialogTitle>
            <DialogDescription>
              Mọi phiên đăng nhập của người dùng sẽ bị thu hồi ngay lập tức.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="suspend-reason">Lý do (bắt buộc)</Label>
              <Textarea
                id="suspend-reason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Ví dụ: nghi vấn thao túng giá đấu"
                className="rounded-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="suspend-until">Khoá đến (bỏ trống = vô thời hạn)</Label>
              <Input
                id="suspend-until"
                type="datetime-local"
                value={suspendUntil}
                onChange={(e) => setSuspendUntil(e.target.value)}
                className="rounded-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-none"
              onClick={() => setIsSuspendOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={handleSuspend}
              disabled={isSuspending || !suspendReason.trim()}
              className="cursor-pointer rounded-none"
            >
              {isSuspending && <Spinner size="xs" tone="onColor" />}
              Tạm khoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Cấm ---------- */}
      <Dialog open={isBanOpen} onOpenChange={setIsBanOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cấm tài khoản vĩnh viễn</DialogTitle>
            <DialogDescription>
              Tài khoản bị cấm không thể đăng nhập trở lại cho tới khi được kích
              hoạt thủ công.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ban-reason">Lý do (bắt buộc)</Label>
            <Textarea
              id="ban-reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ví dụ: gian lận thanh toán nhiều lần"
              className="rounded-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-none"
              onClick={() => setIsBanOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBan}
              disabled={isBanning || !banReason.trim()}
              className="cursor-pointer rounded-none"
            >
              {isBanning && <Spinner size="xs" tone="onColor" />}
              Cấm tài khoản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Đổi vai trò ---------- */}
      <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Đổi vai trò</DialogTitle>
            <DialogDescription>
              Không thể hạ quyền quản trị viên đang hoạt động cuối cùng của hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-select">Vai trò</Label>
              <Select
                value={nextRole}
                onValueChange={(value) => setNextRole(value as `${USER_ROLE}`)}
              >
                <SelectTrigger id="role-select" className="cursor-pointer rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(USER_ROLE).map((role) => (
                    <SelectItem key={role} value={role} className="cursor-pointer">
                      {USER_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-reason">Lý do (tuỳ chọn)</Label>
              <Textarea
                id="role-reason"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                className="rounded-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-none"
              onClick={() => setIsRoleOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={handleChangeRole}
              disabled={isChangingRole || nextRole === user.role}
              className="cursor-pointer rounded-none"
            >
              {isChangingRole && <Spinner size="xs" tone="onColor" />}
              Lưu vai trò
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
