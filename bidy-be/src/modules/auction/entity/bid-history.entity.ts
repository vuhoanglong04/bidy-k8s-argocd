import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Auction } from "./auctions.entity";
import { User } from "../../user/entity/user.entity"; // Adjust path if needed

@Entity("bid_history")
@Index(["auctionId"])
@Index(["userId"])
export class BidHistory {
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

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({
    name: "action_type",
    type: "varchar",
    length: 30,
    default: "place_bid",
  })
  actionType!: string;

  /** Rank of this user when the row was written (1 = leading). Null where rank is meaningless. */
  @Column({ type: "int", nullable: true })
  position!: number | null;

  /** Event payload; for `auto_bid`: { auto_bid_config_id, triggered_by_bid_id, limit_bid }. */
  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
