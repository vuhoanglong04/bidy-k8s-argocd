"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface ImageGalleryModalProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  productName: string;
}

export default function ImageGalleryModal({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
  productName,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setImageLoading(true);
    setImageError(false);
  }, [initialIndex]);

  // Reset loading state when current index changes
  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [currentIndex]);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
          break;
      }
    },
    [isOpen, onClose, images.length]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full h-full max-w-7xl max-h-screen p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-white">
            <h2 className="text-lg font-semibold">{productName}</h2>
            <p className="text-sm text-white/70">
              {currentIndex + 1} of {images.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white hover:text-white/70 transition-colors"
            aria-label="Close gallery"
          >
            <X size={24} />
          </button>
        </div>

        {/* Main Image Area */}
        <div className="flex-1 flex items-center justify-center relative min-h-0">
          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={goToPrevious}
              className="absolute left-4 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Loading Spinner */}
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            )}
            
            {/* Error State */}
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="text-center text-white">
                  <div className="text-lg mb-2">Failed to load image</div>
                  <button
                    onClick={() => {
                      setImageError(false);
                      setImageLoading(true);
                    }}
                    className="px-4 py-2 bg-white/20 rounded hover:bg-white/30 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            
            {/* Actual Image */}
            <Image
              src={images[currentIndex]}
              alt={`${productName} - Image ${currentIndex + 1}`}
              width={1000}
              height={1000}
              className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              priority
            />
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <button
              onClick={goToNext}
              className="absolute right-4 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <div className="mt-4 flex justify-center">
            <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => goToImage(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    currentIndex === index
                      ? "border-white scale-110"
                      : "border-white/30 hover:border-white/70"
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                >
                  <Image
                    src={img}
                    alt={`Thumbnail ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Touch/Swipe Instructions for Mobile */}
        <div className="mt-2 text-center text-white/50 text-sm md:hidden">
          Swipe left or right to navigate • Tap outside to close
        </div>
      </div>
    </div>
  );
}