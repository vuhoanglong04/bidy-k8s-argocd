import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('wallet_daily_summary')
export class WalletDailySummary {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('UQ_wallet_daily_summary_summary_date', { unique: true })
  @Column({ name: 'summary_date', type: 'date', unique: true })
  summaryDate!: string;

  @Column({ name: 'total_topup', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalTopup!: string;

  @Column({ name: 'total_payment', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalPayment!: string;

  @Column({ name: 'total_withdraw', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalWithdraw!: string;

  @Column({ name: 'total_platform_fee', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  totalPlatformFee!: string;

  @Column({ name: 'active_wallets', type: 'int', default: 0 })
  activeWallets!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
