import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Product } from "../../product/entities/product.entity.js"; // Adjusted path to match typical module structure
import { BidHistory } from "./bid-history.entity.js";
import { AuctionStatus } from "../enum/auction-status.enum.js";

@Entity("auctions")
@Index(["productId"])
@Index(["status"])
@Index(["startDate", "endDate"])
export class Auction {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "product_id", type: "bigint" })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "product_id" })
  product!: Product;

  @Column({ name: "starting_price", type: "decimal", precision: 12, scale: 2 })
  startingPrice!: number;

  @Column({ name: "current_price", type: "decimal", precision: 12, scale: 2, default: 0 })
  currentPrice!: number;

  @Column({ name: "buy_now_price", type: "decimal", precision: 12, scale: 2, nullable: true })
  buyNowPrice!: number | null;

  @Column({ name: "reserve_price", type: "decimal", precision: 12, scale: 2, nullable: true })
  reservePrice!: number | null;

  @Column({ name: "bid_increment", type: "decimal", precision: 12, scale: 2, default: 1.00 })
  bidIncrement!: number;

  /**
   * Units of the product sold in this auction.
   *
   * Single-winner: this is the size of the lot the winner takes, not stock that
   * several bidders draw from. Every price on this row — starting, current, buy
   * now, reserve — is for the whole lot, not per unit.
   */
  @Column({ name: "quantity", type: "int", default: 1 })
  quantity!: number;

  @Column({
    type: "varchar",
    length: 30,
    default: "pending",
  })
  status!: AuctionStatus;

  /**
   * Denormalized cache of "this auction has >= 1 active auto_bid_configs row".
   * Read-only convenience for listing/detail payloads — auto_bid_configs stays
   * the source of truth and must be re-checked before acting on it.
   */
  @Column({ name: "has_active_auto_bid", type: "boolean", default: false })
  hasActiveAutoBid!: boolean;

  /**
   * Denormalized bid counters powering the "most contested" and "newest" listing
   * sorts. bid_history remains the source of truth — these are recomputed from it
   * inside the bidding transaction, under the same row lock as current_price.
   */
  @Column({ name: "bidder_count", type: "int", default: 0 })
  bidderCount!: number;

  @Column({ name: "total_bids", type: "int", default: 0 })
  totalBids!: number;

  /**
   * Set once the "ending soon" notification has gone out, so the 10-second
   * lifecycle cron does not re-send it on every tick of the closing window.
   */
  @Column({ name: "ending_soon_notified", type: "boolean", default: false })
  endingSoonNotified!: boolean;

  @Column({ name: "start_date", type: "timestamptz" })
  startDate!: Date;

  @Column({ name: "end_date", type: "timestamptz" })
  endDate!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => BidHistory, (bid) => bid.auction)
  bids!: BidHistory[];
}
