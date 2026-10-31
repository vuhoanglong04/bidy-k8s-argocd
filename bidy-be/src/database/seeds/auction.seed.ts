import { DataSource } from 'typeorm';
import { fileService } from '../../modules/file/file.provider.js';
import { Auction } from '../../modules/auction/entity/auctions.entity.js';
import { BidHistory } from '../../modules/auction/entity/bid-history.entity.js';
import { Product } from '../../modules/product/entities/product.entity.js';
import { ProductImage } from '../../modules/product/entities/product-image.entity.js';
import { User } from '../../modules/user/entity/user.entity.js';
import { AuctionStatus } from '../../modules/auction/enum/auction-status.enum.js';
import { ProductCondition } from '../../modules/product/enums/product-condition.enum.js';
import { ProductStatus } from '../../modules/product/enums/product-status.enum.js';
import { UserRole, UserStatus } from '../../modules/user/enum/user.enum.js';
import { BcryptService } from '../../modules/auth/bcrypt.service.js';

const SEED_PASSWORD = 'Seed@12345';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Offsets are relative to the moment the seed runs, never absolute dates, so the
 * landing page always has genuinely live auctions no matter when this is executed.
 * `startsIn`/`endsIn` are milliseconds from now; negative means in the past.
 */
interface AuctionSeed {
  name: string;
  slug: string;
  categorySlug: string;
  startingPrice: number;
  bidIncrement: number;
  buyNowPrice: number | null;
  startsIn: number;
  endsIn: number;
  /** Bids to replay, in order, as [bidderIndex, amount]. Drives currentPrice and the counters. */
  bids: [number, number][];
}

const AUCTIONS: AuctionSeed[] = [
  // Live and contested — these carry the "đang đấu giá sôi nổi nhất" block.
  {
    name: 'iPhone 15 Pro Max 256GB',
    slug: 'iphone-15-pro-max-256gb',
    categorySlug: 'dien-thoai',
    startingPrice: 18_000_000, bidIncrement: 500_000, buyNowPrice: 32_000_000,
    startsIn: -2 * DAY, endsIn: 2 * HOUR,
    bids: [[0, 18_500_000], [1, 19_000_000], [2, 20_000_000], [0, 21_500_000], [1, 23_000_000]],
  },
  {
    name: 'MacBook Pro 14" M3',
    slug: 'macbook-pro-14-m3',
    categorySlug: 'may-tinh-xach-tay',
    startingPrice: 35_000_000, bidIncrement: 1_000_000, buyNowPrice: null,
    startsIn: -3 * DAY, endsIn: 6 * HOUR,
    bids: [[1, 36_000_000], [2, 38_000_000], [0, 41_000_000]],
  },
  {
    name: 'Seiko Presage cổ điển',
    slug: 'seiko-presage-co-dien',
    categorySlug: 'dong-ho-co',
    startingPrice: 6_500_000, bidIncrement: 200_000, buyNowPrice: 12_000_000,
    startsIn: -1 * DAY, endsIn: 26 * HOUR,
    bids: [[2, 6_700_000], [0, 7_100_000]],
  },
  // Live but quiet — closing soon, so they anchor the "sắp kết thúc" block.
  {
    name: 'Canon EOS R6 Mark II',
    slug: 'canon-eos-r6-mark-ii',
    categorySlug: 'may-anh',
    startingPrice: 28_000_000, bidIncrement: 1_000_000, buyNowPrice: null,
    startsIn: -12 * HOUR, endsIn: 45 * HOUR,
    bids: [[1, 29_000_000]],
  },
  {
    name: 'Tranh sơn dầu phong cảnh Hà Nội',
    slug: 'tranh-son-dau-ha-noi',
    categorySlug: 'tranh',
    startingPrice: 4_000_000, bidIncrement: 200_000, buyNowPrice: 9_000_000,
    startsIn: -6 * HOUR, endsIn: 3 * DAY,
    bids: [],
  },
  {
    name: 'Bộ tem Đông Dương 1943',
    slug: 'bo-tem-dong-duong-1943',
    categorySlug: 'tem-tien-co',
    startingPrice: 2_500_000, bidIncrement: 100_000, buyNowPrice: null,
    startsIn: -4 * HOUR, endsIn: 5 * DAY,
    bids: [[0, 2_600_000], [2, 2_800_000]],
  },
  {
    name: 'Bình gốm Bát Tràng men rạn',
    slug: 'binh-gom-bat-trang-men-ran',
    categorySlug: 'gom-su',
    startingPrice: 1_800_000, bidIncrement: 100_000, buyNowPrice: 4_500_000,
    startsIn: -30 * HOUR, endsIn: 4 * DAY,
    bids: [[1, 1_900_000]],
  },
  // Upcoming — the "sắp diễn ra" block.
  {
    name: 'Nhẫn vàng 18K đính đá',
    slug: 'nhan-vang-18k-dinh-da',
    categorySlug: 'trang-suc-vang',
    startingPrice: 12_000_000, bidIncrement: 500_000, buyNowPrice: null,
    startsIn: 1 * DAY, endsIn: 6 * DAY,
    bids: [],
  },
  {
    name: 'Mô hình Gundam RX-78-2 giới hạn',
    slug: 'mo-hinh-gundam-rx-78-2',
    categorySlug: 'mo-hinh',
    startingPrice: 3_200_000, bidIncrement: 100_000, buyNowPrice: 7_000_000,
    startsIn: 3 * DAY, endsIn: 9 * DAY,
    bids: [],
  },
  // Already finished — so the "ended" ordering branch has something to show.
  {
    name: 'Samsung Galaxy S23 Ultra',
    slug: 'samsung-galaxy-s23-ultra',
    categorySlug: 'dien-thoai',
    startingPrice: 14_000_000, bidIncrement: 500_000, buyNowPrice: null,
    startsIn: -8 * DAY, endsIn: -1 * DAY,
    bids: [[0, 14_500_000], [1, 15_500_000]],
  },
  {
    name: 'Đồng hồ Orient Bambino',
    slug: 'dong-ho-orient-bambino',
    categorySlug: 'dong-ho-co',
    startingPrice: 4_200_000, bidIncrement: 200_000, buyNowPrice: null,
    startsIn: -10 * DAY, endsIn: -4 * DAY,
    bids: [[2, 4_400_000]],
  },
];

export async function seedAuctions(dataSource: DataSource, categoryIds: Map<string, string>): Promise<void> {
  const [seller, ...bidders] = await seedUsers(dataSource);

  const productRepo = dataSource.getRepository(Product);
  const imageRepo = dataSource.getRepository(ProductImage);
  const auctionRepo = dataSource.getRepository(Auction);
  const bidRepo = dataSource.getRepository(BidHistory);

  const now = Date.now();

  for (const item of AUCTIONS) {
    const categoryId = categoryIds.get(item.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug in auction seed: ${item.categorySlug}`);

    let product = await productRepo.findOne({ where: { slug: item.slug } });
    if (!product) {
      product = await productRepo.save(
        productRepo.create({
          ownerId: seller.id,
          categoryId,
          name: item.name,
          slug: item.slug,
          description: `${item.name} — hàng seed cho môi trường phát triển.`,
          condition: ProductCondition.NEW,
          status: ProductStatus.ACTIVE,
        }),
      );

    } else {
      await productRepo.update(product.id, { categoryId, name: item.name, status: ProductStatus.ACTIVE });
    }

    // Keyed off the image, not the product: re-seeding an existing database must
    // still restore images, and uploading again for a product that already has one
    // would leave the previous object orphaned in the bucket.
    if (!(await imageRepo.exists({ where: { productId: product.id } }))) {
      // Uploaded for real: product_images.file_id is a FK, so a made-up id would
      // fail, and a key with no object behind it presigns to a dead link.
      const image = await fileService.createFromUpload(
        {
          buffer: await fetchSeedImage(item.slug),
          originalname: `${item.slug}.jpg`,
          mimetype: 'image/jpeg',
        } as any,
        'seed',
        seller.id,
      );

      await imageRepo.save(
        imageRepo.create({
          productId: product.id,
          fileId: image.id,
          isPrimary: true,
          displayOrder: 0,
        }),
      );
    }

    const startDate = new Date(now + item.startsIn);
    const endDate = new Date(now + item.endsIn);
    const status = endDate.getTime() <= now
      ? AuctionStatus.ENDED
      : startDate.getTime() <= now
        ? AuctionStatus.HAPPENING
        : AuctionStatus.PENDING;

    const currentPrice = item.bids.length > 0
      ? Math.max(...item.bids.map(([, amount]) => amount))
      : item.startingPrice;

    const existing = await auctionRepo.findOne({ where: { productId: product.id } });
    const auction = existing
      ? await auctionRepo.save(
          auctionRepo.merge(existing, {
            startingPrice: item.startingPrice,
            currentPrice,
            buyNowPrice: item.buyNowPrice,
            bidIncrement: item.bidIncrement,
            status,
            startDate,
            endDate,
          }),
        )
      : await auctionRepo.save(
          auctionRepo.create({
            productId: product.id,
            startingPrice: item.startingPrice,
            currentPrice,
            buyNowPrice: item.buyNowPrice,
            reservePrice: null,
            bidIncrement: item.bidIncrement,
            status,
            startDate,
            endDate,
          }),
        );

    // Replayed from scratch each run so the counters below can never drift from
    // the rows that justify them.
    await bidRepo.delete({ auctionId: auction.id });

    if (item.bids.length > 0) {
      const span = Math.min(now, endDate.getTime()) - startDate.getTime();
      await bidRepo.save(
        item.bids.map(([bidderIndex, amount], position) =>
          bidRepo.create({
            auctionId: auction.id,
            userId: bidders[bidderIndex % bidders.length].id,
            amount,
            actionType: 'place_bid',
            position: position + 1,
            createdAt: new Date(startDate.getTime() + (span * (position + 1)) / (item.bids.length + 1)),
          }),
        ),
      );
    }

    // Same denormalization AuctionService.auctionBid maintains: bid_history stays
    // the source of truth, these columns only cache it for the listing sorts.
    await auctionRepo.update(auction.id, {
      totalBids: item.bids.length,
      bidderCount: new Set(item.bids.map(([bidderIndex]) => bidderIndex)).size,
    });
  }

  console.log(`✅ Auctions seeded: ${AUCTIONS.length} (times relative to ${new Date(now).toISOString()})`);
}

/** One seller and three bidders, upserted by email so re-runs reuse the same rows. */
async function seedUsers(dataSource: DataSource): Promise<User[]> {
  const repo = dataSource.getRepository(User);
  const bcryptService = new BcryptService();
  const passwordHash = await bcryptService.hash(SEED_PASSWORD);

  const people = [
    { username: 'seed_seller', fullname: 'Người bán Seed', email: 'seller@bidy.local' },
    { username: 'seed_bidder1', fullname: 'Người mua Một', email: 'bidder1@bidy.local' },
    { username: 'seed_bidder2', fullname: 'Người mua Hai', email: 'bidder2@bidy.local' },
    { username: 'seed_bidder3', fullname: 'Người mua Ba', email: 'bidder3@bidy.local' },
  ];

  const users: User[] = [];

  for (const person of people) {
    const existing = await repo.findOne({ where: { email: person.email } });

    users.push(
      existing ??
        (await repo.save(
          repo.create({
            ...person,
            passwordHash,
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
          }),
        )),
    );
  }

  for (const user of users) {
    await dataSource.query(
      `INSERT INTO "wallets" ("user_id", "balance", "status") VALUES ($1, 0, 'active') ON CONFLICT ("user_id") DO NOTHING`,
      [user.id],
    );
  }

  console.log(`✅ Seed users ready (password: ${SEED_PASSWORD})`);

  return users;
}

/** Seed artwork, fetched once per product so the bucket holds a real object. */
async function fetchSeedImage(slug: string): Promise<Buffer> {
  const response = await fetch(`https://picsum.photos/seed/${slug}/800/600`);
  if (!response.ok) throw new Error(`Failed to fetch seed image for ${slug}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
