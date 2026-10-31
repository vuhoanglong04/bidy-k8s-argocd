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
import { AuctionDepositStatus } from "../enum/auction-deposit.enum.js";

@Entity("auction_deposits")
@Index(["auctionId"])
@Index(["userId"])
export class AuctionDeposit {
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
    type: "varchar",
    length: 30,
    default: "held",
  })
  status!: AuctionDepositStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
