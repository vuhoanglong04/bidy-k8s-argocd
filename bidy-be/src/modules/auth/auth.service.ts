import { Repository, EntityManager } from 'typeorm';
import { Wallet } from '../wallet/entity/wallet.entity.js';
import { fileService } from '../file/file.provider.js';
import { LoginDto, RegisterDto, LoginResponseDto } from './dtos/auth.dto';
import { User } from '../user/entity/user.entity';
import { UserStatus, UserRole } from '../user/enum/user.enum';
import { BcryptService } from './bcrypt.service';
import { AUTH_MESSAGE } from '../../common/messages/auth/auth.message';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'crypto';
import redis from '../../common/redis/redis.client';
import webSocketService from '../common/websocket.service.js';
import { sendVerifyEmail, sendResetPasswordEmail } from '../../common/mail/mail.service';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
    JWT_SECRET: Joi.string().required(),
    JWT_REFRESH_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
    JWT_REFRESH_TTL_SECONDS: Joi.number().default(604800),
    JWT_REFRESH_GRACE_SECONDS: Joi.number().default(30),
    VERIFY_TOKEN_TTL_SECONDS: Joi.number().default(900),
    RESET_TOKEN_TTL_SECONDS: Joi.number().default(900),
    CLIENT_URL: Joi.string().default('http://localhost:3000'),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const REFRESH_TOKEN_TTL = envVars.JWT_REFRESH_TTL_SECONDS;
const REFRESH_GRACE_TTL = envVars.JWT_REFRESH_GRACE_SECONDS;
const VERIFY_TOKEN_TTL = envVars.VERIFY_TOKEN_TTL_SECONDS;
const RESET_TOKEN_TTL = envVars.RESET_TOKEN_TTL_SECONDS;

const refreshKey = (userId: string, deviceId: string) => `refresh:${userId}:${deviceId}`;
/** Holds the immediately-previous refresh hash for REFRESH_GRACE_TTL seconds. */
const graceKey = (userId: string, deviceId: string) => `refresh:${userId}:${deviceId}:grace`;
const sessionKey = (userId: string) => `sessions:${userId}`;
const verifyKey = (userId: string) => `verify:${userId}`;
const resetKey = (userId: string) => `reset:${userId}`;

/**
 * Ends every session a user has, on every device.
 *
 * Sessions live in Redis under `refresh:{userId}:{deviceId}` — the `user_sessions`
 * table is not consulted by any read path — so revoking anywhere else has no
 * effect on whether the user can still refresh. Exported as a plain function
 * because the admin ban/suspend paths must call it and have no AuthService: they
 * need neither a user repository nor bcrypt to end a session.
 */
export const revokeAllSessions = async (userId: string, reason = 'SESSION_REVOKED'): Promise<void> => {
    const sKey = sessionKey(userId);
    const deviceIds = await redis.smembers(sKey);

    if (deviceIds.length === 0) {
        // No refresh token left to delete, but a socket opened earlier can still be
        // connected — dropping it is the whole point of the call.
        await webSocketService.disconnectUser(userId, reason);
        return;
    }

    const pipeline = redis.pipeline();
    for (const deviceId of deviceIds) {
        pipeline.del(refreshKey(userId, deviceId));
        pipeline.del(graceKey(userId, deviceId));
    }
    pipeline.del(sKey);
    await pipeline.exec();

    // A live socket outlives the token that opened it: identity is read once at the
    // handshake, so without this the user keeps their rooms and keeps receiving
    // auction traffic until they happen to disconnect.
    await webSocketService.disconnectUser(userId, reason);
};

export class AuthService {
    constructor(
        private readonly userRepository: Repository<User>,
        private readonly bcryptService: BcryptService,
    ) { }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    private issueAccessToken(user: User): string {
        const payload = {
            idUser: user.id,
            email: user.email,
            role: user.role,
        };
        return jwt.sign(
            payload,
            envVars.JWT_SECRET,
            {
                algorithm: 'HS256',
                expiresIn: envVars.JWT_EXPIRES_IN,
                issuer: 'bidy-api',
                audience: 'bidy-client'
            },
        );
    }

    private issueRefreshToken(user: User, deviceId: string): string {
        return jwt.sign(
            { idUser: user.id, deviceId },
            envVars.JWT_REFRESH_SECRET,
            {
                algorithm: 'HS256',
                expiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
                issuer: 'bidy-api',
                audience: 'bidy-client'
            },
        );
    }

    private buildVerifyUrl(userId: string, token: string): string {
        return `${envVars.CLIENT_URL}/verify-email?userId=${userId}&token=${token}`;
    }

    private buildResetUrl(userId: string, token: string): string {
        return `${envVars.CLIENT_URL}/reset-password?userId=${userId}&token=${token}`;
    }

    async register(registerDto: RegisterDto): Promise<{ message: string }> {
        const { email, password, fullName, phone, userName } = registerDto;

        const user = new User();
        user.email = email.trim().toLowerCase();
        user.passwordHash = await this.bcryptService.hash(password);
        user.status = UserStatus.INACTIVE;
        user.role = UserRole.USER;
        user.fullname = fullName;
        user.phone = phone ?? '';
        user.username = userName.trim();

        let saved: User;
        try {
            const saveUserAndWallet = async (manager: EntityManager): Promise<User> => {
                const savedUser = await manager.save(User, user);
                const wallet = new Wallet();
                wallet.userId = savedUser.id;
                wallet.balance = '0.00';
                wallet.status = 'active';
                await manager.save(Wallet, wallet);
                return savedUser;
            };

            saved = await this.userRepository.manager.transaction(saveUserAndWallet);
        } catch (error: any) {
            // 23505 = unique_violation. Letting the constraint decide instead of a
            // pre-flight SELECT closes the window where two concurrent signups both
            // pass the check and one blows up with a raw Postgres error.
            if (error?.code === '23505') {
                // detail reads: `Key (email)=(a@b.com) already exists.` — the column is
                // stable, the constraint name is a TypeORM hash that changes with the schema.
                // If a unique violation comes from the wallets table (e.g. UQ_wallets_user_id),
                // error.table will be 'wallets' or column will be 'user_id', so it must not
                // be misattributed to email or username.
                const column = /Key \((\w+)\)=/.exec(error.detail ?? '')?.[1];
                const isUsersTable = !error.table || error.table === 'users';
                if (isUsersTable && column === 'email') throw new Error(AUTH_MESSAGE.EMAIL_EXISTS);
                if (isUsersTable && column === 'username') throw new Error(AUTH_MESSAGE.USERNAME_EXISTS);
            }
            throw error;
        }

        await this.sendVerifyToken(saved);

        return { message: AUTH_MESSAGE.REGISTER_SUCCESS };
    }

    private async sendVerifyToken(user: User): Promise<void> {
        const token = randomUUID();
        await redis.set(verifyKey(user.id), this.hashToken(token), 'EX', VERIFY_TOKEN_TTL);
        await sendVerifyEmail(user.email, this.buildVerifyUrl(user.id, token));
    }

    async verifyEmail(userId: string, token: string): Promise<{ message: string }> {
        const storedHash = await redis.get(verifyKey(userId));
        const incomingHash = this.hashToken(token);

        if (!storedHash || storedHash !== incomingHash) {
            throw new Error(AUTH_MESSAGE.VERIFY_LINK_EXPIRED);
        }

        await this.userRepository.update(userId, { status: UserStatus.ACTIVE });
        await redis.del(verifyKey(userId));

        return { message: AUTH_MESSAGE.CHECK_USER_SUCCESS };
    }

    async resendVerify(email: string): Promise<{ message: string }> {
        const user = await this.userRepository.findOne({ where: { email: email.trim().toLowerCase() } });

        if (!user) {
            throw new Error(AUTH_MESSAGE.USER_NOT_FOUND);
        }

        if (user.status === UserStatus.ACTIVE) {
            throw new Error(AUTH_MESSAGE.ACCOUNT_ALREADY_VERIFIED);
        }

        await this.sendVerifyToken(user);
        return { message: AUTH_MESSAGE.RESEND_VERIFY_SUCCESS };
    }

    async login(loginDto: LoginDto): Promise<LoginResponseDto> {
        const { identifier, password, deviceId } = loginDto;

        if (!identifier || !password) {
            throw new Error(AUTH_MESSAGE.INVALID_LOGIN);
        }

        const normalizedIdentifier = identifier.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier);
        const where = isEmail
            ? { email: normalizedIdentifier.toLowerCase() }
            : { username: normalizedIdentifier };

        // passwordHash is `select: false` on the entity, so opt in explicitly here.
        const user = await this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.avatarFile', 'avatarFile')
            .addSelect('user.passwordHash')
            .where(where)
            .getOne();
        if (!user) {
            throw new Error(AUTH_MESSAGE.INVALID_CREDENTIALS);
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw new Error(AUTH_MESSAGE.ACCOUNT_NOT_AVAILABLE);
        }

        const isPasswordValid = await this.bcryptService.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error(AUTH_MESSAGE.INVALID_CREDENTIALS);
        }

        const resolvedDeviceId = deviceId ?? randomUUID();
        const refreshToken = this.issueRefreshToken(user, resolvedDeviceId);

        const pipeline = redis.pipeline();
        pipeline.set(refreshKey(user.id, resolvedDeviceId), this.hashToken(refreshToken), 'EX', REFRESH_TOKEN_TTL);
        pipeline.sadd(sessionKey(user.id), resolvedDeviceId);
        await pipeline.exec();

        return {
            token: this.issueAccessToken(user),
            refreshToken,
            id: user.id,
            email: user.email,
            fullName: user.fullname,
            avatarFileId: user.avatarFileId ?? null,
            avatarUrl: await fileService.urlOf(user.avatarFile),
        };
    }

    async refresh(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
        let decoded: { idUser: string; deviceId: string };
        try {
            decoded = jwt.verify(refreshToken, envVars.JWT_REFRESH_SECRET, {
                algorithms: ['HS256'],
                issuer: 'bidy-api',
                audience: 'bidy-client'
            }) as { idUser: string; deviceId: string };
        } catch {
            throw new Error(AUTH_MESSAGE.REFRESH_TOKEN_REVOKED_OR_INVALID);
        }

        const { idUser, deviceId } = decoded;
        const key = refreshKey(idUser, deviceId);
        const incomingHash = this.hashToken(refreshToken);

        const user = await this.userRepository.findOne({ where: { id: idUser } });
        if (!user) {
            throw new Error(AUTH_MESSAGE.USER_NOT_FOUND);
        }

        // Re-checked on every refresh, not just at login: a refresh token lives for
        // days and rotates itself, so without this a user banned or suspended while
        // logged in keeps minting fresh access tokens indefinitely and the ban never
        // takes effect. Deliberately not checking accountLocked — that lock exists to
        // chase an unpaid order, and cutting the session off would leave the user
        // unable to reach the page that pays it.
        if (user.status !== UserStatus.ACTIVE) {
            await this.logoutAll(idUser);
            throw new Error(AUTH_MESSAGE.ACCOUNT_NOT_AVAILABLE);
        }

        const newRefreshToken = this.issueRefreshToken(user, deviceId);
        const newHash = this.hashToken(newRefreshToken);

        // The token that was just rotated away stays usable for a short grace window.
        // A browser client refreshes from two runtimes that cannot share a lock — a
        // Next middleware on the edge and XHR in the page — so a token can legitimately
        // be presented twice within milliseconds. Without the window that reads as
        // replay and logs the user out of every device.
        const luaScript = `
            local stored = redis.call('get', KEYS[1])
            if not stored then
                return -1
            end
            if stored ~= ARGV[1] then
                local grace = redis.call('get', KEYS[2])
                if not grace or grace ~= ARGV[1] then
                    return -2
                end
            end
            redis.call('set', KEYS[2], stored, 'EX', ARGV[4])
            redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3])
            return 1
        `;

        const result = await redis.eval(
            luaScript, 2, key, graceKey(idUser, deviceId),
            incomingHash, newHash, REFRESH_TOKEN_TTL, REFRESH_GRACE_TTL,
        );

        if (result === -1 || result === -2) {
            if (result === -2) {
                await this.logoutAll(idUser);
            }
            throw new Error(AUTH_MESSAGE.REFRESH_TOKEN_REVOKED_OR_INVALID);
        }

        return {
            token: this.issueAccessToken(user),
            refreshToken: newRefreshToken
        };
    }

    async logout(userId: string, deviceId: string): Promise<void> {
        const pipeline = redis.pipeline();
        pipeline.del(refreshKey(userId, deviceId));
        // Without this the just-rotated token would still refresh for the rest of
        // the grace window, so logging out would not actually end the session.
        pipeline.del(graceKey(userId, deviceId));
        pipeline.srem(sessionKey(userId), deviceId);
        await pipeline.exec();
    }

    async logoutAll(userId: string): Promise<void> {
        await revokeAllSessions(userId);
    }

    async forgotPassword(email: string): Promise<{ message: string }> {
        const user = await this.userRepository.findOne({ where: { email: email.trim().toLowerCase() } });

        if (!user) {
            return { message: AUTH_MESSAGE.FORGOT_PASSWORD_SUCCESS };
        }

        const token = randomUUID();
        await redis.set(resetKey(user.id), this.hashToken(token), 'EX', RESET_TOKEN_TTL);
        await sendResetPasswordEmail(user.email, this.buildResetUrl(user.id, token));

        return { message: AUTH_MESSAGE.FORGOT_PASSWORD_SUCCESS };
    }

    async resetPassword(userId: string, token: string, newPassword: string): Promise<{ message: string }> {
        const storedHash = await redis.get(resetKey(userId));
        const incomingHash = this.hashToken(token);

        if (!storedHash || storedHash !== incomingHash) {
            throw new Error(AUTH_MESSAGE.RESET_LINK_EXPIRED);
        }

        const passwordHash = await this.bcryptService.hash(newPassword);
        await this.userRepository.update(userId, { passwordHash });
        await redis.del(resetKey(userId));

        // Revoke all sessions
        await this.logoutAll(userId);

        return { message: AUTH_MESSAGE.RESET_PASSWORD_SUCCESS };
    }
}