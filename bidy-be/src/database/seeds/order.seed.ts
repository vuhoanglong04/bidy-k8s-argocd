import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { Order } from '../../modules/order/entity/order.entity.js';
import { User } from '../../modules/user/entity/user.entity.js';
import { Auction } from '../../modules/auction/entity/auctions.entity.js';
import { AuctionStatus } from '../../modules/auction/enum/auction-status.enum.js';
import { Address } from '../../common/entity/address.entity.js';
import { sepayConfig } from '../../config/sepay.config.js';

export async function seedOrder(dataSource: DataSource): Promise<Order> {
  const orderRepo = dataSource.getRepository(Order);
  const userRepo = dataSource.getRepository(User);
  const auctionRepo = dataSource.getRepository(Auction);
  const addressRepo = dataSource.getRepository(Address);

  // 1. Pick a buyer (prefer existing test users nhuongdo/admin/nhuongadmin or first active user)
  let buyer = await userRepo.findOne({
    where: [{ email: 'dokimnhuong@gmail.com' }, { email: 'nhuongdo6969@gmail.com' }, { email: 'nhuong@gmail.com' }],
  });

  if (!buyer) {
    buyer = await userRepo.findOne({ where: {} });
    if (!buyer) {
      throw new Error('No users found in database to set as buyer.');
    }
  }

  // 2. Pick a seller different from buyer
  let seller = await userRepo.findOne({
    where: [{ email: 'seller@bidy.local' }],
  });

  if (!seller || seller.id === buyer.id) {
    const candidate = await userRepo
      .createQueryBuilder('u')
      .where('u.id != :buyerId', { buyerId: buyer.id })
      .getOne();
    if (candidate) {
      seller = candidate;
    } else {
      seller = buyer; // fallback if only 1 user exists
    }
  }

  // 3. Pick an auction (prefer ended auction)
  let auction = await auctionRepo.findOne({
    where: { status: AuctionStatus.ENDED },
    relations: { product: true },
  });

  if (!auction) {
    auction = await auctionRepo.findOne({
      where: {},
      relations: { product: true },
    });
    if (!auction) {
      throw new Error('No auctions found in database to associate order with.');
    }
  }

  // 4. Ensure buyer has a shipping address
  let address = await addressRepo.findOne({
    where: { userId: buyer.id },
  });

  if (!address) {
    address = await addressRepo.save(
      addressRepo.create({
        userId: buyer.id,
        street: '123 Đường Bidy',
        city: 'Hà Nội',
        state: 'Việt Nam',
        zipCode: '100000',
        isDefault: true,
      }),
    );
  }

  // 5. Create a new test order with status 'pending'
  const finalPrice = 50000; // 50,000 VND
  const shippingFee = 0;
  const totalAmount = finalPrice + shippingFee;
  const paymentDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days in future

  const order = await orderRepo.save(
    orderRepo.create({
      buyer_id: buyer.id,
      seller_id: seller.id,
      auction_id: auction.id,
      shipping_address_id: address.id,
      final_price: finalPrice,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      payment_status: 'pending',
      shipping_status: 'pending',
      tracking_number: null,
      payment_deadline: paymentDeadline,
    }),
  );

  const paymentPrefix = sepayConfig.paymentPrefix || 'BIDY';
  const paddedOrderId = String(order.id).padStart(3, '0');
  const paymentCode = `${paymentPrefix}${paddedOrderId}`;
  const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(sepayConfig.accountNumber)}&bank=${encodeURIComponent(sepayConfig.bankName)}&amount=${totalAmount}&des=${encodeURIComponent(paymentCode)}&template=compact`;

  console.log('\n======================================================');
  console.log('🎉 SEED ORDER CREATED SUCCESSFULLY');
  console.log('======================================================');
  console.log(`Order ID:          ${order.id}`);
  console.log(`Buyer:             ID=${buyer.id}, Username=${buyer.username}, Email=${buyer.email}`);
  console.log(`Seller:            ID=${seller.id}, Username=${seller.username}`);
  console.log(`Auction:           ID=${auction.id}, Product="${auction.product?.name ?? 'Auction Item'}"`);
  console.log(`Total Amount:      ${totalAmount.toLocaleString('vi-VN')} VND`);
  console.log(`Payment Status:    ${order.payment_status}`);
  console.log(`Payment Deadline:  ${paymentDeadline.toISOString()}`);
  console.log(`Payment Code:      ${paymentCode}`);
  console.log(`Bank Name:         ${sepayConfig.bankName}`);
  console.log(`Account Number:    ${sepayConfig.accountNumber}`);
  console.log(`Account Name:      ${sepayConfig.accountName}`);
  console.log(`VietQR URL:        ${qrUrl}`);
  console.log('======================================================\n');

  return order;
}

// Allow direct CLI execution: npx tsx src/database/seeds/order.seed.ts
if (process.argv[1]?.endsWith('order.seed.ts') || process.argv[1]?.endsWith('order.seed.js')) {
  (async () => {
    try {
      await AppDataSource.initialize();
      console.log('✅ DataSource initialized');
      await seedOrder(AppDataSource);
      await AppDataSource.destroy();
      process.exit(0);
    } catch (err) {
      console.error('❌ Error seeding order:', err);
      process.exit(1);
    }
  })();
}
