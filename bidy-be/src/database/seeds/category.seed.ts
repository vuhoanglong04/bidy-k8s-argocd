import { DataSource } from 'typeorm';
import { Category } from '../../modules/category/category.entity.js';
import { fileService } from '../../modules/file/file.provider.js';
import redis from '../../common/redis/redis.client.js';

/**
 * Two-level category tree for the landing page. Products hang off the leaves, so
 * the parents exist to be browsed, not to own products directly — listing a parent
 * covers its children through AuctionService.getProductByCategory.
 */
type SeedCategory = { name: string; slug: string; keyword: string };

const CATEGORY_TREE: (SeedCategory & { children: SeedCategory[] })[] = [
  {
    name: 'Điện tử',
    slug: 'dien-tu',
    keyword: 'electronics',
    children: [
      { name: 'Điện thoại', slug: 'dien-thoai', keyword: 'smartphone' },
      { name: 'Máy tính xách tay', slug: 'may-tinh-xach-tay', keyword: 'laptop' },
      { name: 'Máy ảnh', slug: 'may-anh', keyword: 'camera' },
    ],
  },
  {
    name: 'Đồng hồ & Trang sức',
    slug: 'dong-ho-trang-suc',
    keyword: 'luxury,watch',
    children: [
      { name: 'Đồng hồ cơ', slug: 'dong-ho-co', keyword: 'watch' },
      { name: 'Trang sức vàng', slug: 'trang-suc-vang', keyword: 'gold,jewelry' },
    ],
  },
  {
    name: 'Sưu tầm',
    slug: 'suu-tam',
    keyword: 'antique',
    children: [
      { name: 'Tem & Tiền cổ', slug: 'tem-tien-co', keyword: 'coins,stamps' },
      { name: 'Mô hình', slug: 'mo-hinh', keyword: 'scale,model,car' },
    ],
  },
  {
    name: 'Nghệ thuật',
    slug: 'nghe-thuat',
    keyword: 'art,gallery',
    children: [
      { name: 'Tranh', slug: 'tranh', keyword: 'painting' },
      { name: 'Gốm sứ', slug: 'gom-su', keyword: 'ceramic,vase' },
    ],
  },
];

/**
 * Upserts by slug rather than inserting, so re-running the seed against a database
 * that already has these categories updates them instead of failing on the unique
 * slug constraint. Returns slug -> id for the auction seed to reference.
 */
export async function seedCategories(dataSource: DataSource): Promise<Map<string, string>> {
  const repo = dataSource.getRepository(Category);
  const idsBySlug = new Map<string, string>();

  for (const root of CATEGORY_TREE) {
    const parent = await upsertCategory(repo, root, null);
    idsBySlug.set(root.slug, parent.id);

    for (const child of root.children) {
      const node = await upsertCategory(repo, child, parent.id);
      idsBySlug.set(child.slug, node.id);
    }
  }

  // Seeding writes straight to the repository, bypassing the service that would
  // normally invalidate these — /categories/tree caches for 30 minutes, so without
  // this the freshly seeded tree stays invisible.
  await redis.del('categories:tree:v1');
  await redis.del('categories:roots:v1');

  console.log(`✅ Categories seeded: ${CATEGORY_TREE.length} roots, ${idsBySlug.size} total`);

  return idsBySlug;
}

async function upsertCategory(
  repo: ReturnType<DataSource['getRepository']>,
  { name, slug, keyword }: SeedCategory,
  parentId: string | null,
) {
  const existing = await repo.findOne({ where: { slug } as any, withDeleted: true });

  const category = existing
    ? (await repo.update((existing as any).id, { name, parentId, isActive: true, deletedAt: null } as any), existing)
    : await repo.save(repo.create({ name, slug, parentId, isActive: true } as any));

  // Only fills a missing image, so artwork an admin uploaded is never replaced.
  // Best-effort: the source is a public placeholder service outside our control,
  // so a fetch failure should leave the category imageless rather than abort seeding.
  if (!(category as any).imageFileId) {
    try {
      const image = await fileService.createFromUpload(
        { buffer: await fetchCategoryImage(slug, keyword), originalname: `${slug}.jpg`, mimetype: 'image/jpeg' } as any,
        'seed',
      );
      await repo.update((category as any).id, { imageFileId: image.id } as any);
    } catch (err) {
      console.warn(`⚠️  Skipping image for category ${slug}:`, (err as Error).message);
    }
  }

  return category as any as Category;
}

/** Keyword-matched photo; `lock` pins the pick so re-seeding stays deterministic. */
async function fetchCategoryImage(slug: string, keyword: string): Promise<Buffer> {
  const response = await fetch(`https://loremflickr.com/800/600/${keyword}?lock=${slug.length}`);
  if (!response.ok) throw new Error(`Failed to fetch category image for ${slug}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
