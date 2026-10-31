import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from '../modules/user/entity/user.entity.js';
import { Category } from '../modules/category/category.entity.js';
import { Product } from '../modules/product/entities/product.entity.js';
import { ProductImage } from '../modules/product/entities/product-image.entity.js';
import { AdminAuditLog } from '../modules/admin/entity/admin-audit-log.entity.js';
import { UserSession } from '../modules/auth/entity/user-session.entity.js';
import { AuctionRequest } from '../modules/auction/entity/auction-request.entity.js';
import { Auction } from '../modules/auction/entity/auctions.entity.js';
import { BidHistory } from '../modules/auction/entity/bid-history.entity.js';
import { AuctionDeposit } from '../modules/auction/entity/auction-deposit.entity.js';
import { AutoBidConfig } from '../modules/auction/entity/auto-bid-config.entity.js';
import { Wishlist } from '../modules/user/entity/wishlist.entity.js';
import { Order } from '../modules/order/entity/order.entity.js';
import { Transaction } from '../modules/order/entity/transaction.entity.js';
import { Address } from '../common/entity/address.entity.js';
import { Notification } from '../modules/notification/entity/notification.entity.js';
import { Conversation } from '../modules/chat/entity/conversation.entity.js';
import { ConversationMember } from '../modules/chat/entity/conversation-member.entity.js';
import { Message } from '../modules/chat/entity/message.entity.js';
import { SupportTicket } from '../modules/support-chat/entity/support-ticket.entity.js';
import { SupportMessage } from '../modules/support-chat/entity/support-message.entity.js';
import { Review } from '../modules/review/entity/review.entity.js';
import { ReviewMedia } from '../modules/review/entity/review-media.entity.js';
import { ReviewReply } from '../modules/review/entity/review-reply.entity.js';
import { File } from '../modules/file/entity/file.entity.js';
import { Wallet } from '../modules/wallet/entity/wallet.entity.js';
import { WalletLedger } from '../modules/wallet/entity/wallet-ledger.entity.js';
import { WalletWithdrawalRequest } from '../modules/wallet/entity/wallet-withdrawal-request.entity.js';
import { WalletDailySummary } from '../modules/wallet/entity/wallet-daily-summary.entity.js';

dotenv.config();

const isTestEnv = process.env.NODE_ENV === 'test';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: isTestEnv ? 'bidy_db_test' : (process.env.POSTGRES_DB || 'bidy_db'),
  synchronize: false, // Don't auto-sync in production, use migrations
  logging: process.env.NODE_ENV === 'development',
  entities: [
    File,
    User,
    Category,
    Product,
    ProductImage,
    AdminAuditLog,
    UserSession,
    Auction,
    AuctionRequest,
    BidHistory,
    AuctionDeposit,
    AutoBidConfig,
    Wishlist,
    Order,
    Transaction,
    Address,
    Notification,
    Conversation,
    ConversationMember,
    Message,
    SupportTicket,
    SupportMessage,
    Review,
    ReviewMedia,
    ReviewReply,
    Wallet,
    WalletLedger,
    WalletWithdrawalRequest,
    WalletDailySummary,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  subscribers: [],
});
