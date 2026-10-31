import { Repository, DataSource, In } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { Category } from '../category/category.entity.js';
import { CreateProductDto } from './dtos/create-product.dto.js';
import { UpdateProductDto } from './dtos/update-product.dto.js';
import { ProductQueryDto } from './dtos/product-query.dto.js';
import { ReorderImagesDto } from './dtos/product-image.dto.js';
import { ProductStatus } from './enums/product-status.enum.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ForbiddenError } from '../../common/exceptions/forbidden.error.js';
import { UnprocessableEntityError } from '../../common/exceptions/unprocessable-entity.error.js';
import { PRODUCT_MESSAGE, PRODUCT_ERROR_CODE } from '../../common/messages/product/product.message.js';
import { fileService } from '../file/file.provider.js';
import { File } from '../file/entity/file.entity.js';
import { Auction } from '../auction/entity/auctions.entity.js';
import { AuctionStatus } from '../auction/enum/auction-status.enum.js';

/** An auction bidders can still act on; a product carrying one must not be withdrawn. */
const LIVE_AUCTION_STATUSES = [AuctionStatus.PENDING, AuctionStatus.HAPPENING];

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-');
}

export class ProductService {
  constructor(
    private readonly productRepo: Repository<Product>,
    private readonly categoryRepo: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  private authorize(product: Product, currentUserId: string, currentUserRole: string) {
    if (product.ownerId !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenError(PRODUCT_ERROR_CODE.PRODUCT_FORBIDDEN);
    }
  }

  async findPublicProducts(params: ProductQueryDto): Promise<{ items: any[]; totalItems: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .innerJoin('product.category', 'category')
      .leftJoin('product.images', 'primaryImage', 'primaryImage.isPrimary = TRUE')
      .leftJoin('primaryImage.file', 'primaryImageFile')
      .where('product.deletedAt IS NULL')
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('category.isActive = TRUE');

    if (params.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId: params.categoryId });
    }

    if (params.condition) {
      qb.andWhere('product.condition = :condition', { condition: params.condition });
    }

    if (params.search) {
      qb.andWhere('product.name ILIKE :search', { search: `%${params.search}%` });
    }

    let sortField = 'product.createdAt';
    if (params.sortBy === 'name') sortField = 'product.name';
    else if (params.sortBy === 'updatedAt') sortField = 'product.updatedAt';
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    qb.orderBy(sortField, sortOrder);

    qb.select([
      'product.id',
      'product.name',
      'product.slug',
      'product.condition',
      'product.createdAt',
      'category.id',
      'category.name',
      'primaryImage.id',
      'primaryImageFile.id',
      'primaryImageFile.s3Key',
    ]);

    qb.skip(skip).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    return { items: await Promise.all(items.map((item) => this.withImageUrls(item))), totalItems, page, limit };
  }

  /**
   * Replaces the loaded file relations with freshly signed URLs.
   *
   * The bucket is private, so `imageUrl` only exists for the lifetime of a
   * response — it is computed here rather than persisted, which is what keeps
   * `product_images` from drifting away from what is actually in the bucket.
   */
  private async withImageUrls(product: Product): Promise<any> {
    const images = product.images ?? [];
    const urls = await fileService.urlsOf(images.map((image) => image.file));

    return {
      ...product,
      images: images.map((image, index) => ({
        id: image.id,
        fileId: image.fileId,
        imageUrl: urls[index],
        isPrimary: image.isPrimary,
        displayOrder: image.displayOrder,
      })),
    };
  }

  /** Entity form, for callers that mutate or authorize against it. */
  async findProductById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: { category: true, owner: { avatarFile: true }, images: { file: true } },
    });

    if (!product) {
      throw new AppError(PRODUCT_MESSAGE.PRODUCT_NOT_FOUND, 404);
    }

    // Sort images by displayOrder
    if (product.images) {
      product.images.sort((a, b) => a.displayOrder - b.displayOrder);
    }

    return product;
  }

  /** Response form: owner trimmed to public fields, every image URL freshly signed. */
  async getProductDetail(id: string): Promise<any> {
    const product = await this.findProductById(id);
    const payload = await this.withImageUrls(product);

    // Hide sensitive info from owner
    if (product.owner) {
      const owner = product.owner as any;
      payload.owner = {
        id: owner.id,
        username: owner.username,
        avatarFileId: owner.avatarFileId ?? null,
        avatarUrl: await fileService.urlOf(owner.avatarFile),
      };
    }

    return payload;
  }

  async createProduct(currentUserId: string, dto: CreateProductDto): Promise<Product> {
    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, isActive: true },
    });

    if (!category) {
      throw new UnprocessableEntityError(PRODUCT_MESSAGE.PRODUCT_CATEGORY_INVALID);
    }

    const initialSlug = slugify(dto.name);
    
    let product = this.productRepo.create({
      ownerId: currentUserId,
      categoryId: category.id,
      name: dto.name.trim(),
      slug: initialSlug, // will update after insert if needed
      description: dto.description?.trim() ?? '',
      condition: dto.condition,
      status: ProductStatus.DRAFT,
    });

    product = await this.productRepo.save(product);
    
    // Append ID to slug to guarantee uniqueness (or avoid collisions)
    product.slug = `${initialSlug}-${product.id}`;
    await this.productRepo.save(product);

    return product;
  }

  async updateProduct(id: string, currentUserId: string, currentUserRole: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findProductById(id);
    this.authorize(product, currentUserId, currentUserRole);

    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId, isActive: true } });
      if (!category) {
        throw new UnprocessableEntityError(PRODUCT_MESSAGE.PRODUCT_CATEGORY_INVALID);
      }
      product.categoryId = category.id;
    }

    if (dto.name) {
      product.name = dto.name.trim();
      product.slug = `${slugify(product.name)}-${product.id}`;
    }

    if (dto.description !== undefined) {
      product.description = dto.description.trim();
    }

    if (dto.condition) {
      product.condition = dto.condition;
    }

    return this.productRepo.save(product);
  }

  /**
   * Withdraws a product from the catalogue.
   *
   * A product carrying a pending or running auction cannot be deleted: bidders are
   * committed against that listing, and removing the product underneath them would
   * strand an auction whose subject no longer exists. That guard used to live only
   * on the `inactive`/`archived` status transitions, so deleting was the way around
   * it — which is the same rule leaking out of a second door.
   */
  async softDeleteProduct(id: string, currentUserId: string, currentUserRole: string): Promise<void> {
    const product = await this.findProductById(id);
    this.authorize(product, currentUserId, currentUserRole);

    if (await this.hasLiveAuction(product.id)) {
      throw new AppError(PRODUCT_MESSAGE.PRODUCT_HAS_LIVE_AUCTION, 409);
    }

    await this.productRepo.softDelete(id);
  }

  async findMyProducts(currentUserId: string, params: ProductQueryDto): Promise<{ items: any[]; totalItems: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepo.createQueryBuilder('product')
      .where('product.ownerId = :ownerId', { ownerId: currentUserId });

    if (params.status) {
      qb.andWhere('product.status = :status', { status: params.status });
    }

    if (params.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId: params.categoryId });
    }

    if (params.search) {
      qb.andWhere('product.name ILIKE :search', { search: `%${params.search}%` });
    }

    let sortField = 'product.createdAt';
    if (params.sortBy === 'name') sortField = 'product.name';
    else if (params.sortBy === 'updatedAt') sortField = 'product.updatedAt';
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    qb.orderBy(sortField, sortOrder);
    qb.skip(skip).take(limit);

    qb.leftJoinAndSelect('product.images', 'image')
      .leftJoinAndSelect('image.file', 'imageFile');

    const [items, totalItems] = await qb.getManyAndCount();

    return { items: await this.withAuctionState(items), totalItems, page, limit };
  }

  /**
   * Adds each product's current auction and whether it can be auctioned again.
   *
   * The owner's list is where a seller decides what to do next, and that decision
   * needs to know which items are already on the block — otherwise the only way to
   * find out is to attempt a listing and be refused. Resolved in one query for the
   * whole page rather than per row.
   */
  private async withAuctionState(products: Product[]): Promise<any[]> {
    const withUrls = await Promise.all(products.map((product) => this.withImageUrls(product)));
    if (!products.length) return withUrls;

    // Newest first per product: a re-listed item has several, and the latest is the
    // one the seller is looking at.
    const auctions = await this.dataSource.getRepository(Auction).find({
      where: { productId: In(products.map((product) => product.id)) },
      order: { createdAt: 'DESC' },
      select: { id: true, productId: true, status: true, startDate: true, endDate: true, currentPrice: true },
    });

    const latestByProduct = new Map<string, Auction>();
    for (const auction of auctions) {
      if (!latestByProduct.has(auction.productId)) latestByProduct.set(auction.productId, auction);
    }

    return withUrls.map((payload, index) => {
      const product = products[index];
      const auction = latestByProduct.get(product.id) ?? null;
      const live = !!auction && LIVE_AUCTION_STATUSES.includes(auction.status as AuctionStatus);

      return {
        ...payload,
        latestAuction: auction && {
          id: auction.id,
          status: auction.status,
          startDate: auction.startDate,
          endDate: auction.endDate,
          currentPrice: auction.currentPrice,
        },
        hasLiveAuction: live,
        // Mirrors the checks assertAuctionable applies, so the card can disable the
        // action instead of letting the seller fill in a form that will be rejected.
        canCreateAuction:
          !live &&
          product.status === ProductStatus.ACTIVE &&
          (product.images?.length ?? 0) > 0,
      };
    });
  }

  /**
   * Publishes a draft product.
   *
   * There is only one move left in the product lifecycle — `draft` → `active` — so
   * this is an action rather than a status setter. Hiding and archiving are gone:
   * they duplicated soft delete, which the DELETE route already does, and a second
   * way to take a product off the market meant the "has a live auction" rule had to
   * be enforced in two places.
   *
   * Publishing an already-published product is a no-op rather than an error: the
   * caller's intent is satisfied either way.
   */
  async publishProduct(id: string, currentUserId: string, currentUserRole: string): Promise<Product> {
    const product = await this.findProductById(id);
    this.authorize(product, currentUserId, currentUserRole);

    if (product.status === ProductStatus.ACTIVE) return product;

    // A listing with no picture is unsellable, so publishing one is a mistake we can
    // catch here instead of after buyers have seen it.
    if ((product.images?.length ?? 0) === 0) {
      throw new UnprocessableEntityError(PRODUCT_MESSAGE.PRODUCT_NEEDS_IMAGE_TO_PUBLISH);
    }

    product.status = ProductStatus.ACTIVE;
    return await this.productRepo.save(product);
  }

  /**
   * Gate for auctioning a product the seller already owns.
   *
   * Lives here rather than in AuctionService because these are product rules — the
   * same ones updateStatus enforces — and duplicating them would let the two paths
   * drift. AuctionService calls this before building the auction.
   */
  async assertAuctionable(productId: string, currentUserId: string, currentUserRole: string): Promise<Product> {
    const product = await this.findProductById(productId);
    this.authorize(product, currentUserId, currentUserRole);

    if (product.status !== ProductStatus.ACTIVE || (product.images?.length ?? 0) === 0) {
      throw new UnprocessableEntityError(PRODUCT_MESSAGE.PRODUCT_NOT_AUCTIONABLE);
    }

    // Two live auctions on one item would take two buyers' money for one thing.
    if (await this.hasLiveAuction(product.id)) {
      throw new AppError(PRODUCT_MESSAGE.PRODUCT_HAS_LIVE_AUCTION, 409);
    }

    return product;
  }

  /** An auction that bidders can still act on — pending or running. */
  private async hasLiveAuction(productId: string): Promise<boolean> {
    return await this.dataSource.getRepository(Auction).existsBy({
      productId,
      status: In(LIVE_AUCTION_STATUSES),
    });
  }

  async uploadImages(productId: string, currentUserId: string, currentUserRole: string, files: any[]): Promise<any[]> {
    const product = await this.findProductById(productId);
    this.authorize(product, currentUserId, currentUserRole);

    if (!files || files.length === 0) {
      throw new AppError('No files provided', 400);
    }

    let uploaded: File[] = [];

    try {
      return await this.dataSource.transaction(async manager => {
        // Registered inside the transaction so a failed image insert rolls the
        // file rows back with it; only the R2 objects need the catch below.
        uploaded = await fileService.createManyFromUpload(files, 'products', currentUserId, manager);

        const imageRepo = manager.getRepository(ProductImage);
        const existingImageCount = await imageRepo.count({ where: { productId } });

        const newImages = uploaded.map((file, index) => {
          return imageRepo.create({
            productId,
            fileId: file.id,
            isPrimary: existingImageCount === 0 && index === 0,
            displayOrder: existingImageCount + index,
          });
        });

        const saved = await imageRepo.save(newImages);

        return await Promise.all(
          saved.map(async (image, index) => ({
            id: image.id,
            fileId: image.fileId,
            imageUrl: await fileService.urlOf(uploaded[index]),
            isPrimary: image.isPrimary,
            displayOrder: image.displayOrder,
          })),
        );
      });
    } catch (error) {
      // The file rows rolled back with the transaction, but the R2 objects did not.
      if (uploaded.length > 0) {
        await fileService.discardUploadedKeys(uploaded.map(file => file.s3Key));
      }
      throw error;
    }
  }

  async deleteImage(productId: string, imageId: string, currentUserId: string, currentUserRole: string): Promise<void> {
    const product = await this.findProductById(productId);
    this.authorize(product, currentUserId, currentUserRole);

    await this.dataSource.transaction(async manager => {
      const imageRepo = manager.getRepository(ProductImage);
      
      const image = await imageRepo.findOne({
        where: { id: imageId, productId },
        relations: { file: true },
      });
      if (!image) {
        throw new AppError(PRODUCT_MESSAGE.IMAGE_NOT_FOUND, 404);
      }

      const orphanedFile = image.file;
      await imageRepo.remove(image);

      if (image.isPrimary) {
        const nextImage = await imageRepo.findOne({
          where: { productId },
          order: { displayOrder: 'ASC' },
        });

        if (nextImage) {
          nextImage.isPrimary = true;
          await imageRepo.save(nextImage);
        }
      }

      // Compact display orders
      const remainingImages = await imageRepo.find({
        where: { productId },
        order: { displayOrder: 'ASC' },
      });

      for (let i = 0; i < remainingImages.length; i++) {
        remainingImages[i].displayOrder = i;
      }
      await imageRepo.save(remainingImages);

      // Best effort: an orphaned object costs storage, a thrown error costs the delete.
      await fileService.deleteMany([orphanedFile], manager);
    });
  }

  async setPrimaryImage(productId: string, imageId: string, currentUserId: string, currentUserRole: string): Promise<void> {
    const product = await this.findProductById(productId);
    this.authorize(product, currentUserId, currentUserRole);

    await this.dataSource.transaction(async manager => {
      const imageRepo = manager.getRepository(ProductImage);
      
      const image = await imageRepo.findOne({ where: { id: imageId, productId } });
      if (!image) {
        throw new AppError(PRODUCT_MESSAGE.IMAGE_NOT_FOUND, 404);
      }

      await manager.createQueryBuilder()
        .update(ProductImage)
        .set({ isPrimary: false })
        .where('product_id = :productId AND is_primary = TRUE', { productId })
        .execute();

      image.isPrimary = true;
      await imageRepo.save(image);
    });
  }

  async reorderImages(productId: string, currentUserId: string, currentUserRole: string, dto: ReorderImagesDto): Promise<void> {
    const product = await this.findProductById(productId);
    this.authorize(product, currentUserId, currentUserRole);

    await this.dataSource.transaction(async manager => {
      const imageRepo = manager.getRepository(ProductImage);
      
      const existingImages = await imageRepo.find({ where: { productId } });
      if (existingImages.length !== dto.images.length) {
        throw new UnprocessableEntityError('Payload must contain the complete current image list');
      }

      // Move orders to temporary negative range
      await manager.createQueryBuilder()
        .update(ProductImage)
        .set({ displayOrder: () => '-(display_order + 1)' })
        .where('product_id = :productId', { productId })
        .execute();

      // Apply final desired order
      for (const item of dto.images) {
        if (!existingImages.some(img => img.id === item.id)) {
          throw new UnprocessableEntityError(`Image with id ${item.id} does not belong to this product`);
        }

        await manager.createQueryBuilder()
          .update(ProductImage)
          .set({ displayOrder: item.displayOrder })
          .where('id = :id AND product_id = :productId', { id: item.id, productId })
          .execute();
      }
    });
  }
}
