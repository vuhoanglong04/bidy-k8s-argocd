"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

/**
 * Không retry với lỗi 4xx — request đã sai thì gửi lại vẫn sai.
 *
 * Đặc biệt quan trọng với 429: rate limiter của backend đếm theo IP trong cửa
 * sổ 15 phút, nên mỗi lần retry lại cộng thêm vào chính bộ đếm đang chặn mình.
 * Retry mù biến một burst ngắn thành tình trạng kẹt kéo dài — counter không bao
 * giờ kịp trôi. Chỉ retry lỗi mạng và 5xx.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;

  if (typeof status === "number" && status >= 400 && status < 500) {
    return false;
  }

  return failureCount < 2;
}

export default function QueryProviders({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: shouldRetry,
            retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Mutation (đặt giá, mua ngay) tuyệt đối không tự retry: gửi lại có
            // thể tạo bid trùng, và 4xx thì gửi lại cũng vô ích.
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
