// Application Configuration
// Centralized configuration management using environment variables

export const appConfig = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
    timeout: 30000, // 30 seconds
    retries: 3,
  },

  // Application Settings
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME,
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
    url: process.env.NEXT_PUBLIC_APP_URL,
    version: "1.0.0",
  },

  // Image Configuration
  images: {
    maxSize: parseInt(process.env.NEXT_PUBLIC_MAX_IMAGE_SIZE || "10485760"), // 10MB in bytes
    supportedFormats: (process.env.NEXT_PUBLIC_SUPPORTED_FORMATS || "jpeg,jpg,png,webp").split(","),
    quality: 85,
  },

  // Pagination Configuration
  pagination: {
    defaultPageSize: parseInt(process.env.NEXT_PUBLIC_DEFAULT_PAGE_SIZE || "12"),
    adminPageSize: parseInt(process.env.NEXT_PUBLIC_ADMIN_PAGE_SIZE || "10"),
    maxPageSize: 100,
  },

  // Real-time Updates
  realtime: {
    refreshInterval: 30000, // 30 seconds
    bidRefreshInterval: 5000, // 5 seconds for active bidding
    heartbeatInterval: 10000, // 10 seconds for WebSocket
  },

  // Feature Flags
  features: {
    chat: process.env.NEXT_PUBLIC_ENABLE_CHAT === "true",
    notifications: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === "true",
    darkMode: process.env.NEXT_PUBLIC_ENABLE_DARK_MODE === "true",
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
  },

  // Development Configuration
  dev: {
    showDevTools: process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === "true",
    enableDebug: process.env.NEXT_PUBLIC_ENABLE_DEBUG === "true",
    isDevelopment: process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
  },

  // Security Configuration
  security: {
    maxLoginAttempts: 5,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    csrfProtection: true,
  },
} as const;

// Type-safe configuration getter
export const getConfig = <T extends keyof typeof appConfig>(section: T): typeof appConfig[T] => {
  return appConfig[section];
};

