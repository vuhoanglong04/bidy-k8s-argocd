"use client";

import { useState } from "react";
import Image from "next/image";

import MultiImageUpload from "@/components/ui/MultiImageUpload";
import { Spinner } from "@/components/common/loading";
import { MAX_IMAGE_COUNT } from "@/constants";
import type { StoredProductImage } from "@/services/product";

interface StepProductImagesProps {
  /** Ảnh đã nằm trên server — upload xong thì hiện ở đây. */
  uploadedImages: readonly StoredProductImage[];
  isUploading: boolean;
  onUpload: (files: File[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function StepProductImages({
  uploadedImages,
  isUploading,
  onUpload,
  onBack,
  onContinue,
}: Readonly<StepProductImagesProps>) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const remainingSlots = MAX_IMAGE_COUNT - uploadedImages.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hình ảnh</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Tối đa {MAX_IMAGE_COUNT} ảnh. Bản nháp không cần ảnh, nhưng phải có ít
          nhất một ảnh mới đăng bán được.
        </p>
      </div>

      {uploadedImages.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Đã tải lên ({uploadedImages.length}/{MAX_IMAGE_COUNT})
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {uploadedImages.map((image) => (
              <li
                key={image.id ?? image.fileId}
                className="relative aspect-square overflow-hidden border border-border bg-muted"
              >
                {image.imageUrl && (
                  <Image
                    src={image.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 25vw"
                    unoptimized
                  />
                )}
                {image.isPrimary && (
                  <span className="absolute left-0 top-0 bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Ảnh bìa
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {remainingSlots > 0 ? (
        <MultiImageUpload
          images={pendingFiles}
          onChange={setPendingFiles}
          maxImages={remainingSlots}
          isUploading={isUploading}
        />
      ) : (
        <p className="border border-border px-4 py-3 text-sm text-foreground-secondary">
          Đã đủ {MAX_IMAGE_COUNT} ảnh. Xoá bớt ảnh cũ nếu muốn thêm ảnh khác.
        </p>
      )}

      {pendingFiles.length > 0 && (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => {
            onUpload(pendingFiles);
            setPendingFiles([]);
          }}
          className="inline-flex h-10 w-fit items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-btn-disabled-bg disabled:text-btn-disabled-text"
        >
          {isUploading && <Spinner size="xs" tone="onColor" />}
          Tải lên {pendingFiles.length} ảnh
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center justify-center border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-10 items-center justify-center bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Tiếp tục
        </button>
        {uploadedImages.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Bỏ qua cũng được — sản phẩm vẫn giữ ở bản nháp.
          </span>
        )}
      </div>
    </div>
  );
}
