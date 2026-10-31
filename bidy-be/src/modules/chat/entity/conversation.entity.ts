import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { ConversationMember } from "./conversation-member.entity";

@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @OneToMany(() => ConversationMember, (member) => member.conversation)
  members!: ConversationMember[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
