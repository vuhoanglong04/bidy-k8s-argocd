import { DataSource } from 'typeorm';
import { User } from '../../modules/user/entity/user.entity.js';
import { UserRole, UserStatus } from '../../modules/user/enum/user.enum.js';
import { BcryptService } from '../../modules/auth/bcrypt.service.js';

const bcryptService = new BcryptService();

/**
 * Upserts a single admin account by email, so re-running `npm run seed` never
 * creates duplicates or clobbers an admin who already changed their password.
 * ADMIN_EMAIL / ADMIN_PASSWORD come from the environment rather than being
 * hardcoded, with dev-only fallbacks so the seed still runs without them.
 */
export async function seedAdmin(dataSource: DataSource): Promise<string> {
  const repo = dataSource.getRepository(User);

  const email = (process.env.ADMIN_EMAIL || 'admin@bidy.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await repo.findOne({ where: { email } as any });
  if (existing) {
    console.log(`✅ Admin already exists: ${email} (id=${(existing as any).id})`);
    return (existing as any).id;
  }

  const admin = repo.create({
    email,
    username: 'admin',
    fullname: 'Bidy Admin',
    passwordHash: await bcryptService.hash(password),
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    passwordResetRequired: true,
  } as any);

  const saved = (await repo.save(admin)) as any as User;

  console.log(`✅ Admin seeded: ${email} (id=${saved.id})`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`   Default password is "${password}" — set ADMIN_PASSWORD to override, and change it after first login.`);
  }
  console.log(`   Set ID_ADMIN=${saved.id} in .env if support chat should route to this account.`);

  return saved.id;
}
