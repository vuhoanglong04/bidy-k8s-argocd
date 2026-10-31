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
  DeleteDateColumn,
} from 'typeorm';
import { File } from '../file/entity/file.entity.js';

@Entity('categories')
@Index(['parentId'])
@Index(['isActive'])
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children!: Category[];

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @Column({ name: 'image_file_id', type: 'bigint', nullable: true })
  imageFileId!: string | null;

  /** Category artwork, presigned on read like every other stored image. */
  @ManyToOne(() => File, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'image_file_id' })
  imageFile?: File | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
