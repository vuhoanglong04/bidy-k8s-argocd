import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * One row per object stored in R2.
 *
 * The object key is the only thing persisted — never a URL. R2 URLs are minted on
 * read via presigning, so the bucket stays private and a link can never outlive
 * its signature. Anything that used to hold `*_url` now holds a `file_id`.
 */
@Entity('files')
export class File {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  /** Object key inside BUCKET_NAME. Unique so the same object is never registered twice. */
  @Index('uq_files_s3_key', { unique: true })
  @Column({ name: 's3_key', type: 'varchar', length: 512 })
  s3Key!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 127 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  /** Who uploaded it. Kept for auditing; nulled rather than cascaded when the user goes. */
  @Column({ name: 'uploaded_by', type: 'bigint', nullable: true })
  uploadedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
