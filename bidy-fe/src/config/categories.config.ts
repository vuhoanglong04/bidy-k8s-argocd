export interface StaticCategory {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string; // Path to icon in public/categories
  slug: string;
  keywords: string[];
  color: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  badge?: {
    text: string;
    color: string;
  };
  order: number;
  isActive: boolean;
}

// Complete list of 16 categories matching the reference image
export const CATEGORIES: StaticCategory[] = [
  {
    id: 'bat-dong-san',
    name: 'Bất động sản',
    displayName: 'Bất động sản',
    description: 'Nhà đất, căn hộ, đất nền, nhà phố, biệt thự',
    icon: '/categories/do-gia-dung.webp', // Closest match for real estate
    slug: 'bat-dong-san',
    keywords: ['nhà', 'đất', 'căn hộ', 'chung cư', 'biệt thự', 'nhà phố', 'đất nền'],
    color: {
      primary: '#FF5722',
      secondary: '#FFA726',
      gradient: 'bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50'
    },
    order: 1,
    isActive: true
  },
  {
    id: 'xe-co',
    name: 'Xe cộ',
    displayName: 'Xe cộ',
    description: 'Ô tô, xe máy, xe tải, xe điện, phụ tùng',
    icon: '/categories/xe-co.jpeg',
    slug: 'xe-co',
    keywords: ['xe', 'ô tô', 'xe máy', 'xe tải', 'xe điện', 'phụ tùng', 'honda', 'toyota'],
    color: {
      primary: '#2196F3',
      secondary: '#64B5F6',
      gradient: 'bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50'
    },
    badge: {
      text: 'HOT',
      color: 'bg-red-500'
    },
    order: 2,
    isActive: true
  },
  {
    id: 'thu-cung',
    name: 'Thú cưng',
    displayName: 'Thú cưng',
    description: 'Chó, mèo, thú cưng các loại, phụ kiện thú cưng',
    icon: '/categories/thu-cung.webp',
    slug: 'thu-cung',
    keywords: ['chó', 'mèo', 'thú cưng', 'pet', 'động vật', 'chim', 'cá cảnh'],
    color: {
      primary: '#9C27B0',
      secondary: '#BA68C8',
      gradient: 'bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50'
    },
    order: 3,
    isActive: true
  },
  {
    id: 'do-gia-dung-noi-that-cay-canh',
    name: 'Đồ gia dụng, nội thất, cây cảnh',
    displayName: 'Đồ gia dụng, nội thất, cây cảnh',
    description: 'Nội thất, đồ gia dụng, cây cảnh, trang trí nhà cửa',
    icon: '/categories/do-gia-dung.webp',
    slug: 'do-gia-dung-noi-that-cay-canh',
    keywords: ['nội thất', 'bàn', 'ghế', 'tủ', 'giường', 'cây cảnh', 'gia dụng', 'trang trí'],
    color: {
      primary: '#4CAF50',
      secondary: '#66BB6A',
      gradient: 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50'
    },
    order: 4,
    isActive: true
  },
  {
    id: 'giai-tri-the-thao-so-thich',
    name: 'Giải trí, Thể thao, Sở thích',
    displayName: 'Giải trí, Thể thao, Sở thích',
    description: 'Dụng cụ thể thao, nhạc cụ, sách, đồ sưu tầm',
    icon: '/categories/giai-tri-the-thao.webp',
    slug: 'giai-tri-the-thao-so-thich',
    keywords: ['thể thao', 'gym', 'yoga', 'bóng đá', 'tennis', 'guitar', 'piano', 'sách', 'game'],
    color: {
      primary: '#FFC107',
      secondary: '#FFCA28',
      gradient: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50'
    },
    order: 5,
    isActive: true
  },
  {
    id: 'me-va-be',
    name: 'Mẹ và bé',
    displayName: 'Mẹ và bé',
    description: 'Đồ cho mẹ và bé, xe đẩy, đồ chơi, quần áo trẻ em',
    icon: '/categories/me-va-be.webp',
    slug: 'me-va-be',
    keywords: ['mẹ', 'bé', 'trẻ em', 'sữa', 'bỉm', 'xe đẩy', 'đồ chơi', 'quần áo trẻ em'],
    color: {
      primary: '#E91E63',
      secondary: '#F06292',
      gradient: 'bg-gradient-to-br from-pink-50 via-rose-50 to-red-50'
    },
    order: 6,
    isActive: true
  },
  {
    id: 'cho-tang-mien-phi',
    name: 'Cho tặng miễn phí',
    displayName: 'Cho tặng miễn phí',
    description: 'Đồ cho tặng, đồ cũ còn tốt, đồ dùng miễn phí',
    icon: '/categories/phan-qua-mien-phi.webp',
    slug: 'cho-tang-mien-phi',
    keywords: ['cho', 'tặng', 'miễn phí', 'free', 'đồ cũ', 'tặng miễn phí'],
    color: {
      primary: '#8BC34A',
      secondary: '#9CCC65',
      gradient: 'bg-gradient-to-br from-green-50 via-lime-50 to-emerald-50'
    },
    badge: {
      text: 'FREE',
      color: 'bg-green-500'
    },
    order: 7,
    isActive: true
  },
  {
    id: 'do-dien-tu',
    name: 'Đồ điện tử',
    displayName: 'Đồ điện tử',
    description: 'Điện thoại, laptop, máy tính, thiết bị điện tử',
    icon: '/categories/do-dien-tu.webp',
    slug: 'do-dien-tu',
    keywords: ['điện tử', 'điện thoại', 'iphone', 'samsung', 'laptop', 'máy tính', 'pc', 'tablet'],
    color: {
      primary: '#795548',
      secondary: '#8D6E63',
      gradient: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50'
    },
    order: 8,
    isActive: true
  },
  {
    id: 'do-dung-van-phong-cong-nong-nghiep',
    name: 'Đồ dùng văn phòng, công nông nghiệp',
    displayName: 'Đồ dùng văn phòng, công nông nghiệp',
    description: 'Thiết bị văn phòng, máy in, máy photocopy, dụng cụ công nghiệp',
    icon: '/categories/do-dung-van-phong-cong-nong-nghiep.webp',
    slug: 'do-dung-van-phong-cong-nong-nghiep',
    keywords: ['văn phòng', 'máy in', 'máy photocopy', 'bàn làm việc', 'ghế văn phòng', 'công nghiệp'],
    color: {
      primary: '#9E9E9E',
      secondary: '#BDBDBD',
      gradient: 'bg-gradient-to-br from-neutral-50 via-gray-50 to-slate-50'
    },
    order: 9,
    isActive: true
  },
  {
    id: 'thoi-trang-do-dung-ca-nhan',
    name: 'Thời trang, Đồ dùng cá nhân',
    displayName: 'Thời trang, Đồ dùng cá nhân',
    description: 'Quần áo, giày dép, túi xách, phụ kiện thời trang',
    icon: '/categories/thoi-trang-do-dung-ca-nhan.webp',
    slug: 'thoi-trang-do-dung-ca-nhan',
    keywords: ['thời trang', 'quần áo', 'giày', 'dép', 'túi xách', 'phụ kiện', 'đồng hồ', 'mỹ phẩm'],
    color: {
      primary: '#FF4081',
      secondary: '#FF80AB',
      gradient: 'bg-gradient-to-br from-pink-50 via-fuchsia-50 to-purple-50'
    },
    order: 10,
    isActive: true
  },
  {
    id: 'tat-ca-danh-muc',
    name: 'Tất cả danh mục',
    displayName: 'Tất cả danh mục',
    description: 'Xem tất cả các danh mục sản phẩm',
    icon: '/categories/tat-ca-danh-muc.webp',
    slug: 'tat-ca',
    keywords: ['tất cả', 'all', 'danh mục', 'category'],
    color: {
      primary: '#424242',
      secondary: '#616161',
      gradient: 'bg-gradient-to-br from-gray-50 via-neutral-50 to-slate-50'
    },
    badge: {
      text: 'ALL',
      color: 'bg-gradient-to-r from-green-500 to-green-600'
    },
    order: 11,
    isActive: true
  }
];

// Helper functions
export const getCategoryById = (id: string): StaticCategory | undefined => {
  return CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryBySlug = (slug: string): StaticCategory | undefined => {
  return CATEGORIES.find(cat => cat.slug === slug);
};

export const getActiveCategories = (): StaticCategory[] => {
  return CATEGORIES.filter(cat => cat.isActive).sort((a, b) => a.order - b.order);
};

export const searchCategories = (keyword: string): StaticCategory[] => {
  const lowerKeyword = keyword.toLowerCase();
  return CATEGORIES.filter(cat => 
    cat.name.toLowerCase().includes(lowerKeyword) ||
    cat.description.toLowerCase().includes(lowerKeyword) ||
    cat.keywords.some(k => k.toLowerCase().includes(lowerKeyword))
  );
};

// Category groups for organized display
export const CATEGORY_GROUPS = {
  essential: ['bat-dong-san', 'xe-co', 'do-dien-tu'],
  lifestyle: ['thu-cung', 'do-gia-dung-noi-that-cay-canh', 'thoi-trang-do-dung-ca-nhan', 'me-va-be'],
  services: ['do-dung-van-phong-cong-nong-nghiep'],
  others: ['giai-tri-the-thao-so-thich', 'cho-tang-mien-phi']
};

// Export default categories for backward compatibility
export default CATEGORIES;