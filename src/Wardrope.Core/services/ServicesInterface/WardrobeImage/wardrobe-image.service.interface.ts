import type { WardrobeItemDto } from '../../../Models/Wardrobe/wardrobe.model';

export interface ReplaceWardrobeImageInput {
  bytes: Uint8Array;
  declaredContentType: string | null;
}

export type WardrobeImageMutationResult =
  | { ok: true; item: WardrobeItemDto }
  | {
      ok: false;
      reason: 'NOT_FOUND' | 'INVALID_IMAGE' | 'CONFLICT' | 'STORAGE_UNAVAILABLE';
      validationReason?: string;
    };

export type WardrobeImageReadResult =
  | {
      ok: true;
      image: {
        body: Uint8Array;
        contentType: string;
        contentLength: number;
        etag: string | null;
        lastModified: Date | null;
      };
    }
  | { ok: false; reason: 'NOT_FOUND' | 'STORAGE_UNAVAILABLE' };

export interface IWardrobeImageService {
  replaceMany?(
    userId: string,
    itemId: string,
    inputs: ReplaceWardrobeImageInput[],
  ): Promise<WardrobeImageMutationResult>;
  replace(
    userId: string,
    itemId: string,
    input: ReplaceWardrobeImageInput,
  ): Promise<WardrobeImageMutationResult>;
  read(userId: string, itemId: string, imageIndex?: number): Promise<WardrobeImageReadResult>;
  remove(userId: string, itemId: string): Promise<WardrobeImageMutationResult>;
}
