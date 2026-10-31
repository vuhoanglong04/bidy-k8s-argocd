import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity.js';
import { Category } from '../../category/category.entity.js';
import { ProductImage } from './product-image.entity.js';
import { ProductCondition } from '../enums/product-condition.enum.js';
import { ProductStatus } from '../enums/product-status.enum.js';

@Entity('products')
@Index(['ownerId'])
@Index(['categoryId'])
@Index(['status'])
@Index('idx_products_category_status_created', ['categoryId', 'status', 'createdAt'])
@Index('idx_products_owner_status_created', ['ownerId', 'status', 'createdAt'])
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'owner_id', type: 'bigint' })
  ownerId!: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'category_id', type: 'bigint' })
  categoryId!: string;

  @ManyToOne(() => Category, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 300 })
  slug!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 50 })
  condition!: ProductCondition;

  @Column({
    type: 'varchar',
    length: 30,
    default: ProductStatus.DRAFT,
  })
  status!: ProductStatus;

  @OneToMany(() => ProductImage, (image) => image.product)
  images!: ProductImage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
