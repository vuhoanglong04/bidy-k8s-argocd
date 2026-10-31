import { API_ROUTES } from '@/constants';
import axiosClient from '@/lib/axios-client';
import type { paths } from '@/types/openapi';

/** Payload trả về khi upload hoặc khi ký lại URL cho một file đã lưu. */
export interface SignedFile {
  id: string;
  url: string;
  /** Số giây URL còn sống, tính từ lúc backend tạo response. */
  expiresIn: number;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

/** Folder prefix trong bucket. Avatar KHÔNG đi đường này — dùng `UPDATE_AVATAR`. */
export type FilePurpose = NonNullable<
  paths['/api/v1/files']['post']['requestBody']['content']['multipart/form-data']['purpose']
>;

/**
 * `POST /api/v1/files` — upload 1 file, nhận về id để gắn vào resource cùng
 * một presigned URL để preview ngay.
 */
export const uploadFile = async (file: File, purpose: FilePurpose = 'product') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);

  const res = await axiosClient.post<ApiEnvelope<SignedFile>>(API_ROUTES.FILE_UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
};

/**
 * `GET /api/v1/files/:id/url` — ký lại URL cho file đã lưu.
 *
 * Auth tuỳ điều kiện: ảnh sản phẩm ký được ẩn danh, file khác cần Bearer token.
 * Không được phép → **404** (không phải 401), có chủ đích để id không lộ là nó
 * có tồn tại hay không.
 */
export const fetchSignedFileUrl = async (id: string) => {
  const res = await axiosClient.get<ApiEnvelope<SignedFile>>(API_ROUTES.FILE_URL(id));
  return res.data.data;
};
