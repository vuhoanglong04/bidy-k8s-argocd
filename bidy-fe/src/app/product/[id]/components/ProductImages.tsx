"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Expand, ImageOff, ZoomIn } from "lucide-react";
import { Spinner } from "@/components/common/loading";
import ImageGalleryModal from "./ImageGalleryModal";

interface ProductImagesProps {
  images: string[];
  productName: string;
}

const FALLBACK_IMAGE = "/images.jpeg";

export default function ProductImages({ images, productName }: ProductImagesProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialIndex, setModalInitialIndex] = useState(0);
  const [mainImageLoading, setMainImageLoading] = useState(true);
  const [mainImageError, setMainImageError] = useState(false);

  // Sản phẩm không ảnh vẫn phải render được: `<Image src="">` khiến React gọi
  // `preload()` với href rỗng, và `priority` biến nó thành cảnh báo mỗi lần vào
  // trang. Lọc chuỗi rỗng rồi mới rơi về ảnh mặc định.
  const gallery = useMemo(() => {
    const usable = images.filter((src) => Boolean(src?.trim()));
    return usable.length > 0 ? usable : [FALLBACK_IMAGE];
  }, [images]);

  // Ảnh có thể đổi khi query trả về muộn — kẹp index lại cho khỏi trỏ ra ngoài.
  const activeIndex = Math.min(selectedImage, gallery.length - 1);

  const maxThumbnails = Math.min(5, gallery.length);
  const showMoreButton = gallery.length > maxThumbnails;

  const openModal = (index: number = activeIndex) => {
    setModalInitialIndex(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleMainImageLoad = () => {
    setMainImageLoading(false);
    setMainImageError(false);
  };

  const handleMainImageError = () => {
    setMainImageLoading(false);
    setMainImageError(true);
  };

  const handleThumbnailClick = (idx: number) => {
    setSelectedImage(idx);
    setMainImageLoading(true);
    setMainImageError(false);
  };

  return (
    <div className="flex flex-col gap-3 w-full min-h-0">
      {/* Main Image */}
      <div
        className="relative w-full aspect-square overflow-hidden bg-muted group cursor-pointer border border-border"
        onClick={() => openModal(activeIndex)}
      >
        {/* Loading */}
        {mainImageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <Spinner size="lg" tone="muted" label="Đang tải ảnh" />
          </div>
        )}

        {/* Error State */}
        {mainImageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted z-10">
            <ImageOff className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Không tải được ảnh</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMainImageError(false);
                setMainImageLoading(true);
              }}
              className="px-3 py-1 bg-primary text-primary-foreground text-xs hover:bg-primary-hover transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        <Image
          src={gallery[activeIndex]}
          alt={productName}
          width={800}
          height={800}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            mainImageLoading ? "opacity-0" : "opacity-100"
          }`}
          onLoad={handleMainImageLoad}
          onError={handleMainImageError}
          priority
        />

        {/* Zoom indicator */}
        <div className="absolute inset-0 bg-overlay/0 group-hover:bg-overlay/40 transition-colors duration-300 flex items-center justify-center pointer-events-none">
          <ZoomIn className="w-8 h-8 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>

        {/* Image counter */}
        {gallery.length > 1 && !mainImageLoading && !mainImageError && (
          <div className="absolute bottom-0 right-0 bg-overlay/70 text-primary-foreground px-3 py-1 text-xs font-medium tracking-wider pointer-events-none">
            {activeIndex + 1} / {gallery.length}
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      <div className="flex items-center gap-2 w-full overflow-x-auto scrollbar-hide">
        {gallery.slice(0, maxThumbnails).map((img, idx) => (
          <button
            key={idx}
            onClick={() => handleThumbnailClick(idx)}
            className={`flex-shrink-0 w-16 h-16 overflow-hidden border transition-colors duration-200 bg-muted ${
              activeIndex === idx
                ? "border-primary"
                : "border-border hover:border-foreground-secondary"
            }`}
          >
            <Image
              src={img}
              alt={`${productName} thumbnail ${idx + 1}`}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </button>
        ))}

        {/* Show All Images Button */}
        {showMoreButton && (
          <button
            onClick={() => openModal(0)}
            className="flex-shrink-0 w-16 h-16 border border-border hover:border-foreground-secondary transition-colors duration-200 bg-muted flex flex-col items-center justify-center gap-0.5"
            title="Xem tất cả ảnh"
          >
            <Expand className="w-4 h-4 text-foreground-secondary" />
            <span className="text-xs text-foreground-secondary font-medium leading-none">
              +{gallery.length - maxThumbnails}
            </span>
          </button>
        )}
      </div>

      {/* Image Gallery Modal */}
      <ImageGalleryModal
        images={gallery}
        isOpen={isModalOpen}
        onClose={closeModal}
        initialIndex={modalInitialIndex}
        productName={productName}
      />
    </div>
  );
}
