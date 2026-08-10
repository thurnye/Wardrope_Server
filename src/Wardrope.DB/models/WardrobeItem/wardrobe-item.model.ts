import type { ObjectId } from 'mongodb';
import type {
  WardrobeCategory,
  WardrobePattern,
} from '../../../Wardrope.Core/Models/Wardrobe/wardrobe.model';

export const WARDROBE_ITEMS_COLLECTION = 'wardrobeItems';

export interface WardrobeImageDocument {
  objectKey: string;
  etag: string | null;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: Date;
}

export interface WardrobeItemDocument {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  brand: string | null;
  colors: string[];
  materials: string[];
  pattern: WardrobePattern | null;
  size: string | null;
  favorite: boolean;
  sourceUrl?: string | null;
  images: WardrobeImageDocument[];
  createdAt: Date;
  updatedAt: Date;
}
