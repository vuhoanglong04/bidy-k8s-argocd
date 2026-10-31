import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Review } from "./review.entity";
import { File } from "../../file/entity/file.entity.js";

@Entity("review_media")
@Index(["reviewId"])
export class ReviewMedia {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "review_id", type: "bigint" })
  reviewId!: string;

  @ManyToOne(() => Review, { onDelete: "CASCADE" })
  @JoinColumn({ name: "review_id" })
  review!: Review;

  @Column({ name: "file_id", type: "bigint" })
  fileId!: string;

  /** The uploaded media object; presigned on read via FileService. */
  @ManyToOne(() => File, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "file_id" })
  file!: File;

  @Column({
    name: "media_type",
    type: "varchar",
    length: 20,
    default: "image",
  })
  mediaType!: string;

  @Column({ name: "display_order", type: "int", default: 0 })
  displayOrder!: number;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
