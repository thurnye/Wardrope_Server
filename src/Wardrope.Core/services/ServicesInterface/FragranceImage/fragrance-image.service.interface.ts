import type { FragranceDto } from '../../../Models/Fragrance/fragrance.model';
import type {
  PrivateFileContent,
} from '../Storage/file-storage.service.interface';
import type { PrivateImageValidationReason } from '../PrivateImageProcessing/private-image-processing.service.interface';

export interface ReplaceFragranceImageInput {
  bytes: Uint8Array;
  declaredContentType: string | null;
}

export type FragranceImageMutationResult =
  | { ok: true; fragrance: FragranceDto }
  | { ok: false; reason: 'NOT_FOUND' | 'CONFLICT' | 'STORAGE_UNAVAILABLE' }
  | { ok: false; reason: 'INVALID_IMAGE'; validationReason: PrivateImageValidationReason };

export type FragranceImageReadResult =
  | { ok: true; image: PrivateFileContent }
  | { ok: false; reason: 'NOT_FOUND' | 'STORAGE_UNAVAILABLE' };

export interface IFragranceImageService {
  replace(
    userId: string,
    fragranceId: string,
    input: ReplaceFragranceImageInput,
  ): Promise<FragranceImageMutationResult>;
  read(userId: string, fragranceId: string): Promise<FragranceImageReadResult>;
  remove(userId: string, fragranceId: string): Promise<FragranceImageMutationResult>;
}
