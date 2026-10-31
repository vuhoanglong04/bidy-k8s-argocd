import type { MetadataRoute } from "next";
import { APP_ROUTES } from "@/constants/routes.constants";
import { SITE_URL } from "@/config/site.config";
import { POLICY_DOCS } from "@/constants/policies.constants";
import { fetchSitemapAuctions, fetchSitemapCategories } from "@/services/seo/seo.server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, auctions] = await Promise.all([
    fetchSitemapCategories(),
    fetchSitemapAuctions(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}${APP_ROUTES.HOME}`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}${APP_ROUTES.CATEGORY}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${APP_ROUTES.CATEGORY_ALL}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${APP_ROUTES.ABOUT}`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}${APP_ROUTES.CONTACT}`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}${APP_ROUTES.GUIDE}`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}${APP_ROUTES.POLICIES}`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...POLICY_DOCS.map((doc) => ({
      url: `${SITE_URL}${APP_ROUTES.POLICY(doc.slug)}`,
      lastModified: new Date(doc.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${SITE_URL}${APP_ROUTES.CATEGORY_DETAIL(cat.slug)}`,
    lastModified: cat.updatedAt ? new Date(cat.updatedAt) : undefined,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const auctionEntries: MetadataRoute.Sitemap = auctions.map((auction) => ({
    url: `${SITE_URL}${APP_ROUTES.PRODUCT_DETAIL(auction.id)}`,
    lastModified: auction.updatedAt ? new Date(auction.updatedAt) : undefined,
    changeFrequency: "hourly" as const,
    priority: 0.9,
  }));

  return [...staticEntries, ...categoryEntries, ...auctionEntries];
}
