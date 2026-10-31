import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity.js';

@Entity('wallet_ledger')
@Index('IDX_wallet_ledger_wallet_id', ['walletId'])
@Index('IDX_wallet_ledger_reference', ['referenceType', 'referenceId'])
@Index('IDX_wallet_ledger_wallet_id_created_at', ['walletId', 'createdAt'])
export class WalletLedger {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'wallet_id', type: 'bigint' })
  walletId!: string;

  @ManyToOne(() => Wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id' })
  wallet!: Wallet;

  @Column({ type: 'varchar', length: 30 })
  type!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 14, scale: 2 })
  balanceAfter!: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 30, nullable: true })
  referenceType?: string | null;

  @Column({ name: 'reference_id', type: 'bigint', nullable: true })
  referenceId?: string | null;

  @Index('UQ_wallet_ledger_idempotency_key', { unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
