/**
 * Giới hạn upload ảnh — phải khớp với multer ở backend
 * (`src/middlewares/image_upload.middleware.ts`). Lệch là user chọn xong mới
 * bị reject ở server.
 */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

/** Dung lượng tối đa mỗi file, tính bằng MB. */
export const MAX_IMAGE_SIZE_MB = 5;

/** Số file tối đa cho mỗi request upload. */
export const MAX_IMAGE_COUNT = 10;

/** Giá trị cho thuộc tính `accept` của <input type="file">. */
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_MIME_TYPES.join(",");
