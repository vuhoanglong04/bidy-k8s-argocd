import { EntityManager, In, Repository } from 'typeorm';
import { File } from './entity/file.entity.js';
import { ProductImage } from '../product/entities/product-image.entity.js';
import { WalletWithdrawalRequest } from '../wallet/entity/wallet-withdrawal-request.entity.js';
import { User } from '../user/entity/user.entity.js';
import { UserRole } from '../user/enum/user.enum.js';
import {
  uploadMultipleFilesToS3,
  deleteFileFromS3,
  getPresignedUrl,
} from '../../config/r2.config.js';

/** How long a minted URL stays valid. Long enough to render a page, short enough to not be a share link. */
export const PRESIGN_TTL_SECONDS = 3600;

export class FileService {
  constructor(private readonly fileRepository: Repository<File>) {}

  private repo(manager?: EntityManager): Repository<File> {
    return manager ? manager.getRepository(File) : this.fileRepository;
  }

  /**
   * Uploads to R2 and registers the object.
   *
   * Callers pass their own `manager` when the owning row is written in a
   * transaction, so a rolled-back product never leaves a dangling file row.
   * The R2 object itself is not transactional — see `deleteMany` for cleanup.
   */
  async createFromUpload(
    file: Express.Multer.File,
    folder: string,
    uploadedBy?: string | null,
    manager?: EntityManager,
  ): Promise<File> {
    const [created] = await this.createManyFromUpload([file], folder, uploadedBy, manager);
    return created;
  }

  async createManyFromUpload(
    files: Express.Multer.File[],
    folder: string,
    uploadedBy?: string | null,
    manager?: EntityManager,
  ): Promise<File[]> {
    if (!files.length) return [];

    const results = await uploadMultipleFilesToS3(files, folder);
    const repo = this.repo(manager);

    return await repo.save(
      results.map((result: any) =>
        repo.create({
          s3Key: result.key,
          originalName: result.originalname,
          mimeType: result.mimetype,
          sizeBytes: result.size,
          uploadedBy: uploadedBy ?? null,
        }),
      ),
    );
  }

  /**
   * The single place a stored key becomes something a browser can fetch.
   *
   * Nothing else in the codebase may build an image URL: the bucket is private,
   * so an unsigned URL is a dead link and a persisted signed one is an expired one.
   */
  async urlOf(file: File | null | undefined): Promise<string | null> {
    if (!file?.s3Key) return null;
    return await getPresignedUrl(file.s3Key, PRESIGN_TTL_SECONDS);
  }

  /** Batch variant for list endpoints — signing is local crypto, so this stays cheap. */
  async urlsOf(files: (File | null | undefined)[]): Promise<(string | null)[]> {
    return await Promise.all(files.map((file) => this.urlOf(file)));
  }

  /** Presigned URLs keyed by file id, for rows that only carry the id. */
  async urlsByIds(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (!wanted.length) return new Map();

    const files = await this.fileRepository.find({ where: { id: In(wanted) } });
    const entries = await Promise.all(
      files.map(async (file) => [file.id, (await this.urlOf(file))!] as const),
    );
    return new Map(entries);
  }

  async findById(id: string): Promise<File | null> {
    return await this.fileRepository.findOne({ where: { id } });
  }

  /**
   * Whether a stored file may be signed for an anonymous caller.
   *
   * Product images are public by nature — they render on product, auction and
   * category pages that anyone can open, and a visitor whose presigned URL expired
   * has no other way to recover it. Everything else in the bucket (avatars, review
   * media) is not: those are only reachable with a token, so that knowing or
   * guessing a file id is never enough to read one.
   *
   * `categories.image_file_id` is deliberately NOT treated as public, even though a
   * category page is. Widening the rule was not needed: no category has an image in
   * any environment, and the frontend renders none. If a public category image ever
   * ships, this is the one place to add it — and it is a decision to take, not an
   * oversight to fix silently, because every id this returns true for becomes
   * readable without a token.
   */
  async isPubliclyReadable(fileId: string): Promise<boolean> {
    return await this.fileRepository.manager
      .getRepository(ProductImage)
      .existsBy({ fileId });
  }

  /**
   * Evaluates whether the caller may receive a presigned URL for a stored file.
   *
   * Rules:
   * - Anonymous callers can only read public files (product images).
   * - If a file is referenced as a withdrawal proof (wallet_withdrawal_requests.proof_file_id),
   *   only an admin or the owner of that withdrawal request (withdrawal.userId) can read it.
   * - Authenticated callers can read any other registered file (avatars, review media, etc.).
   */
  async canRead(
    fileId: string,
    userId?: string | null,
    roleOrIsAdmin?: string | boolean | null,
  ): Promise<boolean> {
    if (!userId) {
      return await this.isPubliclyReadable(fileId);
    }

    const withdrawal = await this.fileRepository.manager
      .getRepository(WalletWithdrawalRequest)
      .findOne({
        where: { proofFileId: fileId },
        select: { id: true, userId: true },
      });

    if (!withdrawal) {
      return true;
    }

    if (String(withdrawal.userId) === String(userId)) {
      return true;
    }

    let isAdmin: boolean;
    if (typeof roleOrIsAdmin === 'boolean') {
      isAdmin = roleOrIsAdmin;
    } else if (typeof roleOrIsAdmin === 'string') {
      isAdmin = roleOrIsAdmin === UserRole.ADMIN || roleOrIsAdmin === 'admin';
    } else {
      const user = await this.fileRepository.manager
        .getRepository(User)
        .findOne({
          where: { id: userId },
          select: { id: true, role: true },
        });
      isAdmin = user?.role === UserRole.ADMIN || (user?.role as any) === 'admin';
    }

    return isAdmin;
  }

  /**
   * Best-effort removal of the R2 objects and their rows.
   *
   * A failed R2 delete leaves an orphaned object, which is wasted storage but not
   * a correctness problem; failing the caller over it would be worse.
   */
  async deleteMany(files: (File | null | undefined)[], manager?: EntityManager): Promise<void> {
    const present = files.filter((file): file is File => !!file);
    if (!present.length) return;

    await Promise.allSettled(present.map((file) => deleteFileFromS3(file.s3Key)));
    await this.repo(manager).delete({ id: In(present.map((file) => file.id)) });
  }

  /** Drops objects uploaded before the owning transaction failed. */
  async discardUploadedKeys(keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map((key) => deleteFileFromS3(key)));
  }
}
