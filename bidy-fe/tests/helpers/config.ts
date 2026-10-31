export const CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  API_URL: process.env.E2E_API_URL || 'http://localhost:8080/api/v1',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || process.env.E2E_WS_URL || 'ws://localhost:8001',
  BE_DIR: '/home/acer/bidy-be',
  USERS: {
    SELLER: {
      username: process.env.E2E_SELLER_USERNAME || 'seed_seller',
      password: process.env.E2E_USER_PASSWORD || '',
    },
    BUYER: {
      username: process.env.E2E_BUYER_USERNAME || 'seed_bidder3',
      password: process.env.E2E_USER_PASSWORD || '',
    },
    BIDDER1: {
      username: process.env.E2E_BUYER_USERNAME || 'seed_bidder3',
      password: process.env.E2E_USER_PASSWORD || '',
    },
    BIDDER2: {
      username: process.env.E2E_BIDDER2_USERNAME || 'seed_bidder2',
      password: process.env.E2E_USER_PASSWORD || '',
    },
    ADMIN: {
      username: process.env.E2E_ADMIN_USERNAME || 'admin',
      password: process.env.E2E_ADMIN_PASSWORD || '',
    },
  },
  ORDERS: {
    RELEASE_ID: process.env.E2E_ORDER_RELEASE_ID || '',
    REFUND_ID: process.env.E2E_ORDER_REFUND_ID || '',
    QR_ID: process.env.E2E_ORDER_QR_ID || '',
  },
  TOPUP_AMOUNT: Number(process.env.E2E_TOPUP_AMOUNT) || 8000000,
};

export function validateEnvironment(): void {
  const missing: string[] = [];
  if (!process.env.E2E_USER_PASSWORD) {
    missing.push('E2E_USER_PASSWORD');
  }
  if (!process.env.E2E_ADMIN_PASSWORD) {
    missing.push('E2E_ADMIN_PASSWORD');
  }
  if (!process.env.E2E_ORDER_RELEASE_ID) {
    missing.push('E2E_ORDER_RELEASE_ID');
  }
  if (!process.env.E2E_ORDER_REFUND_ID) {
    missing.push('E2E_ORDER_REFUND_ID');
  }
  if (!process.env.E2E_ORDER_QR_ID) {
    missing.push('E2E_ORDER_QR_ID');
  }
  if (missing.length > 0) {
    throw new Error(
      `[E2E Setup Error] Missing required environment variables: ${missing.join(', ')}. ` +
      `Please provide them before running tests, e.g.:\n` +
      `E2E_USER_PASSWORD=... E2E_ADMIN_PASSWORD=... E2E_ORDER_RELEASE_ID=... E2E_ORDER_REFUND_ID=... E2E_ORDER_QR_ID=... npm run test:e2e`
    );
  }
}

