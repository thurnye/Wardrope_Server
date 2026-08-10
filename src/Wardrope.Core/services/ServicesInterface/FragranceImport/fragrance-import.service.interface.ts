import type { FragranceDto, FragranceImportPreviewDto } from '../../../Models/Fragrance/fragrance.model';

export type FragranceImportResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'NOT_FOUND' | 'SOURCE_URL_MISSING' | 'SOURCE_UNAVAILABLE' | 'SOURCE_IMAGE_MISSING' | 'INVALID_IMAGE' | 'STORAGE_UNAVAILABLE' | 'CONFLICT' };

export interface IFragranceImportService {
  preview(sourceUrl: string): Promise<FragranceImportResult<FragranceImportPreviewDto>>;
  importImage(userId: string, fragranceId: string, imageUrl?: string): Promise<FragranceImportResult<FragranceDto>>;
}
