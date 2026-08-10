import type {
  WardrobeItemRecord,
  WardrobeStoredImageRecord,
} from '../Wardrobe/wardrobe.repository.interface';

export interface IWardrobeImageRepository {
  replaceImages?(
    userId: string,
    itemId: string,
    expectedObjectKeys: string[],
    images: WardrobeStoredImageRecord[],
  ): Promise<WardrobeItemRecord | null>;
  replaceImage(
    userId: string,
    itemId: string,
    expectedObjectKey: string | null,
    image: WardrobeStoredImageRecord,
  ): Promise<WardrobeItemRecord | null>;
  clearImage(
    userId: string,
    itemId: string,
    expectedObjectKey: string,
  ): Promise<WardrobeItemRecord | null>;
  deleteWithRecord(userId: string, itemId: string): Promise<WardrobeItemRecord | null>;
}
