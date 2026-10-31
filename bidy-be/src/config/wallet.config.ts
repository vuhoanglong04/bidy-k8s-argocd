import dotenv from 'dotenv';
dotenv.config();

function parsePlatformWalletId(): string {
  const rawId = process.env.PLATFORM_WALLET_ID;
  if (!rawId || !/^\d+$/.test(rawId.trim()) || BigInt(rawId.trim()) <= 0n) {
    throw new Error(
      `Missing or unparseable PLATFORM_WALLET_ID environment variable: "${rawId}". ` +
        `PLATFORM_WALLET_ID must be a positive integer identifying the platform wallet.`
    );
  }
  return rawId.trim();
}

export const walletConfig = {
  platformWalletId: parsePlatformWalletId(),
};
