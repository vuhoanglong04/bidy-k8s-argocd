import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "../../../common/entity/base.entity";
import { User } from "../../user/entity/user.entity";
import { Review } from "./review.entity";

@Entity("review_replies")
@Index(["reviewId"], { unique: true })
export class ReviewReply extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "review_id", type: "bigint" })
  reviewId!: string;

  @OneToOne(() => Review, { onDelete: "CASCADE" })
  @JoinColumn({ name: "review_id" })
  review!: Review;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text" })
  comment!: string;
}
