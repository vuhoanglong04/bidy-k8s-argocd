import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Order } from "./order.entity.js";
import { User } from "../../user/entity/user.entity.js";
import { Wallet } from "../../wallet/entity/wallet.entity.js";

@Entity("transactions")
@Index(["orderId"])
@Index(["userId"])
@Index(["walletId"])
export class Transaction {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "order_id", type: "bigint", nullable: true })
  orderId!: string | null;

  @ManyToOne(() => Order, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "order_id" })
  order?: Order | null;

  @Column({ name: "wallet_id", type: "bigint", nullable: true })
  walletId?: string | null;

  @ManyToOne(() => Wallet, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "wallet_id" })
  wallet?: Wallet | null;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "decimal", precision: 14, scale: 2 })
  amount!: number;

  @Column({ name: "payment_method", type: "varchar", length: 50 })
  paymentMethod!: string;

  @Column({
    name: "provider_transaction_id",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  providerTransactionId!: string | null;

  @Column({
    name: "transaction_status",
    type: "varchar",
    length: 30,
    default: "pending",
  })
  transactionStatus!: string;

  @Column({
    name: "transaction_date",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  transactionDate!: Date;
}
