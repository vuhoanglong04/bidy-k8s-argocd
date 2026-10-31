import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    BaseEntity,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '../enum/user.enum.js';
import { File } from '../../file/entity/file.entity.js';

@Entity({ name: 'users' })
@Index('IDX_users_email', ['email'])
@Index('IDX_users_username', ['username'])
@Index('IDX_users_status', ['status'])
export class User extends BaseEntity {
    @PrimaryGeneratedColumn({
        type: 'bigint',
    })
    id!: string;

    @Column({
        type: 'varchar',
        length: 50,
    })
    username!: string;

    @Column({
        name: 'full_name',
        type: 'varchar',
        length: 200,
    })
    fullname!: string;

    @Column({
        name: 'phone',
        type: 'varchar',
        length: 15,
        unique: true,
        nullable: true,
    })
    phone?: string;

    @Column({
        type: 'varchar',
        length: 255,
        unique: true,
    })
    email!: string;

    // Never loaded by default: any query that pulls a User relation (support tickets, chat
    // members, ...) would otherwise serialise the hash straight into an API response.
    // The two sites that genuinely need it opt in with `addSelect('user.passwordHash')`.
    @Column({
        name: 'password_hash',
        type: 'varchar',
        length: 255,
        select: false,
    })
    passwordHash!: string;

    @Column({
        type: 'varchar',
        length: 20,
        default: UserRole.USER,
    })
    role!: UserRole;

    @Column({
        type: 'varchar',
        length: 20,
        default: UserStatus.ACTIVE,
    })
    status!: UserStatus;

    @Column({
        name: 'account_locked',
        type: 'boolean',
        default: false,
    })
    accountLocked!: boolean;

    @Column({ name: 'avatar_file_id', type: 'bigint', nullable: true })
    avatarFileId?: string | null;

    /**
     * Avatar object in R2. Read paths presign it through FileService.
     *
     * Eager because a dozen call sites load a User purely to render one, and a
     * missed `relations` entry fails silently as a null avatar rather than an
     * error. QueryBuilder ignores eager, so those sites join it explicitly.
     */
    @ManyToOne(() => File, { nullable: true, onDelete: 'SET NULL', eager: true })
    @JoinColumn({ name: 'avatar_file_id' })
    avatarFile?: File | null;

    @Column({
        name: 'locked_until',
        type: 'timestamptz',
        nullable: true,
    })
    lockedUntil?: Date;

    @Column({
        name: 'suspended_until',
        type: 'timestamptz',
        nullable: true,
    })
    suspendedUntil?: Date;

    // Never loaded by default, for the same reason as passwordHash: this is the
    // admin's written justification for banning or suspending someone, and every
    // module that joins a User relation (notifications, chat, bids) would otherwise
    // serialise it to whoever is on the other end. Only AdminUserService needs it,
    // and it opts in through ADMIN_USER_SELECT.
    @Column({
        name: 'status_reason',
        type: 'varchar',
        length: 500,
        nullable: true,
        select: false,
    })
    statusReason?: string;

    @Column({
        name: 'password_reset_required',
        type: 'boolean',
        default: false,
    })
    passwordResetRequired!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}