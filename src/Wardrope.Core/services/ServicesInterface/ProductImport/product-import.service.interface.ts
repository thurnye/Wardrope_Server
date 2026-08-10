import type {
  ProductImportPreviewDto,
  WardrobeItemDto,
} from '../../../Models/Wardrobe/wardrobe.model';

export type ProductImportPreviewFailureReason =
  | 'SOURCE_URL_NOT_ALLOWED'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_TOO_LARGE'
  | 'UNSUPPORTED_SOURCE'
  | 'PRODUCT_NOT_RECOGNIZED';

export type ProductImportPreviewResult =
  | { ok: true; preview: ProductImportPreviewDto }
  | { ok: false; reason: ProductImportPreviewFailureReason };

export type ProductImageImportFailureReason =
  | 'NOT_FOUND'
  | 'SOURCE_URL_MISSING'
  | 'SOURCE_URL_NOT_ALLOWED'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_TOO_LARGE'
  | 'SOURCE_IMAGE_MISSING'
  | 'INVALID_IMAGE'
  | 'CONFLICT'
  | 'STORAGE_UNAVAILABLE';

export type ProductImageImportResult =
  | { ok: true; item: WardrobeItemDto }
  | { ok: false; reason: ProductImageImportFailureReason };

export interface IProductImportService {
  preview(sourceUrl: string): Promise<ProductImportPreviewResult>;
  importImage(
    userId: string,
    itemId: string,
    imageUrls?: string[],
  ): Promise<ProductImageImportResult>;
}
