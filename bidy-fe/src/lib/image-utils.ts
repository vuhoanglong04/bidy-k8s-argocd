/**
 * Utility functions for handling image URLs
 */

/**
 * Normalise an image field coming from the API.
 *
 * Backend trả một trong ba dạng: presigned URL tuyệt đối, `null`, hoặc path
 * tương đối tới asset tĩnh (ví dụ `supportAgent.avatar` fallback về
 * `/admin-avatar.png`). S3 key trần không còn tồn tại — endpoint `/images/:key`
 * đã bị xoá, muốn ký lại URL thì dùng `GET /files/:id/url`.
 *
 * @param imagePath - The image value from the API
 * @returns A URL usable by next/image
 */
export function getImageUrl(imagePath: string | undefined | null): string {
  if (!imagePath) return '/placeholder.jpg';

  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // If it starts with /, assume it's a local asset
  if (imagePath.startsWith('/')) {
    return imagePath;
  }

  return '/placeholder.jpg';
}

/**
 * Get placeholder image based on type
 */
export function getPlaceholderImage(type: 'product' | 'user' | 'default' = 'default', theme?: string): string {
  const placeholders = {
    product: '/placeholder-product.jpg',
    user: getDefaultAvatar(theme),
    default: '/placeholder.jpg'
  };

  return placeholders[type];
}

/**
 * Get default avatar based on theme
 * @param theme - Current theme ('light' | 'dark')
 * @returns Path to the appropriate default avatar
 */
export function getDefaultAvatar(theme?: string): string {
  return theme === 'dark' ? '/ava-dark.png' : '/ava-light.png';
}