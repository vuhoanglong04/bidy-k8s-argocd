import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Auction } from "./auctions.entity.js";
import { User } from "../../user/entity/user.entity.js";

@Entity("auto_bid_configs")
@Index(["auctionId", "userId"], { unique: true })
@Index("idx_auto_bid_configs_resolution", ["auctionId", "limitBid", "createdAt"], {
  where: '"is_active" = true',
})
export class AutoBidConfig {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "auction_id", type: "bigint" })
  auctionId!: string;

  @ManyToOne(() => Auction, { onDelete: "CASCADE" })
  @JoinColumn({ name: "auction_id" })
  auction!: Auction;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  /** Ceiling the engine may bid up to on this user's behalf. Never exposed to other bidders. */
  @Column({ name: "limit_bid", type: "decimal", precision: 12, scale: 2 })
  limitBid!: number;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
