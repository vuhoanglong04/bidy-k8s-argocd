export interface SepayQrOptions {
  accountNumber: string;
  bankName: string;
  amount: number | string;
  des: string;
  template?: string;
}

/**
 * Builds a SePay VietQR payment URL.
 * Reused across order payment and wallet top-up.
 */
export function buildSepayQrUrl(options: SepayQrOptions): string {
  const { accountNumber, bankName, amount, des, template = 'compact' } = options;
  return `https://qr.sepay.vn/img?acc=${encodeURIComponent(accountNumber)}&bank=${encodeURIComponent(bankName)}&amount=${amount}&des=${encodeURIComponent(des)}&template=${encodeURIComponent(template)}`;
}
