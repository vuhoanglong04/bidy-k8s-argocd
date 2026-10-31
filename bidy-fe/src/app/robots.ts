import type { MetadataRoute } from "next";
import { APP_ROUTES } from "@/constants/routes.constants";
import { SITE_URL } from "@/config/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        APP_ROUTES.PROFILE,
        APP_ROUTES.ADMIN,
        "/payment", // Payment callback / processing route (chưa có trong APP_ROUTES)
        APP_ROUTES.NOTIFICATIONS,
        APP_ROUTES.SIGN_IN,
        APP_ROUTES.SIGN_UP,
        APP_ROUTES.FORGOT_PASS,
        APP_ROUTES.RESET_PASS,
        APP_ROUTES.VERIFY_EMAIL,
        APP_ROUTES.ACCOUNT_LOCKED,
        APP_ROUTES.PRODUCT_NEW,
        APP_ROUTES.AUCTION_NEW,
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
