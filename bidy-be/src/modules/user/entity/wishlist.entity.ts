import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Auction } from "../../auction/entity/auctions.entity";

@Entity("wishlists")
@Index(["userId", "auctionId"], { unique: true })
export class Wishlist {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "auction_id", type: "bigint" })
  auctionId!: string;

  @ManyToOne(() => Auction, { onDelete: "CASCADE" })
  @JoinColumn({ name: "auction_id" })
  auction!: Auction;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
