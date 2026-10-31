"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/loading";
import { useUpdateAdminUserProfile } from "@/services/admin";
import { AdminUser } from "@/types";

/**
 * Ràng buộc username khớp `USERNAME_PATTERN` phía backend: chữ, số, dấu chấm,
 * gạch dưới, gạch ngang. Gửi sai định dạng backend sẽ trả 400.
 */
const schema = z.object({
  username: z
    .string()
    .min(3, "Tên đăng nhập tối thiểu 3 ký tự")
    .max(30, "Tên đăng nhập tối đa 30 ký tự")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Chỉ dùng chữ, số và các ký tự . _ -"
    ),
  email: z.string().email("Email không hợp lệ"),
  fullname: z.string().min(1, "Họ tên không được để trống"),
});

type EditAdminUserFormValues = z.infer<typeof schema>;

interface EditAdminUserDialogProps {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditAdminUserDialog({
  user,
  open,
  onOpenChange,
}: EditAdminUserDialogProps) {
  const { mutate: updateProfile, isPending } = useUpdateAdminUserProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditAdminUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user.username,
      email: user.email,
      fullname: user.fullname,
    },
  });

  // Mở lại dialog cho người dùng khác thì form phải nạp lại giá trị mới.
  useEffect(() => {
    if (open) {
      reset({
        username: user.username,
        email: user.email,
        fullname: user.fullname,
      });
    }
  }, [open, reset, user]);

  const onSubmit = (values: EditAdminUserFormValues) => {
    // Chỉ gửi field thực sự đổi — backend kiểm tra trùng email/username.
    const payload: Partial<EditAdminUserFormValues> = {};
    if (values.username !== user.username) payload.username = values.username;
    if (values.email !== user.email) payload.email = values.email;
    if (values.fullname !== user.fullname) payload.fullname = values.fullname;

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    updateProfile(
      { id: user.id, payload },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa hồ sơ người dùng</DialogTitle>
          <DialogDescription>
            Thay đổi được ghi vào nhật ký thao tác quản trị.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-user-fullname">Họ tên</Label>
            <Input
              id="admin-user-fullname"
              className="rounded-none"
              {...register("fullname")}
            />
            {errors.fullname && (
              <p className="text-xs text-destructive">{errors.fullname.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-user-username">Tên đăng nhập</Label>
            <Input
              id="admin-user-username"
              className="rounded-none"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-user-email">Email</Label>
            <Input
              id="admin-user-email"
              type="email"
              className="rounded-none"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-none"
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="cursor-pointer rounded-none"
            >
              {isPending && <Spinner size="xs" tone="onColor" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
