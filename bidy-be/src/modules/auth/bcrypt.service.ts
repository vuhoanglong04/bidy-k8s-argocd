import bcrypt from "bcrypt";
import dotenv from "dotenv";
import * as crypto from "crypto";

dotenv.config();

export class BcryptService {
    private readonly SALT_ROUNDS: number = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');

    private preHash(password: string): string {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    async hash(password: string): Promise<string> {
        const preHashedPassword = this.preHash(password);
        return bcrypt.hash(preHashedPassword, this.SALT_ROUNDS);
    }

    async compare(password: string, hashedPasswordStore: string): Promise<boolean> {
        const preHashedPassword = this.preHash(password);
        return bcrypt.compare(preHashedPassword, hashedPasswordStore);
    }
}