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

export interface WardrobeImageDto {
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: string;
}

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
  sourceUrl: string | null;
  image: WardrobeImageDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWardrobeItemDto {
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  brand?: string | null | undefined;
  colors: string[];
  materials?: string[] | undefined;
  pattern?: WardrobePattern | null | undefined;
  size?: string | null | undefined;
  favorite?: boolean | undefined;
  sourceUrl?: string | null | undefined;
}

export interface UpdateWardrobeItemDto {
  name?: string | undefined;
  category?: WardrobeCategory | undefined;
  subcategory?: string | undefined;
  brand?: string | null | undefined;
  colors?: string[] | undefined;
  materials?: string[] | undefined;
  pattern?: WardrobePattern | null | undefined;
  size?: string | null | undefined;
  favorite?: boolean | undefined;
  sourceUrl?: string | null | undefined;
}

export interface ProductImportPreviewDto {
  sourceUrl: string;
  name: string | null;
  brand: string | null;
  colors: string[];
  materials: string[];
  suggestedCategory: WardrobeCategory | null;
  suggestedSubcategory: string | null;
  imageAvailable: boolean;
}

export interface WardrobeListQueryDto {
  page: number;
  pageSize: number;
  category?: WardrobeCategory | undefined;
  favorite?: boolean | undefined;
  search?: string | undefined;
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
