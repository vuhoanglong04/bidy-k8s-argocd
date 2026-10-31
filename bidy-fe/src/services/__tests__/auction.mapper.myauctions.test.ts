import { mapAuctionToFrontend, type ApiAuction } from '../auction.mapper';

/** Trích từ payload thật của GET /auctions/user/my-auctions. */
const row = {
  id: '18',
  productId: '27',
  product: {
    id: '27',
    categoryId: '4',
    category: { id: '4', name: 'Máy tính xách tay' },
    name: 'Miếng đất VINHOME chỉ 4 tỉ đồng trên m2',
    description: 'chỉ 4 tỉ cho 1 căn hộ bé như chuồng gà',
    condition: 'used',
    status: 'active',
    images: [
      { id: '36', isPrimary: true, imageUrl: 'https://r2/img1.jpg?sig=a' },
      { id: '37', isPrimary: false, imageUrl: 'https://r2/img2.jpg?sig=b' },
    ],
  },
  startingPrice: '5111.00',
  currentPrice: '5111.00',
  buyNowPrice: '32323.00',
  bidderCount: 0,
  totalBids: 0,
  status: 'happening',
  startDate: '2026-08-16T09:59:01.313Z',
  endDate: '2026-08-19T09:58:24.741Z',
  createdAt: '2026-08-16T09:58:31.318Z',
} as unknown as ApiAuction;

describe('my-auctions: payload lồng -> shape card đọc được', () => {
  const m = mapAuctionToFrontend(row);

  it('kéo tên và ảnh từ product lên', () => {
    expect(m.name).toBe('Miếng đất VINHOME chỉ 4 tỉ đồng trên m2');
    expect(m.image).toEqual(['https://r2/img1.jpg?sig=a', 'https://r2/img2.jpg?sig=b']);
  });

  it('ép giá decimal dạng chuỗi về number', () => {
    expect(m.startingPrice).toBe(5111);
    expect(m.currentPrice).toBe(5111);
    expect(m.buyNow).toBe(32323);
  });

  it('giữ id, trạng thái và mốc thời gian', () => {
    expect(m.id).toBe('18');
    expect(m.status).toBe('happening');
    expect(m.endDate).toBe('2026-08-19T09:58:24.741Z');
  });

  it('kéo categoryId lên để lọc theo danh mục chạy được', () => {
    expect(m.categoryId).toBe('4');
    expect(m.categoryName).toBe('Máy tính xách tay');
  });

  it('đếm lượt đấu từ totalBids/bidderCount, không phải top_ownerships', () => {
    expect(m.totalBids).toBe(0);
    expect(m.bidderCount).toBe(0);
  });
});
