import {
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * @openapi
 * components:
 *   schemas:
 *     BaseEntity:
 *       type: object
 *       properties:
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */
export abstract class BaseEntity {
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;
}
