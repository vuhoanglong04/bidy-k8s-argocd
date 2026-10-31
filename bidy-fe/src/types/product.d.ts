// API Product interface for data coming from the backend
export interface ApiProductData {
  id: string | number;
  name?: string;
  image?: string[];
  images?: string[];
  description?: string;
  startingPrice?: string | number;
  buyNow?: string | number;
  currentPrice?: string | number;
  finalPrice?: string | number;
  timeLeft?: string;
  endTime?: string;
  seller: string;
  sellerId?: number;
  location?: string;
  category?: string;
  condition?: string;
  status?: string;
  type?: string;
  views?: number;
  createdAt?: string;
  updatedAt?: string;
  isWatched?: boolean;
  owner?: {
    _id?: string | number;
    full_name?: string;
  };
} 