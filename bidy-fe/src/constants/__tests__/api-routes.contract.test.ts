/**
 * Hợp đồng FE ↔ BE: mọi API_ROUTES, sau khi ghép baseURL `/api/v1` của
 * axiosClient, phải khớp một path trong `src/types/openapi.d.ts`
 * (sinh bởi `npm run openapi:sync`). Bắt lỗi thiếu/thừa prefix và route đã bị BE gỡ.
 */
import fs from "fs";
import path from "path";
import { API_ROUTES } from "@/constants/routes.constants";

const API_PREFIX = "/api/v1";

// Route FE còn giữ nhưng BE chưa có/đã gỡ — đã ghi chú trong routes.constants.ts.
// Xoá khỏi đây khi map lại hoặc gỡ khỏi API_ROUTES.
const KNOWN_MISSING = new Set([
  // backend đã làm xong, chờ sync openapi.d.ts:
  "SELLER_PROFILE",
  "SELLER_AUCTIONS",
  "AUCTION_CANCEL",
  "ADMIN_AUCTIONS",
  "ADMIN_AUCTION_CANCEL",
  "ADMIN_STATISTICS_AUCTIONS",
  "ADMIN_STATISTICS_USERS",
  "AUCTION_REQUESTS",
  "AUCTION_REQUEST_BY_ID",
  "MY_AUCTION_REQUESTS",
  "ADMIN_AUCTION_REQUESTS",
  "ADMIN_AUCTION_REQUEST_BY_ID",
  "ADMIN_AUCTION_REQUEST_APPROVE",
  "ADMIN_AUCTION_REQUEST_REJECT",
  "PRODUCT_PUBLISH",
]);

const specPaths = [
  ...fs
    .readFileSync(path.join(__dirname, "../../types/openapi.d.ts"), "utf8")
    .matchAll(/^ {4}"(\/[^"]+)": \{/gm),
].map(([, p]) => p.replace(/\{[^}]+\}/g, "{}"));

const resolve = (route: string | ((...a: string[]) => string)) =>
  (typeof route === "function" ? route("{}", "{}") : route).replace(/:\w+/g, "{}");

describe("API_ROUTES ↔ openapi.d.ts", () => {
  it("đọc được paths từ openapi.d.ts", () => {
    expect(specPaths.length).toBeGreaterThan(50);
  });

  it.each(Object.entries(API_ROUTES).filter(([k]) => !KNOWN_MISSING.has(k)))(
    "%s tồn tại trong spec",
    (_key, route) => {
      const rel = resolve(route);
      expect(rel.startsWith("/api")).toBe(false); // baseURL đã có /api/v1
      const full = API_PREFIX + rel;
      expect(specPaths.includes(full)).toBe(true);
    },
  );

  it("KNOWN_MISSING không che route đã có trong spec", () => {
    const stale = [...KNOWN_MISSING].filter((k) =>
      specPaths.includes(API_PREFIX + resolve(API_ROUTES[k as keyof typeof API_ROUTES])),
    );
    expect(stale).toEqual([]);
  });
});
