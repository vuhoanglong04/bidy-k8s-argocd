'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchSignedFileUrl, uploadFile, type FilePurpose } from './file.fetcher';

export const fileKeys = {
  all: ['file'] as const,
  url: (id: string) => [...fileKeys.all, 'url', id] as const,
};

/**
 * Presigned URL sống 3600s tính từ phía server. Refetch sớm hơn 10 phút để chừa
 * biên cho network và thời gian trang đã mở trước khi hook chạy.
 */
const SIGNED_URL_STALE_TIME = 50 * 60 * 1000; // 50 phút

export const useUploadFile = () =>
  useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose?: FilePurpose }) =>
      uploadFile(file, purpose),
  });

/**
 * Giữ cho một ảnh presigned luôn hiển thị được.
 *
 * Dùng `initialUrl` (URL đến kèm response của resource) cho tới khi nó hết hạn,
 * rồi ký lại qua `GET /files/:id/url`. Gọi `onImageError` từ `onError` của
 * `<img>`/`<Image>` để ép ký lại ngay — FE không biết URL đã "già" bao lâu vì
 * TTL tính từ phía server.
 *
 * Auth là tuỳ điều kiện:
 * - Ảnh sản phẩm (file được `product_images` trỏ tới, gồm cả ảnh từ luồng
 *   auction listing) ký được kể cả khi chưa đăng nhập → để `enabled` mặc định.
 * - Mọi file khác (avatar, media review) bắt buộc token → truyền
 *   `enabled: isAuthenticated`, vì ẩn danh sẽ luôn 404.
 *
 * Backend trả **404** chứ không phải 401 cho file không được phép ký, để id
 * không tiết lộ là nó có tồn tại hay không. Vì vậy đừng bắt 401 để refresh
 * token rồi gọi lại — ở endpoint này 404 nghĩa là "không có, hoặc không phải
 * của bạn", cả hai đều fallback placeholder.
 */
export const useSignedImage = (
  fileId: string | null | undefined,
  initialUrl?: string | null,
  options: { enabled?: boolean } = {}
) => {
  const { enabled = true } = options;
  const [needsRefresh, setNeedsRefresh] = useState(false);

  // Resource được refetch → initialUrl mới → bỏ cờ hỏng của URL cũ.
  useEffect(() => {
    setNeedsRefresh(false);
  }, [initialUrl]);

  const query = useQuery({
    queryKey: fileKeys.url(fileId ?? ''),
    queryFn: () => fetchSignedFileUrl(fileId as string),
    enabled: enabled && Boolean(fileId) && (needsRefresh || !initialUrl),
    staleTime: SIGNED_URL_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const onImageError = useCallback(() => {
    setNeedsRefresh(true);
  }, []);

  return {
    url: query.data?.url ?? (needsRefresh ? null : initialUrl ?? null),
    onImageError,
    isRefreshing: query.isFetching,
    isError: query.isError,
  };
};
