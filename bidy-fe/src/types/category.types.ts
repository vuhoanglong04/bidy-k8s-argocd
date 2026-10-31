// Legacy database category interface - kept for backward compatibility
export interface Category {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

// New static category interface
export interface StaticCategory {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
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

// Unified category interface that can handle both types
export interface UnifiedCategory {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  image?: string;
  icon?: string;
  slug?: string;
  href?: string;
  badge?: {
    text: string;
    color: string;
  };
  color?: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  isActive?: boolean;
  order?: number;
}

export interface Product {
  _id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  seller: string;
  status: 'active' | 'inactive' | 'sold' | 'expired';
  createdAt: string;
  updatedAt: string;
  endTime?: string;
  currentBid?: number;
  totalBids?: number;
}

export interface Auction {
  _id: string;
  title: string;
  description: string;
  startPrice: number;
  currentBid: number;
  images: string[];
  category: string | { _id: string; name: string };
  seller: string;
  status: 'active' | 'inactive' | 'ended' | 'cancelled';
  endTime: string;
  startTime: string;
  totalBids: number;
  createdAt: string;
  updatedAt: string;
}