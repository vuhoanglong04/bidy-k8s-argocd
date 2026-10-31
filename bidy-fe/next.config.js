if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0
    },
    writable: true,
    enumerable: true,
    configurable: true
  });
}
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server bundle (.next/standalone) for Docker.
  output: "standalone",

  /**
   * =========================
   * CORE BUILD FIX (QUAN TRỌNG)
   * =========================
   * Tắt lint + typecheck khi build
   * → tránh SIGKILL (EXIT=137) trên VPS RAM thấp
   */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  /**
   * =========================
   * PACKAGE / PERFORMANCE
   * =========================
   */
  transpilePackages: ["@radix-ui/*"],

  experimental: {
    optimizePackageImports: ["lucide-react"],
    optimizeServerReact: false,
    optimizeCss: false,
  },

  /**
   * =========================
   * IMAGE CONFIG
   * =========================
   */
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 31536000,
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/images/**",
      },
      {
        protocol: "http",
        hostname: "123.30.238.194",
        port: "8001",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "bidy.vn",
        pathname: "/api/images/**",
      },
      {
        protocol: "https",
        hostname:
          "bidy-resource-prd1.s3.ap-southeast-1.amazonaws.com",
        pathname: "/**",
      },
      // Presigned URL do BE sinh bằng AWS SDK: hostname thay đổi theo
      // region/endpoint (s3.<region>.amazonaws.com, <bucket>.s3....).
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
        pathname: "/**",
      },
      // Cloudflare R2 — bucket private, ảnh tới dưới dạng presigned URL sống
      // 3600s. Hostname là "<account-id>.r2.cloudflarestorage.com" nên dùng
      // wildcard để không phải sửa config mỗi khi đổi account/môi trường.
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      // Ảnh placeholder trong seed data của backend (auction.seed.ts).
      // Chỉ phục vụ dev/staging — dữ liệu thật dùng S3 ở trên.
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/seed/**",
      },
      // Backend dev chạy ở cổng 8080; giữ 8001 ở trên cho cấu hình cũ.
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "192.168.0.103",
        port: "8080",
        pathname: "/**",
      },
    ],
  },

  /**
   * =========================
   * WEBPACK
   * =========================
   */
  webpack: (config, { isServer }) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    config.resolve.alias["~"] = path.resolve(__dirname, "public");

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  /**
   * =========================
   * COMPILER
   * =========================
   */
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  /**
   * =========================
   * PROD SETTINGS
   * =========================
   */
  poweredByHeader: false,
  reactStrictMode: false,

  /**
   * =========================
   * SECURITY HEADERS
   * =========================
   */
  async headers() {
    return [
      {
        source: "/((?!_next/static).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
