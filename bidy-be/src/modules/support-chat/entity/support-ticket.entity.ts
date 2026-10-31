import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entity/user.entity";
import { SupportMessage } from "./support-message.entity";
import { SupportTicketStatus } from "../enum/support-ticket-status.enum";

@Entity("support_tickets")
@Index(["userId"])
@Index(["adminId"])
@Index(["status"])
// A user has at most one open ticket. Enforced in the database because two concurrent
// starts would otherwise both pass a service-level check and both insert.
@Index("uq_support_tickets_user_open", ["userId"], {
  unique: true,
  where: "status = 'open'",
})
export class SupportTicket {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "admin_id", type: "bigint", nullable: true })
  adminId!: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "admin_id" })
  admin!: User | null;

  @Column({ type: "varchar", length: 255 })
  subject!: string;

  // Kept as a varchar with a CHECK constraint (chk_support_tickets_status) rather than a
  // Postgres enum type: adding a value to a native enum needs a migration that cannot run
  // inside a transaction, and the vocabulary here is expected to grow.
  @Column({ type: "varchar", length: 30, default: SupportTicketStatus.OPEN })
  status!: SupportTicketStatus;

  @OneToMany(() => SupportMessage, (msg) => msg.ticket)
  messages!: SupportMessage[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
