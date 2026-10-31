import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from "typeorm";
import { Conversation } from "./conversation.entity";
import { User } from "../../user/entity/user.entity"; // Adjust path if needed

@Entity("conversation_members")
@Index(["conversationId", "userId"], { unique: true })
@Index(["userId"])
export class ConversationMember {
  @PrimaryColumn({ name: "conversation_id", type: "bigint" })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_id" })
  conversation!: Conversation;

  @PrimaryColumn({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    name: "joined_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  joinedAt!: Date;
}
