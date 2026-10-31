/**
 * Smallest runnable check that category reads expose a presigned `imageUrl` and
 * never the internal `imageFileId` handle.
 *
 *   npx tsx src/tests/category-image-url.check.ts
 *
 * No database or S3: the file provider is stubbed, and a stub repository returns
 * two rows — one with an image, one without.
 */
import assert from 'node:assert/strict';
import { fileService } from '../modules/file/file.provider.js';
import { CategoryService } from '../modules/category/category.service.js';

(fileService as any).urlsByIds = async (ids: (string | null)[]) =>
  new Map(ids.filter(Boolean).map((id) => [id as string, `https://cdn.test/${id}?sig=abc`]));

const rows = [
  { id: '1', name: 'With image', slug: 'with-image', imageFileId: '42', isActive: true },
  { id: '2', name: 'No image', slug: 'no-image', imageFileId: null, isActive: true },
];

const categoryRepo = {
  createQueryBuilder: () => {
    const qb: any = {
      where: () => qb,
      andWhere: () => qb,
      orderBy: () => qb,
      skip: () => qb,
      take: () => qb,
      getManyAndCount: async () => [rows, rows.length],
    };
    return qb;
  },
} as any;

const service = new CategoryService(categoryRepo);

async function main() {
  const { items } = await service.findAll({} as any);

  assert.equal(items[0]!.imageUrl, 'https://cdn.test/42?sig=abc');
  assert.equal(items[1]!.imageUrl, null);
  for (const item of items) {
    assert.ok(!('imageFileId' in item), 'imageFileId must not leak into category reads');
  }

  console.log('category-image-url.check: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
