/**
 * Maps image URLs to proper format for Next.js Image component
 *
 * Backend trả presigned URL tuyệt đối (hoặc path tương đối tới asset tĩnh).
 * S3 key trần không còn ghép được thành URL — endpoint `/images/:key` đã bị xoá.
 *
 * @param images - Array of image URLs or filenames
 * @returns Array of properly formatted image URLs
 */
export function mapImageUrls(images: string[] | string | undefined): string[] {
  if (!images) {
    return ["/images.jpeg"];
  }

  const imageArray = Array.isArray(images) ? images : [images];

  // Mảng rỗng cũng phải rơi về ảnh mặc định: mọi call-site đều index thẳng
  // `[0]`, và `<Image src={undefined}>` làm React preload một href rỗng.
  if (imageArray.length === 0) {
    return ["/images.jpeg"];
  }

  return imageArray.map(mapImageUrl);
}

/**
 * Maps a single image URL to proper format
 * @param image - Image URL or filename
 * @returns Properly formatted image URL
 */
export function mapImageUrl(image: string | undefined): string {
  if (!image) {
    return "/images.jpeg";
  }

  if (image.startsWith("/") || image.startsWith("http")) {
    return image;
  }

  return "/images.jpeg";
}
