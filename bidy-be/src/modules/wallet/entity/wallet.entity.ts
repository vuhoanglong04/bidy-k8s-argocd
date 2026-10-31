import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity.js';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('UQ_wallets_user_id', { unique: true })
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  balance!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'locked';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
