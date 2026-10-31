import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entity/user.entity";
import { SupportTicket } from "./support-ticket.entity";

@Entity("support_messages")
@Index(["ticketId"])
export class SupportMessage {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "ticket_id", type: "bigint" })
  ticketId!: string;

  @ManyToOne(() => SupportTicket, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ticket_id" })
  ticket!: SupportTicket;

  @Column({ name: "sender_id", type: "bigint" })
  senderId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender!: User;

  @Column({ type: "text" })
  content!: string;

  @Column({
    name: "message_type",
    type: "varchar",
    length: 20,
    default: "text",
  })
  messageType!: string;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  /** Payload for non-text messages, keyed by messageType. */
  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
