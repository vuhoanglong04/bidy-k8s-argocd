import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "../../../common/entity/base.entity";
import { User } from "../../user/entity/user.entity";
import { Auction } from "../../auction/entity/auctions.entity";
import { Address } from "../../../common/entity/address.entity";

@Entity("orders")
@Index(["buyer_id"])
@Index(["seller_id"])
@Index(["auction_id"])
@Index(["payment_status"])
@Index(["shipping_status"])
export class Order extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "bigint" })
  buyer_id!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "buyer_id" })
  buyer!: User;

  @Column({ type: "bigint" })
  seller_id!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "seller_id" })
  seller!: User;

  @Column({ type: "bigint" })
  auction_id!: string;

  @ManyToOne(() => Auction, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "auction_id" })
  auction!: Auction;

  @Column({ type: "bigint" })
  shipping_address_id!: string;

  @ManyToOne(() => Address, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "shipping_address_id" })
  shipping_address!: Address;

  @Column({ type: "decimal", precision: 14, scale: 2 })
  final_price!: number;

  @Column({ type: "decimal", precision: 14, scale: 2, default: 0 })
  shipping_fee!: number;

  @Column({ type: "decimal", precision: 14, scale: 2 })
  total_amount!: number;

  @Column({ type: "varchar", length: 30, default: "pending" })
  payment_status!: string;

  @Column({ type: "varchar", length: 30, default: "pending" })
  shipping_status!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  tracking_number!: string | null;

  @Column({ type: "timestamptz" })
  payment_deadline!: Date;

  @Column({ type: "varchar", length: 20, default: "none" })
  fund_status!: string;

  @Column({ type: "decimal", precision: 14, scale: 2, nullable: true })
  platform_fee!: string | null;

  @Column({ type: "decimal", precision: 14, scale: 2, nullable: true })
  seller_payout!: string | null;

  @Column({ type: "decimal", precision: 5, scale: 4, nullable: true })
  fee_rate!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  payment_channel!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  delivered_at!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  released_at!: Date | null;

  @Column({ type: "bigint", nullable: true })
  released_by!: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "released_by" })
  released_by_user?: User | null;
}
