import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "../styles/globals.css";
import { AppShell } from "@/components/layout";
import Provider from "@/providers";
import { Toaster } from "@/components/ui/sonner";
import { PreloadManager } from "@/components/common/preload-manager";
import { PageErrorBoundary } from "@/components/common/error-boundary";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site.config";

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

// Mặt số kiểu đồng hồ điện tử — chỉ dùng cho countdown/LCD qua utility `font-digital`
const orbitron = Orbitron({
  variable: "--font-orbitron",
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

const defaultTitle = `${SITE_NAME} — Đấu giá trực tuyến`;

export const metadata: Metadata = {
  // Metadata ở root layout được mọi trang con kế thừa; không đặt canonical/og:url "/" tại đây để tránh trang con bị trỏ canonical về trang chủ (canonical đặt ở từng page)
  metadataBase: new URL(SITE_URL),
  title: {
    default: defaultTitle,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "đấu giá trực tuyến",
    "đấu giá online",
    "sàn đấu giá",
    "đấu giá Bidy",
    "đặt giá realtime",
    "đấu giá tự động",
  ],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${orbitron.variable} antialiased overflow-x-hidden`}
        suppressHydrationWarning
      >
        <PageErrorBoundary>
          <Provider>
            <AppShell>{children}</AppShell>
            <Toaster />
            <PreloadManager />
          </Provider>
        </PageErrorBoundary>
      </body>
    </html>
  );
}