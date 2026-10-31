import { EntityManager, Not, Repository } from 'typeorm';
import { User } from './entity/user.entity.js';
import { Wishlist } from './entity/wishlist.entity.js';
import { Address } from '../../common/entity/address.entity.js';
import { CreateAddressDto, UpdateAddressDto } from './dtos/address.dto.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { AuctionStatus } from '../auction/enum/auction-status.enum.js';
import { BcryptService } from '../auth/bcrypt.service.js';
import { fileService } from '../file/file.provider.js';

export interface CheckUserInput {
  userName?: string;
  email?: string;
  phone?: string;
}

export class UserService {
  constructor(
    private readonly userRepo: Repository<User>,
    private readonly wishlistRepo: Repository<Wishlist>,
    private readonly auctionRepo: Repository<Auction>,
    private readonly bcryptService: BcryptService,
    private readonly addressRepo: Repository<Address>,
  ) {}

  /**
   * `avatarUrl` is computed, not stored: the bucket is private, so the only URL
   * that works is one signed for this response. Callers keep the field name they
   * always had.
   */
  private async strip(user: User) {
    const { passwordHash: _passwordHash, avatarFile, ...safe } = user;
    return { ...safe, avatarUrl: await fileService.urlOf(avatarFile) };
  }

  async viewProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { avatarFile: true },
    });
    return user ? await this.strip(user) : null;
  }

  async userList() {
    const users = await this.userRepo.find({ relations: { avatarFile: true } });
    return await Promise.all(users.map((user) => this.strip(user)));
  }

  async userUpdate(userId: string, fullname?: string, email?: string, phone?: string) {
    // Only the fields actually supplied take part in the uniqueness check and the update —
    // a null/undefined value in a TypeORM `where` throws rather than matching SQL NULL.
    const conditions = [];
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phone });

    if (conditions.length > 0) {
      const existing = await this.userRepo.findOne({ where: conditions });

      if (existing && String(existing.id) !== String(userId)) {
        if (email && existing.email === email) throw new Error('EMAIL_EXISTS');
        if (phone && existing.phone === phone) throw new Error('PHONE_EXISTS');
      }
    }

    const changes: Partial<User> = {};
    if (fullname !== undefined) changes.fullname = fullname;
    if (email !== undefined) changes.email = email;
    if (phone !== undefined) changes.phone = phone;

    if (Object.keys(changes).length > 0) {
      await this.userRepo.update(userId, changes);
    }

    const updated = await this.userRepo.findOne({ where: { id: userId } });
    return updated ? this.strip(updated) : null;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    // passwordHash is `select: false` on the entity, so opt in explicitly here.
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new Error('USER_NOT_FOUND');

    const isOldPasswordValid = await this.bcryptService.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) throw new Error('INVALID_PASSWORD');

    user.passwordHash = await this.bcryptService.hash(newPassword);
    await this.userRepo.save(user);

    return this.strip(user);
  }

  async checkUser({ userName, email, phone }: CheckUserInput) {
    const conditions = [];
    if (userName) conditions.push({ username: userName });
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phone });

    if (conditions.length === 0) return { exists: false, field: null };

    const existing = await this.userRepo.findOne({ where: conditions });
    if (!existing) return { exists: false, field: null };

    if (userName && existing.username === userName) return { exists: true, field: 'userName' };
    if (email && existing.email === email) return { exists: true, field: 'email' };
    if (phone && existing.phone === phone) return { exists: true, field: 'phone' };

    return { exists: true, field: null };
  }

  async updateAvatar(userId: string, file: any) {
    if (!file) throw new Error('NO_FILE_PROVIDED');

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { avatarFile: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const previousFile = user.avatarFile;

    const uploaded = await fileService.createFromUpload(file, 'avatars', userId);
    user.avatarFileId = uploaded.id;
    user.avatarFile = uploaded;
    await this.userRepo.save(user);

    // Best-effort: the replaced object is unreachable now that the row moved on,
    // and a failed delete must not fail the avatar update.
    if (previousFile && previousFile.id !== uploaded.id) {
      await fileService.deleteMany([previousFile]);
    }

    return { avatar: await fileService.urlOf(uploaded) };
  }

  async getTotalWishlist(userId: string, limitNumber: number) {
    const totalWishlist = await this.wishlistRepo.count({ where: { userId } });
    return { totalWishlist, totalPages: Math.ceil(totalWishlist / limitNumber) };
  }

  async wishlist(userId: string, { page, limit }: { page?: unknown; limit?: unknown } = {}) {
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || Number(process.env.LIMIT_NUMBER) || 10;

    const [items, total] = await this.wishlistRepo.findAndCount({
      where: { userId },
      relations: { auction: { product: true } },
      order: { createdAt: 'DESC' },
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
    });

    const totalPages = Math.ceil(total / limitNumber);
    return {
      wishlist: items,
      totalWishlist: total,
      totalPages,
      currentPage: totalPages ? pageNumber : 0,
    };
  }

  async addWishlist(userId: string, auctionId: string) {
    const existing = await this.wishlistRepo.findOne({ where: { userId, auctionId } });
    if (existing) throw new Error('AUCTION_ALREADY_IN_WISHLIST');

    const item = this.wishlistRepo.create({ userId, auctionId });
    await this.wishlistRepo.save(item);
    return item;
  }

  async removeWishlist(userId: string, auctionId: string) {
    await this.wishlistRepo.delete({ userId, auctionId });
  }

  async removeAllWishlist(userId: string) {
    await this.wishlistRepo.delete({ userId });
  }

  // ===== ADDRESSES =====
  //
  // The invariant every caller relies on: a user who owns at least one address owns
  // exactly one default. buyNow resolves the shipping address from it, so a user with
  // addresses but no default would fail checkout for no reason the user can see.

  async listAddresses(userId: string) {
    return await this.addressRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', created_at: 'DESC' },
    });
  }

  /** Scoped by owner: another user's id must read as absent, not as forbidden. */
  private async findOwnAddress(manager: EntityManager, userId: string, addressId: string) {
    const address = await manager.findOne(Address, { where: { id: addressId, userId } });
    if (!address) throw new Error('ADDRESS_NOT_FOUND');
    return address;
  }

  /** Demotes every other address of the user. Caller must already be in a transaction. */
  private async clearDefault(manager: EntityManager, userId: string, keepId?: string) {
    await manager.update(
      Address,
      { userId, isDefault: true, ...(keepId ? { id: Not(keepId) } : {}) },
      { isDefault: false },
    );
  }

  async createAddress(userId: string, data: CreateAddressDto) {
    return await this.addressRepo.manager.transaction(async (manager) => {
      // First address is the default whether or not the client asked for it.
      const isFirst = (await manager.count(Address, { where: { userId } })) === 0;
      const isDefault = isFirst || data.isDefault === true;

      if (isDefault) await this.clearDefault(manager, userId);

      const address = manager.create(Address, {
        userId,
        street: data.street,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode ?? null,
        isDefault,
      });

      return await manager.save(Address, address);
    });
  }

  async updateAddress(userId: string, addressId: string, data: UpdateAddressDto) {
    return await this.addressRepo.manager.transaction(async (manager) => {
      const address = await this.findOwnAddress(manager, userId, addressId);

      if (data.street !== undefined) address.street = data.street;
      if (data.city !== undefined) address.city = data.city;
      if (data.state !== undefined) address.state = data.state;
      if (data.zipCode !== undefined) address.zipCode = data.zipCode;

      // Demoting the only default directly would leave the user without one, so a
      // default is only ever moved — never switched off from here.
      if (data.isDefault === true && !address.isDefault) {
        await this.clearDefault(manager, userId, addressId);
        address.isDefault = true;
      }

      return await manager.save(Address, address);
    });
  }

  async setDefaultAddress(userId: string, addressId: string) {
    return await this.addressRepo.manager.transaction(async (manager) => {
      const address = await this.findOwnAddress(manager, userId, addressId);

      await this.clearDefault(manager, userId, addressId);
      address.isDefault = true;

      return await manager.save(Address, address);
    });
  }

  async removeAddress(userId: string, addressId: string) {
    await this.addressRepo.manager.transaction(async (manager) => {
      const address = await this.findOwnAddress(manager, userId, addressId);

      try {
        await manager.remove(Address, address);
      } catch (error: any) {
        // orders.shipping_address_id is ON DELETE RESTRICT: an address that shipped
        // an order is part of that order's record and cannot be taken back.
        if (error?.code === '23503' || error?.driverError?.code === '23503') {
          throw new Error('ADDRESS_IN_USE');
        }
        throw error;
      }

      // Promote a survivor so the "exactly one default" invariant holds.
      if (address.isDefault) {
        const next = await manager.findOne(Address, {
          where: { userId },
          order: { created_at: 'ASC' },
        });
        if (next) {
          next.isDefault = true;
          await manager.save(Address, next);
        }
      }
    });
  }

  async getUserStats(userId: string) {
    const [soldAmount, sellingAmount, willSellAmount, followAmount] = await Promise.all([
      this.countOwnedAuctions(userId, AuctionStatus.ENDED),
      this.countOwnedAuctions(userId, AuctionStatus.HAPPENING),
      this.countOwnedAuctions(userId, AuctionStatus.PENDING),
      this.wishlistRepo.count({ where: { userId } }),
    ]);

    return {
      sell: { soldAmount, sellingAmount, willSellAmount },
      buy: { followAmount },
    };
  }

  private countOwnedAuctions(userId: string, status: AuctionStatus) {
    return this.auctionRepo
      .createQueryBuilder('auction')
      .innerJoin('auction.product', 'product')
      .where('product.owner_id = :userId', { userId })
      .andWhere('auction.status = :status', { status })
      .getCount();
  }
}
