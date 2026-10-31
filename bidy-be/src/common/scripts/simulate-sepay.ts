import 'dotenv/config';
import crypto from 'crypto';
import { sepayConfig } from '../../config/sepay.config.js';

async function run() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Error: simulate-sepay is a dev tool and must not be run in production.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npm run sepay:simulate -- <content> <amount>');
    console.error('Example: npm run sepay:simulate -- BIDYTOPUP12 500000');
    console.error('Example: npm run sepay:simulate -- BIDY7 530000');
    process.exit(1);
  }

  const [content, amountStr] = args;
  const amount = Number(amountStr);

  if (isNaN(amount) || amount <= 0) {
    console.error(`❌ Invalid amount: "${amountStr}". Amount must be a positive number.`);
    process.exit(1);
  }

  const sepayId = Date.now();
  const payload = {
    id: sepayId,
    gateway: sepayConfig.bankName || 'MBBank',
    transactionDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
    accountNumber: sepayConfig.accountNumber || '',
    code: null,
    content: content,
    transferType: 'in',
    transferAmount: amount,
    accumulated: 0,
    subAccount: null,
    referenceCode: `SEPAY_${sepayId}`,
    description: content,
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sepayConfig.webhookSecret) {
    const signature =
      'sha256=' +
      crypto
        .createHmac('sha256', sepayConfig.webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
    headers['x-sepay-timestamp'] = timestamp;
    headers['x-sepay-signature'] = signature;
  } else if (sepayConfig.apiKey) {
    headers['Authorization'] = `Apikey ${sepayConfig.apiKey}`;
  }

  const port = process.env.PORT || '3000';
  const url = `http://localhost:${port}/api/v1/orders/webhook/sepay`;

  console.log(`🚀 Sending simulated SePay webhook to ${url}...`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: rawBody,
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`\nStatus Code: ${response.status} ${response.statusText}`);
    console.log(
      'Response Body:',
      typeof responseData === 'object' ? JSON.stringify(responseData, null, 2) : responseData,
    );

    if (response.ok) {
      console.log('✅ Webhook simulation completed successfully.');
    } else {
      console.error('⚠️ Webhook returned non-2xx status.');
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to server:', error.message || error);
    process.exit(1);
  }
}

run();
