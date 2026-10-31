"use client";

import { useEffect, useState } from "react";

/**
 * Trả về giá trị chỉ cập nhật sau khi `value` ngừng thay đổi `delay` ms.
 * Dùng cho ô search: tránh gọi API mỗi lần gõ phím.
 *
 * `isPending` = true khi giá trị hiện tại chưa được "chốt" — dùng để hiển thị
 * skeleton trong lúc chờ, thay vì chớp giữa kết quả cũ và trạng thái loading.
 */
export function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return { debouncedValue, isPending: debouncedValue !== value };
}
