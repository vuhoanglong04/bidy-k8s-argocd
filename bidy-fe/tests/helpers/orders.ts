import { APIRequestContext } from '@playwright/test';
import { CONFIG } from './config';

export interface WonOrderSummary {
  id: string;
  buyerId: string;
  sellerId: string;
  auctionId: string;
  price: number;
  shippingFee: number;
  totalAmount: number | string;
  paymentStatus: string;
  shippingStatus: string;
  fundStatus: string;
  isOverdue?: boolean;
}

/**
 * Fetches all won auctions/orders for the authenticated bidder.
 */
export async function fetchWonOrders(
  request: APIRequestContext,
  token: string
): Promise<WonOrderSummary[]> {
  const response = await request.get(`${CONFIG.API_URL}/orders/won-auctions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to fetch won auctions (${response.status()}): ${text}`);
  }

  const json = await response.json();
  const orders = json.data?.orders || json.data || json.orders || [];
  return Array.isArray(orders) ? orders : [];
}

/**
 * Fetches single order status from GET /orders/:id/status.
 */
export async function fetchOrderStatus(
  request: APIRequestContext,
  orderId: string,
  token: string
): Promise<any> {
  const response = await request.get(`${CONFIG.API_URL}/orders/${orderId}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to fetch order status for #${orderId} (${response.status()}): ${text}`);
  }

  const json = await response.json();
  return json.data || json;
}

/**
 * Fetches payment QR details from GET /orders/:id/payment-qr (with fallback to /payment-info).
 */
export async function fetchPaymentQr(
  request: APIRequestContext,
  orderId: string,
  token: string
): Promise<any> {
  const response = await request.get(`${CONFIG.API_URL}/orders/${orderId}/payment-qr`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok()) {
    const json = await response.json();
    return json.data || json;
  }

  // Fallback to /orders/:id/payment-info
  const fallbackRes = await request.get(`${CONFIG.API_URL}/orders/${orderId}/payment-info`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (fallbackRes.ok()) {
    const json = await fallbackRes.json();
    return json.data || json;
  }

  const text = await response.text();
  throw new Error(`Failed to fetch payment QR for #${orderId} (${response.status()}): ${text}`);
}

/**
 * Fetches current wallet balance via GET /wallet/me and parses balance as Number.
 */
export async function getWalletBalance(
  request: APIRequestContext,
  token: string
): Promise<{ balance: number; raw: any }> {
  const response = await request.get(`${CONFIG.API_URL}/wallet/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to fetch wallet balance (${response.status()}): ${text}`);
  }

  const json = await response.json();
  const raw = json.data ?? json;
  const balance = Number(raw.balance ?? 0);
  return { balance, raw };
}

