import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity.js';

@Entity('admin_audit_logs')
@Index('idx_audit_admin_id', ['adminId'])
@Index('idx_audit_target_user_id', ['targetUserId'])
@Index('idx_audit_action', ['action'])
@Index('idx_audit_created_at', ['createdAt'])
@Index('idx_audit_target_user_created', ['targetUserId', 'createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'admin_id', type: 'bigint' })
  adminId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'admin_id' })
  admin!: User;

  @Column({ name: 'target_user_id', type: 'bigint', nullable: true })
  targetUserId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser?: User;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: any;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 1024, nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
