import { AppDataSource } from '../../database/data-source';
import { logger } from '../../common/util/logger.js';
import { fileService } from '../file/file.provider.js';
import { User } from '../user/entity/user.entity';
import { AdminAuditLog } from './entity/admin-audit-log.entity';
import { UserSession } from '../auth/entity/user-session.entity';
import { UserStatus, UserRole } from '../user/enum/user.enum';
import {
  SearchUserDTO,
  UpdateUserProfileDTO,
  ChangeRoleDTO,
  SuspendUserDTO,
  BanUserDTO
} from './dtos/admin-user.dto';
import { IsNull, LessThanOrEqual } from 'typeorm';
import { revokeAllSessions } from '../auth/auth.service.js';
import { deactivateUserAutoBids } from '../auction/auction.service.js';
import { notificationService } from '../notification/notification.service.js';
import { NotificationType } from '../notification/enum/notification-type.enum.js';
import { NotificationCategory } from '../notification/enum/notification-category.enum.js';
import { NotificationPriority } from '../notification/enum/notification-priority.enum.js';

/**
 * Every User column the admin screens read, statusReason included.
 *
 * statusReason is `select: false` on the entity so it cannot ride along on the
 * User relations other modules join. TypeORM's find-options `select` is an
 * allowlist and there is no per-find addSelect, so opting the column back in means
 * naming the whole set — hence one constant instead of the same list at nine call
 * sites. passwordHash is deliberately absent: nothing here needs it.
 *
 * These paths read statusReason to record oldValues in the audit log, so dropping
 * it would quietly blank out the previous ban reason on every admin action.
 */
const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  fullname: true,
  phone: true,
  email: true,
  role: true,
  status: true,
  statusReason: true,
  accountLocked: true,
  lockedUntil: true,
  suspendedUntil: true,
  passwordResetRequired: true,
  avatarFileId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserCursor = {
  createdAt: string;
  id: string;
};

export class AdminUserService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly auditLogRepository = AppDataSource.getRepository(AdminAuditLog);

  public async getUsers(dto: SearchUserDTO) {
    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 100);
    const page = Math.max(dto.page ?? 1, 1);
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.statusReason')
      .leftJoinAndSelect('user.avatarFile', 'avatarFile');

    if (dto.q) {
      const q = dto.q.trim();

      if (q) {
        queryBuilder.andWhere(
          '(user.username ILIKE :q OR user.email ILIKE :q OR CAST(user.id AS TEXT) = :exactQ)',
          {
            q: `%${q}%`,
            exactQ: q
          }
        );
      }
    }

    if (dto.status) {
      queryBuilder.andWhere('user.status = :status', {
        status: dto.status
      });
    }

    if (dto.role) {
      queryBuilder.andWhere('user.role = :role', {
        role: dto.role
      });
    }

    if (dto.locked !== undefined) {
      queryBuilder.andWhere('user.accountLocked = :locked', {
        locked: dto.locked
      });
    }

    if (dto.created_from) {
      const createdFrom = new Date(dto.created_from);

      if (Number.isNaN(createdFrom.getTime())) {
        throw new TypeError('INVALID_CREATED_FROM');
      }

      queryBuilder.andWhere('user.createdAt >= :from', {
        from: createdFrom
      });
    }

    const isAscending = dto.sort === 'created_at';
    const sortDirection: 'ASC' | 'DESC' = isAscending ? 'ASC' : 'DESC';

    queryBuilder
      .orderBy('user.createdAt', sortDirection)
      .addOrderBy('user.id', sortDirection);

    if (dto.cursor) {
      const cursor = this.decodeCursor(dto.cursor);
      const cursorCreatedAt = new Date(cursor.createdAt);

      if (Number.isNaN(cursorCreatedAt.getTime())) {
        throw new TypeError('INVALID_CURSOR');
      }

      const comparison = isAscending ? '>' : '<';

      queryBuilder.andWhere(
        `(user.createdAt ${comparison} :createdAt OR (user.createdAt = :createdAt AND user.id ${comparison} :id))`,
        {
          createdAt: cursorCreatedAt,
          id: cursor.id
        }
      );
    } else {
      queryBuilder.skip((page - 1) * limit);
    }

    // Fetch one extra record so hasNext is accurate.
    queryBuilder.take(limit + 1);

    const fetchedUsers = await queryBuilder.getMany();
    const hasNext = fetchedUsers.length > limit;
    const users = hasNext ? fetchedUsers.slice(0, limit) : fetchedUsers;

    let nextCursor: string | null = null;

    if (hasNext) {
      const lastUser = users[users.length - 1]!;

      nextCursor = this.encodeCursor({
        createdAt: lastUser.createdAt.toISOString(),
        id: lastUser.id
      });
    }

    return {
      data: await Promise.all(users.map((user) => this.mapToUserResponse(user))),
      pagination: {
        nextCursor,
        hasNext,
        limit
      }
    };
  }

  public async getUserDetail(id: string) {
    const user = await this.userRepository.findOne({
      select: ADMIN_USER_SELECT,
      where: { id }
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // TODO: Replace these placeholders with real aggregate queries.
    const summary = {
      products: 0,
      auctions: 0,
      ordersAsBuyer: 0,
      ordersAsSeller: 0,
      reviews: 0,
      supportTickets: 0
    };

    return {
      data: {
        ...(await this.mapToUserResponse(user)),
        summary
      }
    };
  }

  public async updateProfile(
    adminId: string,
    targetId: string,
    dto: UpdateUserProfileDTO
  ) {
    return AppDataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);

      const user = await userRepository.findOne({
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const oldValues = {
        username: user.username,
        email: user.email,
        fullname: user.fullname
      };

      if (dto.email !== undefined && dto.email !== user.email) {
        const exists = await userRepository.findOne({
          where: { email: dto.email }
        });

        if (exists && exists.id !== targetId) {
          throw new Error('EMAIL_ALREADY_EXISTS');
        }

        user.email = dto.email;
      }

      if (dto.username !== undefined && dto.username !== user.username) {
        const exists = await userRepository.findOne({
          where: { username: dto.username }
        });

        if (exists && exists.id !== targetId) {
          throw new Error('USERNAME_ALREADY_EXISTS');
        }

        user.username = dto.username;
      }

      if (dto.fullname !== undefined) {
        user.fullname = dto.fullname;
      }

      await manager.save(User, user);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'UPDATE_PROFILE',
        oldValues,
        newValues: {
          username: user.username,
          email: user.email,
          fullname: user.fullname
        }
      });

      return {
        data: await this.mapToUserResponse(user)
      };
    });
  }

  public async changeRole(
    adminId: string,
    targetId: string,
    dto: ChangeRoleDTO
  ) {
    return AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Prevent removing the final active admin, regardless of who performs the action.
      if (
        user.role === UserRole.ADMIN &&
        dto.role !== UserRole.ADMIN &&
        user.status === UserStatus.ACTIVE
      ) {
        const activeAdminCount = await manager.count(User, {
          where: {
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE
          }
        });

        if (activeAdminCount <= 1) {
          throw new Error('CANNOT_DEMOTE_LAST_ADMIN');
        }
      }

      const oldValues = {
        role: user.role
      };

      user.role = dto.role;

      await manager.save(User, user);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'CHANGE_ROLE',
        reason: dto.reason,
        oldValues,
        newValues: {
          role: user.role
        }
      });

      return {
        data: await this.mapToUserResponse(user)
      };
    });
  }

  public async suspendUser(
    adminId: string,
    targetId: string,
    dto: SuspendUserDTO
  ) {
    if (adminId === targetId) {
      throw new Error('ADMIN_CANNOT_SUSPEND_SELF');
    }

    // Parsed before the transaction so the notification sent after it commits can
    // still tell the user when the suspension ends. Depends on dto only, so nothing
    // is gained by holding the row lock while doing it.
    let suspendedUntil: Date | null = null;

    if (dto.until) {
      suspendedUntil = new Date(dto.until);

      if (Number.isNaN(suspendedUntil.getTime())) {
        throw new TypeError('INVALID_SUSPEND_UNTIL');
      }
    }

    const result = await AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.status === UserStatus.BANNED) {
        throw new Error('USER_ALREADY_BANNED');
      }

      const oldValues = {
        status: user.status,
        statusReason: user.statusReason,
        suspendedUntil: user.suspendedUntil
      };

      user.status = UserStatus.SUSPENDED;
      user.statusReason = dto.reason;

      // Object.assign is intentional here so nullable DB fields can be set to NULL
      // even if the entity currently types them as optional instead of `T | null`.
      Object.assign(user, {
        suspendedUntil
      });

      await manager.save(User, user);

      await manager.update(
        UserSession,
        {
          userId: targetId,
          revokedAt: IsNull()
        },
        {
          revokedAt: new Date()
        }
      );

      // The row above is a record, not an eviction: no read path consults
      // user_sessions, so the session that actually keeps the user signed in lives in
      // Redis. Without this the ban only blocked a fresh login — anyone already
      // logged in kept refreshing a 7-day token and went on bidding. Inside the
      // transaction on purpose: if Redis is unreachable the ban rolls back rather
      // than committing a ban that does not end the session.
      await revokeAllSessions(targetId, 'ACCOUNT_NOT_AVAILABLE');

      // Ending the session is not enough: proxy bids are resolved server-side, so an
      // armed auto-bid would keep bidding — and winning — for a user who is no longer
      // allowed to buy anything.
      await deactivateUserAutoBids(manager, targetId);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'SUSPEND_USER',
        reason: dto.reason,
        oldValues,
        newValues: {
          status: user.status,
          statusReason: user.statusReason,
          suspendedUntil: user.suspendedUntil
        }
      });

      return {
        data: await this.mapToUserResponse(user)
      };
    });

    await this.notifyAccountAction(
      targetId,
      NotificationType.ACCOUNT_SUSPENDED,
      dto.reason,
      suspendedUntil,
    );

    return result;
  }

  /**
   * Lifts suspensions whose `suspendedUntil` has passed.
   *
   * suspendUser writes the deadline but nothing ever read it back, so a "7-day
   * suspension" was really permanent: the account stayed SUSPENDED — and therefore
   * unable to log in or refresh — until an admin happened to activate it by hand.
   *
   * Only timed suspensions are touched. A suspension with no `suspendedUntil` is
   * open-ended by design and stays until an admin lifts it, and BANNED is never
   * time-limited, so neither is swept up here.
   *
   * No AdminAuditLog row: `admin_id` is NOT NULL with a foreign key to users, and
   * inventing an admin for a change no admin made would corrupt the trail this
   * table exists to keep. The lift is recorded in the logs and announced to the user
   * instead.
   */
  public async liftExpiredSuspensions() {
    const now = new Date();

    const expired = await this.userRepository.find({
      select: { id: true },
      where: {
        status: UserStatus.SUSPENDED,
        suspendedUntil: LessThanOrEqual(now),
      },
    });

    if (expired.length === 0) {
      return { lifted: 0 };
    }

    let lifted = 0;

    for (const { id } of expired) {
      // One transaction per user: the row lock is what stops this racing an admin
      // who is banning the same account at that moment, and a single failure must
      // not strand the rest of the batch.
      const wasLifted = await AppDataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          select: ADMIN_USER_SELECT,
          where: { id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });

        // Re-checked under the lock: an admin may have banned or already activated
        // this account between the scan above and the lock below.
        if (!user || user.status !== UserStatus.SUSPENDED) return false;
        if (!user.suspendedUntil || user.suspendedUntil > now) return false;

        user.status = UserStatus.ACTIVE;

        // TypeORM skips undefined values on save. Use null to actually clear DB columns.
        Object.assign(user, {
          statusReason: null,
          suspendedUntil: null,
        });

        await manager.save(User, user);
        return true;
      });

      if (!wasLifted) continue;
      lifted++;

      try {
        await notificationService.createNotification({
          recipient: id,
          type: NotificationType.ACCOUNT_UNLOCKED,
          title: 'Tài khoản đã được mở khóa',
          message: '✅ Thời gian tạm khóa đã kết thúc. Tài khoản của bạn đã hoạt động trở lại.',
          category: NotificationCategory.ACCOUNT,
          priority: NotificationPriority.NORMAL,
        });
      } catch (error: any) {
        // The account is already active; failing to announce it must not undo that.
        logger.error('[AdminUser] Suspension lifted but not announced', error?.message);
      }
    }

    if (lifted > 0) {
      logger.info('[AdminUser] Lifted expired suspensions', { lifted });
    }

    return { lifted };
  }

  public async activateUser(adminId: string, targetId: string) {
    return AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const oldValues = {
        status: user.status,
        statusReason: user.statusReason,
        suspendedUntil: user.suspendedUntil
      };

      user.status = UserStatus.ACTIVE;

      // TypeORM skips undefined values on save. Use null to actually clear DB columns.
      Object.assign(user, {
        statusReason: null,
        suspendedUntil: null
      });

      await manager.save(User, user);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'ACTIVATE_USER',
        oldValues,
        newValues: {
          status: user.status,
          statusReason: user.statusReason,
          suspendedUntil: user.suspendedUntil
        }
      });

      return {
        data: await this.mapToUserResponse(user)
      };
    });
  }

  public async banUser(
    adminId: string,
    targetId: string,
    dto: BanUserDTO
  ) {
    if (adminId === targetId) {
      throw new Error('ADMIN_CANNOT_BAN_SELF');
    }

    const result = await AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Idempotent behavior.
      if (user.status === UserStatus.BANNED) {
        return {
          data: await this.mapToUserResponse(user)
        };
      }

      const oldValues = {
        status: user.status,
        statusReason: user.statusReason,
        suspendedUntil: user.suspendedUntil
      };

      user.status = UserStatus.BANNED;
      user.statusReason = dto.reason;

      // A banned user should not keep a stale suspension timestamp.
      Object.assign(user, {
        suspendedUntil: null
      });

      await manager.save(User, user);

      await manager.update(
        UserSession,
        {
          userId: targetId,
          revokedAt: IsNull()
        },
        {
          revokedAt: new Date()
        }
      );

      // The row above is a record, not an eviction: no read path consults
      // user_sessions, so the session that actually keeps the user signed in lives in
      // Redis. Without this the ban only blocked a fresh login — anyone already
      // logged in kept refreshing a 7-day token and went on bidding. Inside the
      // transaction on purpose: if Redis is unreachable the ban rolls back rather
      // than committing a ban that does not end the session.
      await revokeAllSessions(targetId, 'ACCOUNT_NOT_AVAILABLE');

      // Ending the session is not enough: proxy bids are resolved server-side, so an
      // armed auto-bid would keep bidding — and winning — for a user who is no longer
      // allowed to buy anything.
      await deactivateUserAutoBids(manager, targetId);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'BAN_USER',
        reason: dto.reason,
        oldValues,
        newValues: {
          status: user.status,
          statusReason: user.statusReason,
          suspendedUntil: user.suspendedUntil
        }
      });

      return {
        data: await this.mapToUserResponse(user)
      };
    });

    await this.notifyAccountAction(targetId, NotificationType.ACCOUNT_BANNED, dto.reason);

    return result;
  }

  public async unlockUser(adminId: string, targetId: string) {
    return AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const oldValues = {
        accountLocked: user.accountLocked,
        lockedUntil: user.lockedUntil
      };

      user.accountLocked = false;

      // Use null so TypeORM persists the cleared value.
      Object.assign(user, {
        lockedUntil: null
      });

      await manager.save(User, user);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'UNLOCK_USER',
        oldValues,
        newValues: {
          accountLocked: user.accountLocked,
          lockedUntil: user.lockedUntil
        }
      });

      return {
        data: await this.mapToUserResponse(user)
      };
    });
  }

  public async revokeSessions(adminId: string, targetId: string) {
    return AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_read' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const result = await manager.update(
        UserSession,
        {
          userId: targetId,
          revokedAt: IsNull()
        },
        {
          revokedAt: new Date()
        }
      );

      // See the note on the ban path: revokedSessions above counts rows nobody
      // reads, and only this ends the session the user is actually holding.
      await revokeAllSessions(targetId);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'REVOKE_SESSIONS',
        newValues: {
          revokedSessions: result.affected ?? 0
        }
      });

      return {
        message: 'Sessions revoked successfully'
      };
    });
  }

  public async forcePasswordReset(adminId: string, targetId: string) {
    return AppDataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        select: ADMIN_USER_SELECT,
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
        // Eager relations become a LEFT JOIN, and Postgres rejects FOR UPDATE on the
        // nullable side of an outer join. The lock read only needs the user row.
        loadEagerRelations: false
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const oldValues = {
        passwordResetRequired: user.passwordResetRequired
      };

      user.passwordResetRequired = true;

      await manager.save(User, user);

      const result = await manager.update(
        UserSession,
        {
          userId: targetId,
          revokedAt: IsNull()
        },
        {
          revokedAt: new Date()
        }
      );

      // See the note on the ban path: revokedSessions above counts rows nobody
      // reads, and only this ends the session the user is actually holding.
      await revokeAllSessions(targetId);

      await manager.save(AdminAuditLog, {
        adminId,
        targetUserId: targetId,
        action: 'FORCE_PASSWORD_RESET',
        oldValues,
        newValues: {
          passwordResetRequired: true,
          revokedSessions: result.affected ?? 0
        }
      });

      return {
        message: 'Password reset required and sessions revoked'
      };
    });
  }

  public async getAuditLogs(targetId: string, limit: number = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const logs = await this.auditLogRepository.find({
      where: {
        targetUserId: targetId
      },
      order: {
        createdAt: 'DESC'
      },
      take: safeLimit,
      relations: {
        admin: true
      }
    });

    return {
      data: logs.map((log) => ({
        id: log.id,
        adminId: log.adminId,
        adminUsername: log.admin?.username,
        action: log.action,
        reason: log.reason,
        oldValues: log.oldValues,
        newValues: log.newValues,
        createdAt: log.createdAt
      }))
    };
  }

  private encodeCursor(cursor: UserCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
  }

  private decodeCursor(cursor: string): UserCursor {
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8')
      ) as Partial<UserCursor>;

      if (
        typeof decoded.createdAt !== 'string' ||
        typeof decoded.id !== 'string' ||
        !decoded.createdAt ||
        !decoded.id
      ) {
        throw new Error('INVALID_CURSOR');
      }

      return {
        createdAt: decoded.createdAt,
        id: decoded.id
      };
    } catch {
      throw new Error('INVALID_CURSOR');
    }
  }

  /**
   * Tells a user their account was suspended or banned, and why.
   *
   * Sent after the transaction commits, never inside it: notifications are written
   * through their own repository, so a rollback would leave the user holding a
   * notice of a ban that never happened.
   *
   * The reason is the admin's own wording from the request, not the statusReason
   * column — that column is `select: false` precisely so it does not travel, and the
   * subject of a ban is the one person entitled to read the justification anyway.
   *
   * ponytail: a banned user cannot log in, so this is only readable if the account is
   * reactivated later — it is the record they see on their return, not a live alert.
   * Reaching them while banned needs email, which is a separate channel.
   */
  private async notifyAccountAction(
    targetId: string,
    type: NotificationType.ACCOUNT_SUSPENDED | NotificationType.ACCOUNT_BANNED,
    reason: string,
    suspendedUntil?: Date | null,
  ) {
    const suspended = type === NotificationType.ACCOUNT_SUSPENDED;

    try {
      await notificationService.createNotification({
        recipient: targetId,
        type,
        title: suspended ? 'Tài khoản đã bị tạm khóa' : 'Tài khoản đã bị khóa vĩnh viễn',
        message: suspended
          ? `Tài khoản của bạn đã bị tạm khóa. Lý do: ${reason}`
          : `Tài khoản của bạn đã bị khóa vĩnh viễn. Lý do: ${reason}`,
        category: NotificationCategory.ACCOUNT,
        priority: NotificationPriority.HIGH,
        relatedData: { reason, suspendedUntil: suspendedUntil ?? null },
      });
    } catch (error: any) {
      // The account action itself already committed; failing to announce it must not
      // turn a successful ban into an error the admin retries.
      logger.error('[AdminUser] Account action notification failed', error?.message);
    }
  }

  /** `avatarUrl` is signed per response — the bucket is private and nothing stores URLs. */
  private async mapToUserResponse(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      status: user.status,
      statusReason: user.statusReason,
      suspendedUntil: user.suspendedUntil,
      accountLocked: user.accountLocked,
      lockedUntil: user.lockedUntil,
      passwordResetRequired: user.passwordResetRequired,
      avatarFileId: user.avatarFileId ?? null,
      // Mutation paths lock the row with eager relations off, so `avatarFile` is
      // only populated on the read paths; fall back to loading it by id there.
      avatarUrl: await fileService.urlOf(
        user.avatarFile ?? (user.avatarFileId ? await fileService.findById(user.avatarFileId) : null),
      ),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
