import dotenv from 'dotenv';
dotenv.config();

export const sepayConfig = {
  bankName: process.env.SEPAY_BANK_NAME || 'MBBank',
  accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '',
  accountName: process.env.SEPAY_ACCOUNT_NAME || '',
  paymentPrefix: process.env.SEPAY_PAYMENT_PREFIX || 'BIDY',
  webhookSecret: process.env.SEPAY_WEBHOOK_SECRET || '',
  apiKey: process.env.SEPAY_API_KEY || '',
};
