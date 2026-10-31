import { CATEGORIES, getCategoryById, getCategoryBySlug, getActiveCategories, searchCategories } from '@/config/categories.config';
import { StaticCategory, UnifiedCategory } from '@/types/category.types';
import { APP_ROUTES } from './routes.constants';

// Re-export category data and helpers
export { CATEGORIES, getCategoryById, getCategoryBySlug, getActiveCategories, searchCategories };

// Category route helpers
export const getCategoryRoute = (category: StaticCategory): string => {
  // Special case for "All Categories" - route to /category/all instead of /category/tat-ca
  if (category.id === 'tat-ca-danh-muc' || category.slug === 'tat-ca') {
    return APP_ROUTES.CATEGORY_ALL;
  }
  return APP_ROUTES.CATEGORY_DETAIL(category.slug);
};

export const getCategoryRouteById = (id: string): string => {
  const category = getCategoryById(id);
  return category ? getCategoryRoute(category) : APP_ROUTES.CATEGORY_ALL;
};

// Convert static category to unified format for UI components
export const toUnifiedCategory = (category: StaticCategory): UnifiedCategory => {
  return {
    id: category.id,
    name: category.name,
    displayName: category.displayName,
    description: category.description,
    icon: category.icon,
    slug: category.slug,
    href: getCategoryRoute(category),
    badge: category.badge,
    color: category.color,
    isActive: category.isActive,
    order: category.order
  };
};

// Get categories for home page display (showing all 16 categories in 2 rows)
export const getHomepageCategories = (): UnifiedCategory[] => {
  const activeCategories = getActiveCategories();
  // Show all categories including "Tất cả" at the end
  return activeCategories.map(toUnifiedCategory);
};

// Get popular categories (categories with badges or specific IDs)
export const getPopularCategories = (): UnifiedCategory[] => {
  const popularIds = ['xe-co', 'do-dien-tu', 'cho-tang-mien-phi'];
  return popularIds
    .map(id => getCategoryById(id))
    .filter(Boolean)
    .map(cat => toUnifiedCategory(cat!));
};

// Category color utilities
export const getCategoryGradient = (categoryId: string): string => {
  const category = getCategoryById(categoryId);
  return category?.color.gradient || 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50';
};

export const getCategoryPrimaryColor = (categoryId: string): string => {
  const category = getCategoryById(categoryId);
  return category?.color.primary || '#9CA3AF';
};

// Category validation
export const isValidCategoryId = (id: string): boolean => {
  return getCategoryById(id) !== undefined;
};

export const isValidCategorySlug = (slug: string): boolean => {
  return getCategoryBySlug(slug) !== undefined;
};

// Search and filter helpers
export const filterCategoriesByGroup = (group: 'essential' | 'lifestyle' | 'services' | 'others'): StaticCategory[] => {
  const categoryGroups = {
    essential: ['bat-dong-san', 'xe-co', 'do-dien-tu'],
    lifestyle: ['thu-cung', 'do-gia-dung', 'thoi-trang', 'me-va-be'],
    services: ['do-dung-van-phong'],
    others: ['giai-tri-the-thao', 'cho-tang-mien-phi']
  };
  
  const groupIds = categoryGroups[group] || [];
  return groupIds
    .map(id => getCategoryById(id))
    .filter(Boolean) as StaticCategory[];
};

// Get category suggestions based on keywords
export const getCategorySuggestions = (keywords: string[]): StaticCategory[] => {
  if (!keywords.length) return [];
  
  const suggestions = new Set<StaticCategory>();
  
  keywords.forEach(keyword => {
    const found = searchCategories(keyword);
    found.forEach(cat => suggestions.add(cat));
  });
  
  return Array.from(suggestions).slice(0, 5);
};

// Enhanced category filtering - works with both ObjectIds and slug formats
export const isProductInCategories = (productCategory: string | undefined, selectedCategories: string[]): boolean => {
  if (!selectedCategories.length) return true;
  if (!productCategory) return false;
  
  // Direct match (ObjectId or slug)
  if (selectedCategories.includes(productCategory)) {
    return true;
  }
  
  // Try to match by slug - get category by selected slug and compare with product category
  for (const selectedSlug of selectedCategories) {
    const category = getCategoryBySlug(selectedSlug) || getCategoryById(selectedSlug);
    if (category) {
      // Create slug-to-ObjectId mapping for common categories
      // This maps frontend slugs to backend category ObjectIds
      const categoryMapping: Record<string, string> = {
        'bat-dong-san': '68b5b224af654f297cba1723',
        'xe-co': '68b5b224af654f297cba1726',
        'thu-cung': '68b5b224af654f297cba1729',
        'do-gia-dung-noi-that-cay-canh': '68b5b224af654f297cba172c',
        'giai-tri-the-thao-so-thich': '68b5b224af654f297cba172f',
        'me-va-be': '68b5b225af654f297cba1732',
        'cho-tang-mien-phi': '68b5b225af654f297cba1738',
        'do-dien-tu': '68b5b226af654f297cba173e',
        'do-dung-van-phong-cong-nong-nghiep': '68b5b226af654f297cba1744',
        'thoi-trang-do-dung-ca-nhan': '68b5b226af654f297cba1747',
      };
      
      const mappedObjectId = categoryMapping[selectedSlug];
      if (mappedObjectId && productCategory === mappedObjectId) {
        return true;
      }
    }
  }
  
  return false;
};

// Category breadcrumb helper
export const getCategoryBreadcrumb = (categoryId: string) => {
  const category = getCategoryById(categoryId);
  if (!category) return [];
  
  return [
    { name: 'Trang chủ', href: '/' },
    { name: 'Danh mục', href: APP_ROUTES.CATEGORY },
    { name: category.displayName, href: getCategoryRoute(category) }
  ];
};

// Named exports provide better tree-shaking and type safety
// Default export maintained for legacy compatibility but prefer named imports