import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Conversation } from "./conversation.entity";
import { User } from "../../user/entity/user.entity"; // Adjust path if needed

@Entity("messages")
@Index(["conversationId", "createdAt"])
export class Message {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "conversation_id", type: "bigint" })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_id" })
  conversation!: Conversation;

  @Column({ name: "sender_id", type: "bigint" })
  senderId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender!: User;

  @Column({ type: "text" })
  content!: string;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}
