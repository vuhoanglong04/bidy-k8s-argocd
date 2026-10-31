import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity.js';
import { User } from '../../user/entity/user.entity.js';
import { Auction } from './auctions.entity.js';
import { AuctionRequestStatus } from '../enum/auction-request-status.enum.js';

/**
 * A seller's proposal to auction a product, awaiting an admin decision.
 *
 * It holds the same terms an auction does, because approving one is what creates the
 * auction — the admin approves exactly what the seller asked for, or edits the
 * request first. Prices are copied rather than referenced so that an approval is
 * reproducible from the row: what was agreed stays readable even after the product
 * is edited.
 */
@Entity('auction_requests')
@Index(['sellerId'])
@Index(['status'])
@Index(['productId'])
export class AuctionRequest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'product_id', type: 'bigint' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'seller_id', type: 'bigint' })
  sellerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller!: User;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: AuctionRequestStatus.PENDING,
  })
  status!: AuctionRequestStatus;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity!: number;

  @Column({ name: 'starting_price', type: 'decimal', precision: 12, scale: 2 })
  startingPrice!: number;

  @Column({ name: 'buy_now_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  buyNowPrice!: number | null;

  @Column({ name: 'reserve_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  reservePrice!: number | null;

  @Column({ name: 'bid_increment', type: 'decimal', precision: 12, scale: 2, default: 1.0 })
  bidIncrement!: number;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate!: Date;

  /** Why it was rejected. Required on reject, shown to the seller. */
  @Column({ name: 'reject_reason', type: 'varchar', length: 500, nullable: true })
  rejectReason!: string | null;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer!: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  /**
   * The auction an approval produced. Null until then — and the reason an approved
   * request cannot be approved twice into two auctions.
   */
  @Column({ name: 'auction_id', type: 'bigint', nullable: true })
  auctionId!: string | null;

  @ManyToOne(() => Auction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'auction_id' })
  auction!: Auction | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
