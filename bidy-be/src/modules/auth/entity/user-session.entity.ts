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

@Entity('user_sessions')
@Index('idx_user_session_user_id', ['userId'])
@Index('idx_user_session_expires_at', ['expiresAt'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255 })
  refreshTokenHash!: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 1024, nullable: true })
  userAgent?: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
