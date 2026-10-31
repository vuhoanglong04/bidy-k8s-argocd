import { Repository, IsNull } from 'typeorm';
import { Category } from './category.entity.js';
import { CategoryQueryDto } from './dtos/category-query.dto.js';
import { CreateCategoryDto } from './dtos/create-category.dto.js';
import { UpdateCategoryDto } from './dtos/update-category.dto.js';
import { UpdateCategoryStatusDto } from './dtos/update-category-status.dto.js';
import redis from '../../common/redis/redis.client.js';
import { Product } from '../product/entities/product.entity.js';
import { CATEGORY_MESSAGE } from '../../common/messages/category/category.message.js';
import { escapeLike } from '../../common/util/sql-like.js';
import { fileService } from '../file/file.provider.js';
const SORT_COLUMN_MAP: Record<string, string> = {
  name: 'category.name',
  createdAt: 'category.created_at',
  updatedAt: 'category.updated_at',
};

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryTreeNode[];
}

export class CategoryService {
  constructor(private readonly categoryRepository: Repository<Category>) { }

  async findAll(query: CategoryQueryDto) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.deleted_at IS NULL');

    if (query.isActive !== undefined) {
      qb.andWhere('category.is_active = :isActive', {
        isActive: query.isActive === 'true',
      });
    }

    if (query.parentId !== undefined) {
      qb.andWhere('category.parent_id = :parentId', {
        parentId: query.parentId,
      });
    }

    if (query.search) {
      qb.andWhere('category.name ILIKE :search', {
        search: `%${escapeLike(query.search.trim())}%`,
      });
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortColumn = SORT_COLUMN_MAP[sortBy] || SORT_COLUMN_MAP['createdAt'];
    const sortOrder = (query.sortOrder || 'desc').toUpperCase() as 'ASC' | 'DESC';

    qb.orderBy(sortColumn, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();

    return { items: await this.withImageUrls(items), totalItems, page, limit };
  }

  /**
   * Replaces the internal `imageFileId` handle with a freshly signed `imageUrl`;
   * nothing stores a URL, and clients never see the file id.
   */
  private async withImageUrls<T extends { imageFileId: string | null }>(
    rows: T[],
  ): Promise<(Omit<T, 'imageFileId'> & { imageUrl: string | null })[]> {
    const urls = await fileService.urlsByIds(rows.map((row) => row.imageFileId));
    return rows.map(({ imageFileId, ...row }) => ({
      ...row,
      imageUrl: urls.get(imageFileId ?? '') ?? null,
    }));
  }

  async findTree(): Promise<CategoryTreeNode[]> {
    const cachedTree = await redis.get('categories:tree:v1');
    if (cachedTree) {
      return JSON.parse(cachedTree);
    }

    const categories = await this.categoryRepository.find({
      where: {
        isActive: true,
      },
      order: {
        name: 'ASC',
      },
    });

    // Signed once per distinct file for the whole tree rather than per node.
    // The 30-minute cache below is deliberately shorter than the presign TTL, so a
    // URL served from cache always has time left on it.
    const imageUrls = await fileService.urlsByIds(categories.map((c) => c.imageFileId));

    const nodeMap = new Map<string, CategoryTreeNode>();

    for (const category of categories) {
      nodeMap.set(category.id, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: imageUrls.get(category.imageFileId ?? '') ?? null,
        children: [],
      });
    }

    const roots: CategoryTreeNode[] = [];

    for (const category of categories) {
      const node = nodeMap.get(category.id)!;

      if (!category.parentId) {
        roots.push(node);
        continue;
      }

      const parent = nodeMap.get(category.parentId);

      if (parent) {
        parent.children.push(node);
      }
    }

    await redis.set('categories:tree:v1', JSON.stringify(roots), 'EX', 1800); // 30 minutes cache

    return roots;
  }

  /**
   * The category itself plus every descendant, so listing a parent covers the whole
   * subtree. Products hang off leaf categories, so an equality match on a parent
   * would return nothing. Depth is capped at 3 by assertParentDepthAllowed, but the
   * recursion is written for arbitrary depth rather than three hardcoded joins.
   */
  async findDescendantIds(id: string): Promise<string[]> {
    const rows = await this.categoryRepository.query(
      `WITH RECURSIVE subtree AS (
         SELECT id FROM categories WHERE id = $1 AND deleted_at IS NULL
         UNION ALL
         SELECT c.id FROM categories c
         JOIN subtree s ON c.parent_id = s.id
         WHERE c.deleted_at IS NULL
       )
       SELECT id FROM subtree`,
      [id],
    );

    return rows.map((row: { id: string }) => String(row.id));
  }

  async findById(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: {
        parent: true,
        children: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        imageFileId: true,
        isActive: true,
        createdAt: true,
        parent: {
          id: true,
          name: true,
        },
      },
    });

    if (!category) {
      throw new Error(CATEGORY_MESSAGE.CATEGORY_NOT_FOUND);
    }

    return category;
  }

  /** Response form of findById, with the image URL signed. */
  async getCategoryDetail(id: string) {
    const [detail] = await this.withImageUrls([await this.findById(id) as any]);
    return detail;
  }

  async findChildrenById(id: string) {
    const parent = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!parent) {
      throw new Error(CATEGORY_MESSAGE.CATEGORY_NOT_FOUND);
    }

    return await this.withImageUrls(
      await this.categoryRepository.find({
        where: { parentId: id, isActive: true },
        order: { name: 'ASC' },
      }),
    );
  }

  // --- Admin Mutations ---

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    let parentId: string | null = null;

    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      await this.assertParentDepthAllowed(parent.id);
      parentId = parent.id;
    }

    const existing = await this.categoryRepository.findOne({
      where: { name, parentId: parentId ?? IsNull() }
    });

    if (existing) {
      throw new Error(CATEGORY_MESSAGE.CATEGORY_ALREADY_EXISTS);
    }

    const category = this.categoryRepository.create({
      name,
      slug: await this.generateUniqueSlug(name),
      parentId,
      imageFileId: dto.imageFileId ?? null,
      isActive: true,
    });

    const saved = await this.categoryRepository.save(category);
    await this.invalidateCategoryCache();
    return (await this.withImageUrls([saved]))[0];
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.findById(id);

    if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
      if (dto.parentId === id) {
        throw new Error(CATEGORY_MESSAGE.CATEGORY_CYCLE_DETECTED);
      }

      if (dto.parentId !== null) {
        const parent = await this.findById(dto.parentId);
        await this.assertNoCycle(id, parent.id);
        await this.assertParentDepthAllowed(parent.id);
      }

      category.parentId = dto.parentId;
    }

    if (dto.name !== undefined && dto.name.trim() !== category.name) {
      const name = dto.name.trim();
      const parentId = category.parentId;

      const existing = await this.categoryRepository.findOne({
        where: { name, parentId: parentId ?? IsNull() }
      });

      if (existing) {
        throw new Error(CATEGORY_MESSAGE.CATEGORY_ALREADY_EXISTS);
      }

      category.name = name;
      category.slug = await this.generateUniqueSlug(name);
    }

    if (dto.imageFileId !== undefined) {
      category.imageFileId = dto.imageFileId;
    }

    const saved = await this.categoryRepository.save(category);
    await this.invalidateCategoryCache();
    return (await this.withImageUrls([saved]))[0];
  }

  async updateCategoryStatus(id: string, dto: UpdateCategoryStatusDto) {
    const category = await this.findById(id);
    category.isActive = dto.isActive;
    const saved = await this.categoryRepository.save(category);
    await this.invalidateCategoryCache();
    return (await this.withImageUrls([saved]))[0];
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoryRepository.manager.transaction(async manager => {
      const category = await manager
        .getRepository(Category)
        .createQueryBuilder('category')
        .setLock('pessimistic_write')
        .where('category.id = :id', { id })
        .getOne();

      if (!category) {
        throw new Error(CATEGORY_MESSAGE.CATEGORY_NOT_FOUND);
      }

      const childCount = await manager.getRepository(Category).count({
        where: { parentId: id },
      });

      if (childCount > 0) {
        throw new Error(CATEGORY_MESSAGE.CATEGORY_HAS_CHILDREN);
      }

      const productCount = await manager.getRepository(Product).count({
        where: { categoryId: id },
      });

      if (productCount > 0) {
        throw new Error(CATEGORY_MESSAGE.CATEGORY_HAS_PRODUCTS);
      }

      await manager.getRepository(Category).softDelete(id);
    });

    await this.invalidateCategoryCache();
  }

  // --- Helpers ---

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let count = 1;

    while (await this.categoryRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
  }

  private async assertParentDepthAllowed(parentId: string): Promise<void> {
    const MAX_DEPTH = 3;
    let depth = 1;
    let currentId: string | null = parentId;

    while (currentId) {
      const current = await this.categoryRepository.findOne({
        where: { id: currentId },
        select: { id: true, parentId: true }
      });

      if (!current) break;

      depth++;
      if (depth > MAX_DEPTH) {
        throw new Error(CATEGORY_MESSAGE.MAX_CATEGORY_DEPTH_EXCEEDED);
      }

      currentId = current.parentId;
    }
  }

  private async assertNoCycle(categoryId: string, proposedParentId: string): Promise<void> {
    let currentId: string | null = proposedParentId;

    while (currentId) {
      if (currentId === categoryId) {
        throw new Error(CATEGORY_MESSAGE.CATEGORY_CYCLE_DETECTED);
      }

      const current = await this.categoryRepository.findOne({
        where: { id: currentId },
        select: { id: true, parentId: true },
      });

      currentId = current?.parentId ?? null;
    }
  }

  private async invalidateCategoryCache(): Promise<void> {
    await redis.del('categories:tree:v1');
    await redis.del('categories:roots:v1');
  }
}
