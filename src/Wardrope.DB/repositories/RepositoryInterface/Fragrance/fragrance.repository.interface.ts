import type {
  CreateFragranceDto,
  FragranceConcentration,
  UpdateFragranceDto,
} from '../../../../Wardrope.Core/Models/Fragrance/fragrance.model';

export interface FragranceStoredImageRecord {
  objectKey: string;
  etag: string | null;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: Date;
}

export interface FragranceRecord {
  id: string;
  userId: string;
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
  purchasePrice: { amount: number; currency: string } | null;
  available: boolean;
  sourceUrl?: string | null;
  image: FragranceStoredImageRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FragranceRepositoryQuery {
  page: number;
  pageSize: number;
  available?: boolean;
  concentration?: FragranceConcentration;
  search?: string;
}

export interface FragranceRepositoryListResult {
  items: FragranceRecord[];
  totalItems: number;
}

export interface IFragranceRepository {
  create(userId: string, input: CreateFragranceDto): Promise<FragranceRecord>;
  list(userId: string, query: FragranceRepositoryQuery): Promise<FragranceRepositoryListResult>;
  findById(userId: string, fragranceId: string): Promise<FragranceRecord | null>;
  update(userId: string, fragranceId: string, input: UpdateFragranceDto): Promise<FragranceRecord | null>;
  deleteWithRecord(userId: string, fragranceId: string): Promise<FragranceRecord | null>;
  replaceImage(
    userId: string,
    fragranceId: string,
    expectedObjectKey: string | null,
    image: FragranceStoredImageRecord,
  ): Promise<FragranceRecord | null>;
  clearImage(
    userId: string,
    fragranceId: string,
    expectedObjectKey: string,
  ): Promise<FragranceRecord | null>;
  ensureIndexes(): Promise<void>;
}
