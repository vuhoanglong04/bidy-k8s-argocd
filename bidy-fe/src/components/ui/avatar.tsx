import React from 'react';
import Image from 'next/image';

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
}

interface AvatarImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

interface AvatarFallbackProps {
  className?: string;
  children?: React.ReactNode;
}

export const Avatar: React.FC<AvatarProps> = ({ className = '', children }) => {
  return (
    <div className={`relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}>
      {children}
    </div>
  );
};

export const AvatarImage: React.FC<AvatarImageProps> = ({ src, alt, className = '' }) => {
  if (!src) return null;
  
  return (
    <Image
      className={`aspect-square object-cover ${className}`}
      src={src}
      alt={alt || ''}
      fill
      sizes="40px"
    />
  );
};

export const AvatarFallback: React.FC<AvatarFallbackProps> = ({ className = '', children }) => {
  return (
    <div className={`flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 ${className}`}>
      {children}
    </div>
  );
};