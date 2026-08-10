export const FRAGRANCE_CONCENTRATIONS = [
  'eau-de-cologne',
  'eau-de-toilette',
  'eau-de-parfum',
  'parfum',
  'extrait-de-parfum',
  'other',
] as const;
export type FragranceConcentration = (typeof FRAGRANCE_CONCENTRATIONS)[number];

export interface FragrancePurchasePriceDto {
  amount: number;
  currency: string;
}

export interface FragranceImageDto {
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: string;
}

export interface FragranceDto {
  id: string;
  brand: string;
  name: string;
  productLine: string | null;
  concentration: FragranceConcentration | null;
  fragranceFamily: string | null;
  scentType: string | null;
  keyNotes: string[];
  bottleSizeMl: number | null;
  amountRemainingPercent: number | null;
  purchaseDate: string | null;
  purchasePrice: FragrancePurchasePriceDto | null;
  available: boolean;
  sourceUrl?: string | null;
  image: FragranceImageDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFragranceDto {
  brand: string;
  name: string;
  productLine?: string | null | undefined;
  concentration?: FragranceConcentration | null | undefined;
  fragranceFamily?: string | null | undefined;
  scentType?: string | null | undefined;
  keyNotes?: string[] | undefined;
  bottleSizeMl?: number | null | undefined;
  amountRemainingPercent?: number | null | undefined;
  purchaseDate?: string | null | undefined;
  purchasePrice?: FragrancePurchasePriceDto | null | undefined;
  available?: boolean | undefined;
  sourceUrl?: string | null | undefined;
}

export interface UpdateFragranceDto {
  brand?: string | undefined;
  name?: string | undefined;
  productLine?: string | null | undefined;
  concentration?: FragranceConcentration | null | undefined;
  fragranceFamily?: string | null | undefined;
  scentType?: string | null | undefined;
  keyNotes?: string[] | undefined;
  bottleSizeMl?: number | null | undefined;
  amountRemainingPercent?: number | null | undefined;
  purchaseDate?: string | null | undefined;
  purchasePrice?: FragrancePurchasePriceDto | null | undefined;
  available?: boolean | undefined;
  sourceUrl?: string | null | undefined;
}

export interface FragranceImportPreviewDto {
  sourceUrl: string;
  brand: string | null;
  name: string | null;
  concentration: FragranceConcentration | null;
  imageUrls: string[];
}

export interface FragranceListQueryDto {
  page: number;
  pageSize: number;
  available?: boolean | undefined;
  concentration?: FragranceConcentration | undefined;
  search?: string | undefined;
}

export interface FragranceListDto {
  items: FragranceDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
