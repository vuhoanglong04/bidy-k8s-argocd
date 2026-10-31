import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Check,
} from "typeorm";
import { BaseEntity } from "../../../common/entity/base.entity";
import { User } from "../../user/entity/user.entity";
import { Order } from "../../order/entity/order.entity";
import { ReviewStatus } from "../enum/review-status.enum.js";

@Entity("reviews")
@Check(`"product_rating" BETWEEN 1 AND 5`)
@Index(["orderId"], { unique: true })
@Index(["revieweeId"])
@Index(["status"])
export class Review extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "order_id", type: "bigint" })
  orderId!: string;

  @OneToOne(() => Order)
  @JoinColumn({ name: "order_id" })
  order!: Order;

  @Column({ name: "reviewer_id", type: "bigint" })
  reviewerId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewer_id" })
  reviewer!: User;

  @Column({ name: "reviewee_id", type: "bigint" })
  revieweeId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewee_id" })
  reviewee!: User;

  @Column({ name: "product_rating", type: "int" })
  productRating!: number;

  @Column({ name: "shipping_rating", type: "int", nullable: true })
  shippingRating!: number | null;

  @Column({ name: "service_rating", type: "int", nullable: true })
  serviceRating!: number | null;

  @Column({ type: "text", nullable: true })
  comment!: string | null;

  @Column({ name: "is_anonymous", type: "boolean", default: false })
  isAnonymous!: boolean;

  @Column({
    type: "varchar",
    length: 20,
    default: ReviewStatus.PUBLISHED,
  })
  status!: ReviewStatus;
}
