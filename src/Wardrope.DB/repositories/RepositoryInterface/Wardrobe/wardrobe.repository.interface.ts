import type {
  CreateWardrobeItemDto,
  UpdateWardrobeItemDto,
  WardrobeCategory,
  WardrobePattern,
} from '../../../../Wardrope.Core/Models/Wardrobe/wardrobe.model';

export interface WardrobeStoredImageRecord {
  objectKey: string;
  etag: string | null;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: Date;
}

export interface WardrobeItemRecord {
  id: string;
  userId: string;
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
  image?: WardrobeStoredImageRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WardrobeRepositoryQuery {
  page: number;
  pageSize: number;
  category?: WardrobeCategory;
  favorite?: boolean;
  search?: string;
}

export interface WardrobeRepositoryListResult {
  items: WardrobeItemRecord[];
  totalItems: number;
}

export interface IWardrobeRepository {
  create(userId: string, input: CreateWardrobeItemDto): Promise<WardrobeItemRecord>;
  list(userId: string, query: WardrobeRepositoryQuery): Promise<WardrobeRepositoryListResult>;
  findById(userId: string, itemId: string): Promise<WardrobeItemRecord | null>;
  update(
    userId: string,
    itemId: string,
    input: UpdateWardrobeItemDto,
  ): Promise<WardrobeItemRecord | null>;
  delete(userId: string, itemId: string): Promise<boolean>;
  ensureIndexes(): Promise<void>;
}
