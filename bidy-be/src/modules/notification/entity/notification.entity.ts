import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entity/user.entity";
import { NotificationType } from "../enum/notification-type.enum.js";
import { NotificationCategory } from "../enum/notification-category.enum.js";
import { NotificationPriority } from "../enum/notification-priority.enum.js";

@Entity("notifications")
@Index(["recipientId"])
@Index(["isRead"])
export class Notification {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "recipient_id", type: "bigint" })
  recipientId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipient_id" })
  recipient!: User;

  @Column({ name: "actor_id", type: "bigint", nullable: true })
  actorId!: string | null;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "actor_id" })
  actor!: User | null;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "varchar", length: 50 })
  type!: NotificationType;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({ type: "varchar", length: 50, nullable: true })
  category!: NotificationCategory | null;

  @Column({ type: "varchar", length: 20, default: "normal" })
  priority!: NotificationPriority;

  @Column({ type: "varchar", length: 255, nullable: true })
  actionUrl!: string | null;

  @Column({ type: "jsonb", nullable: true })
  relatedData!: Record<string, unknown> | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
