import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';
import { File } from '../../file/entity/file.entity.js';

@Entity('product_images')
@Index('uq_product_primary_image', ['product'], { unique: true, where: 'is_primary = TRUE' })
@Index('uq_product_image_order', ['product', 'displayOrder'], { unique: true })
@Index('uq_product_images_file', ['file'], { unique: true })
export class ProductImage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'product_id', type: 'bigint' })
  productId!: string;

  @ManyToOne(() => Product, (product) => product.images, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'file_id', type: 'bigint' })
  fileId!: string;

  /** The stored object. A URL is minted per read via FileService — never persisted. */
  @ManyToOne(() => File, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'file_id' })
  file!: File;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
