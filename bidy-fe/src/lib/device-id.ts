const DEVICE_ID_STORAGE_KEY = "bidy.deviceId";

/**
 * Sinh UUID v4 không phụ thuộc `crypto.randomUUID`.
 *
 * `crypto.randomUUID` chỉ có trong **secure context** (https, hoặc localhost).
 * Mở app qua IP LAN bằng http — đúng cách team đang chạy dev — thì `window.crypto`
 * vẫn tồn tại nhưng `randomUUID` là `undefined`. `getRandomValues` thì có mặt ở
 * cả context không bảo mật, nên dùng nó làm đường chính.
 */
function createUuidV4(): string {
  const bytes = new Uint8Array(16);

  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Trình duyệt quá cũ / môi trường lạ: giá trị này chỉ để phân biệt thiết bị,
    // không dùng làm bí mật, nên `Math.random` là đủ ở nhánh chót này.
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Đánh dấu version 4 và variant theo RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * `deviceId` do FE tự sinh và tự giữ.
 *
 * Backend nhận `deviceId` tuỳ chọn trong body `POST /auth/login`; không gửi thì
 * nó tự `randomUUID()` và chỉ nhúng vào refresh token, **không trả về trong
 * response login**. Muốn gọi `POST /auth/logout` (cần `deviceId`) mà không phải
 * decode JWT thì FE phải là bên quyết định giá trị này ngay từ đầu.
 *
 * Dùng `localStorage` chứ không dùng cookie: giá trị này chỉ có ý nghĩa với
 * client, không cần gửi kèm mọi request.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  // localStorage ném lỗi khi bị chặn (chế độ riêng tư, cookie bị tắt). Không để
  // việc đó làm hỏng đăng nhập — mất deviceId chỉ khiến BE tự sinh thay.
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    const deviceId = createUuidV4();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    return createUuidV4();
  }
}
