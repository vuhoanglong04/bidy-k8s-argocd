import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "../../modules/user/entity/user.entity"; // Adjust path if needed

@Entity("addresses")
@Index(["userId"])
export class Address extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 255 })
  street!: string;

  @Column({ type: "varchar", length: 100 })
  city!: string;

  @Column({ type: "varchar", length: 100 })
  state!: string;

  @Column({ name: "zip_code", type: "varchar", length: 20, nullable: true })
  zipCode!: string | null;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault!: boolean;
}
