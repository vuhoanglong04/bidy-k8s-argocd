"use client";

import React from "react";
import Image from "next/image";
import { FileText, ExternalLink, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/loading";
import { useSignedImage } from "@/services/file";

export interface WithdrawalProofDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proofFileId?: string | null;
  proofUrl?: string | null;
}

export function WithdrawalProofDialog({
  open,
  onOpenChange,
  proofFileId,
  proofUrl,
}: WithdrawalProofDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText size={18} /> Chứng từ chuyển khoản
          </DialogTitle>
        </DialogHeader>

        {open && (
          <WithdrawalProofContent
            proofFileId={proofFileId}
            proofUrl={proofUrl}
          />
        )}

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-none text-xs"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawalProofContent({
  proofFileId,
  proofUrl,
}: {
  proofFileId?: string | null;
  proofUrl?: string | null;
}) {
  const { url, onImageError, isRefreshing, isError } = useSignedImage(
    proofFileId,
    proofUrl
  );

  if (isRefreshing && !url) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2">
        <Spinner size="md" tone="primary" label="Đang tải chứng từ..." />
      </div>
    );
  }

  if (isError || !url) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 border border-border bg-muted/20 p-6 text-center text-muted-foreground">
        <AlertCircle className="size-10 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">
          Không xem được chứng từ
        </p>
        <p className="text-xs text-muted-foreground">
          Chứng từ không tồn tại hoặc bạn không có quyền truy cập.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative h-96 w-full overflow-hidden border border-border bg-muted">
        <Image
          src={url}
          alt="Chứng từ chuyển khoản"
          fill
          className="object-contain"
          unoptimized
          onError={onImageError}
        />
      </div>
      <div className="flex justify-end">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary flex items-center gap-1 hover:underline font-semibold"
        >
          <ExternalLink size={13} /> Mở ảnh trong tab mới
        </a>
      </div>
    </div>
  );
}
