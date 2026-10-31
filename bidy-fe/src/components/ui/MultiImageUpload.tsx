"use client";

import React, { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Spinner } from "@/components/common/loading";
import { cn } from "@/lib/utils";

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_MB,
} from "@/constants";

interface MultiImageUploadProps {
  images: File[];
  onChange: (images: File[]) => void;
  onError?: (error: string) => void;
  maxImages?: number;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string[];
  className?: string;
  required?: boolean;
  isUploading?: boolean; // New prop for loading state
}

interface ImagePreview {
  file: File;
  url: string;
  id: string;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  images,
  onChange,
  onError,
  maxImages = MAX_IMAGE_COUNT,
  maxFileSize = MAX_IMAGE_SIZE_MB,
  acceptedFileTypes = [...ACCEPTED_IMAGE_MIME_TYPES],
  className = "",
  required = false,
  isUploading = false, // Default to false
}) => {
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize previews when images prop changes
  React.useEffect(() => {
    // Clean up old previews first
    previews.forEach(preview => URL.revokeObjectURL(preview.url));
    
    if (images.length > 0) {
      const newPreviews = images.map((file, index) => ({
        file,
        url: URL.createObjectURL(file),
        id: `${file.name}-${index}-${file.size}-${file.lastModified}`, // Use file properties instead of Date.now()
      }));
      setPreviews(newPreviews);
    } else {
      setPreviews([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]); // Intentionally excluding previews to prevent infinite loop

  // Clean up URLs when component unmounts
  React.useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedFileTypes.includes(file.type)) {
      return `Chỉ chấp nhận file: ${acceptedFileTypes.map(type => type.split('/')[1]).join(', ')}`;
    }
    
    if (file.size > maxFileSize * 1024 * 1024) {
      return `Kích thước file không được vượt quá ${maxFileSize}MB`;
    }
    
    return null;
  }, [acceptedFileTypes, maxFileSize]);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check total images limit
    if (images.length + files.length > maxImages) {
      errors.push(`Chỉ được upload tối đa ${maxImages} hình ảnh`);
      const allowedCount = maxImages - images.length;
      files.splice(allowedCount);
    }

    // Validate each file
    files.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    // Show errors if any
    if (errors.length > 0) {
      const errorMessage = errors.join('\n');
      onError?.(errorMessage);
      toast.error(errorMessage);
      return;
    }

    if (validFiles.length === 0) return;

    // Show loading state for each file being processed
    const loadingSet = new Set(validFiles.map(file => file.name));
    setLoadingImages(loadingSet);

    try {
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update images array
      const newImages = [...images, ...validFiles];
      onChange(newImages);

      toast.success(`Đã thêm ${validFiles.length} hình ảnh thành công!`);
    } finally {
      // Clear loading state
      setLoadingImages(new Set());
    }
  }, [images, onChange, onError, maxImages, validateFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting same files again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
    toast.success("Đã xóa hình ảnh");
  };

  const reorderImages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    onChange(newImages);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <label className="block font-semibold text-foreground">
        Hình Ảnh Sản Phẩm {required && <span className="text-primary">*</span>}
        <span className="text-sm font-normal text-muted-foreground ml-2">
          (Tối đa {maxImages} hình, mỗi hình &lt; {maxFileSize}MB)
        </span>
      </label>

      {/* Upload Area */}
      <div
        className={cn(
          "relative cursor-pointer border-2 border-dashed p-6 transition-colors duration-200",
          isDragOver
            ? "border-primary bg-accent-subtle"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="text-4xl text-primary">
            {isDragOver ? '📤' : '📷'}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium text-foreground">
              {isDragOver 
                ? 'Thả hình ảnh vào đây' 
                : 'Kéo thả hoặc click để chọn hình ảnh'
              }
            </p>
            <p className="text-sm text-muted-foreground">
              Hỗ trợ: {acceptedFileTypes.map((type) => type.split('/')[1].toUpperCase()).join(', ')} • Tối đa {maxImages} hình • Mỗi hình &lt; {maxFileSize}MB
            </p>
          </div>
          
          {images.length > 0 && (
            <div className="text-sm text-primary font-medium">
              Đã chọn {images.length}/{maxImages} hình ảnh
            </div>
          )}
        </div>
      </div>

      {/* Image Previews Grid */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Hình ảnh đã chọn</h3>
            <button
              type="button"
              onClick={() => onChange([])}
              className="border border-destructive/40 px-2 py-1 text-sm text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              Xóa tất cả
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-96 overflow-y-auto scrollbar-thin">
            {previews.map((preview, index) => (
              <div
                key={preview.id}
                className="group relative overflow-hidden border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                {/* Image */}
                <div className="aspect-square relative bg-muted">
                  {loadingImages.has(preview.file.name) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <Spinner size="lg" label="Đang xử lý hình ảnh" />
                    </div>
                  ) : (
                    <Image
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, (max-width: 1536px) 25vw, 20vw"
                      onError={(e) => {
                        console.error('Image load error:', e);
                        // Fallback to a placeholder or show error state
                      }}
                    />
                  )}
                  
                  {/* Primary indicator */}
                  {index === 0 && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                      Chính
                    </div>
                  )}
                  
                  {/* Image counter */}
                  <div className="absolute top-2 right-2 rounded-full bg-overlay px-2 py-1 text-xs text-primary-foreground">
                    {index + 1}
                  </div>
                </div>

                {/* Controls */}
                <div className="p-2 space-y-2">
                  <div className="text-xs text-muted-foreground truncate">
                    {preview.file.name}
                  </div>
                  
                  <div className="flex gap-1">
                    {/* Move Left */}
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderImages(index, index - 1);
                        }}
                        className="flex-1 border border-border bg-muted px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary-hover disabled:opacity-50"
                        title="Di chuyển lên trước"
                        disabled={isUploading || loadingImages.size > 0}
                      >
                        ←
                      </button>
                    )}
                    
                    {/* Move Right */}
                    {index < previews.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderImages(index, index + 1);
                        }}
                        className="flex-1 border border-border bg-muted px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary-hover disabled:opacity-50"
                        title="Di chuyển xuống sau"
                        disabled={isUploading || loadingImages.size > 0}
                      >
                        →
                      </button>
                    )}
                    
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(index);
                      }}
                      className="bg-destructive px-2 py-1 text-xs text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      title="Xóa hình này"
                      disabled={isUploading || loadingImages.size > 0}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Add more button */}
          {images.length < maxImages && (
            <button
              type="button"
              onClick={openFileDialog}
              className="w-full border-2 border-dashed border-primary/30 py-3 font-medium text-primary transition-colors hover:border-primary hover:bg-accent-subtle disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isUploading || loadingImages.size > 0}
            >
              {isUploading || loadingImages.size > 0 
                ? 'Đang tải lên...' 
                : `+ Thêm hình ảnh (${images.length}/${maxImages})`}
            </button>
          )}
        </div>
      )}

      {/* Helper Text */}
      <ol className="ml-6 list-decimal text-xs text-muted-foreground [&>li]:mt-1">
        <li>Hình ảnh đầu tiên sẽ làm hình ảnh chính của sản phẩm</li>
        <li>Click nút mũi tên để thay đổi thứ tự hình ảnh</li>
        <li>Kéo thả nhiều hình cùng lúc để upload nhanh</li>
        <li>Tối đa {maxImages} hình ảnh, có thể cuộn để xem tất cả</li>
      </ol>

      {/* Loading indicator for overall upload process */}
      {isUploading && (
        <div className="flex items-center gap-2 border border-primary/20 bg-accent-subtle p-3">
          <Spinner size="sm" label={null} />
          <span className="text-sm font-medium text-primary">Đang tải lên {images.length} hình ảnh...</span>
        </div>
      )}
    </div>
  );
};

export default MultiImageUpload;