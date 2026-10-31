import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity.js';
import { User } from '../../user/entity/user.entity.js';
import { File } from '../../file/entity/file.entity.js';

@Entity('wallet_withdrawal_requests')
@Index('IDX_wallet_withdrawal_requests_wallet_id', ['walletId'])
@Index('IDX_wallet_withdrawal_requests_user_id', ['userId'])
@Index('IDX_wallet_withdrawal_requests_status', ['status'])
@Index('IDX_wallet_withdrawal_requests_deadline_at', ['deadlineAt'])
export class WalletWithdrawalRequest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'wallet_id', type: 'bigint' })
  walletId!: string;

  @ManyToOne(() => Wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ name: 'bank_account_no', type: 'varchar', length: 50 })
  bankAccountNo!: string;

  @Column({ name: 'bank_account_name', type: 'varchar', length: 255 })
  bankAccountName!: string;

  @Column({ name: 'bank_code', type: 'varchar', length: 20 })
  bankCode!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

  @Column({ name: 'cancelled_by', type: 'varchar', length: 20, nullable: true })
  cancelledBy?: 'user' | 'admin' | null;

  @Column({ name: 'deadline_at', type: 'timestamptz' })
  deadlineAt!: Date;

  @Column({ name: 'admin_id', type: 'bigint', nullable: true })
  adminId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'admin_id' })
  admin?: User | null;

  @Column({ name: 'proof_file_id', type: 'bigint', nullable: true })
  proofFileId?: string | null;

  @ManyToOne(() => File, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'proof_file_id' })
  proofFile?: File | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason?: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
