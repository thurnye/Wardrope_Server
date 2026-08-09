export const WARDROBE_CATEGORIES = [
  'top',
  'bottom',
  'one-piece',
  'outerwear',
  'footwear',
  'bag',
  'accessory',
  'jewelry',
] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export const WARDROBE_PATTERNS = [
  'solid',
  'striped',
  'checked',
  'plaid',
  'floral',
  'graphic',
  'geometric',
  'animal-print',
  'other',
] as const;

export type WardrobePattern = (typeof WARDROBE_PATTERNS)[number];

export interface WardrobeItemDto {
  id: string;
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  brand: string | null;
  colors: string[];
  materials: string[];
  pattern: WardrobePattern | null;
  size: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWardrobeItemDto {
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  brand?: string | null;
  colors: string[];
  materials?: string[];
  pattern?: WardrobePattern | null;
  size?: string | null;
  favorite?: boolean;
}

export interface UpdateWardrobeItemDto {
  name?: string;
  category?: WardrobeCategory;
  subcategory?: string;
  brand?: string | null;
  colors?: string[];
  materials?: string[];
  pattern?: WardrobePattern | null;
  size?: string | null;
  favorite?: boolean;
}

export interface WardrobeListQueryDto {
  page: number;
  pageSize: number;
  category?: WardrobeCategory;
  favorite?: boolean;
  search?: string;
}

export interface WardrobeListDto {
  items: WardrobeItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
