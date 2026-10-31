import { appConfig } from "@/config/app.config";

const rawUrl = appConfig.app.url || "http://localhost:3000";
export const SITE_URL = rawUrl.replace(/\/+$/, "");

export const SITE_NAME = appConfig.app.name ?? "Bidy";

export const SITE_DESCRIPTION =
  appConfig.app.description ??
  "Bidy — sàn đấu giá trực tuyến: đặt giá realtime, đấu giá tự động, thanh toán an toàn.";
