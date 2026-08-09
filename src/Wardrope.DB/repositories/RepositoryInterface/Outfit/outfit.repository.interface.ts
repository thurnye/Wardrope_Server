import type {
  CreateOutfitDto,
  CreateWearHistoryDto,
  UpdateOutfitDto,
  UpdateWearHistoryDto,
  WearHistorySource,
} from '../../../../Wardrope.Core/Models/Outfit/outfit.model';

export interface OutfitRecord {
  id: string;
  userId: string;
  name: string;
  wardrobeItemIds: string[];
  fragranceId: string | null;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutfitRepositoryQuery {
  page: number;
  pageSize: number;
  favorite?: boolean;
  search?: string;
}

export interface OutfitRepositoryListResult {
  items: OutfitRecord[];
  totalItems: number;
}

export interface WearHistoryRecord {
  id: string;
  userId: string;
  wornAt: Date;
  wardrobeItemIds: string[];
  fragranceId: string | null;
  sourceOutfitId: string | null;
  source: WearHistorySource;
  createdAt: Date;
  updatedAt: Date;
}

export interface WearHistoryRepositoryQuery {
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
}

export interface WearHistoryRepositoryListResult {
  items: WearHistoryRecord[];
  totalItems: number;
}

export interface IOutfitRepository {
  create(userId: string, input: CreateOutfitDto): Promise<OutfitRecord>;
  list(userId: string, query: OutfitRepositoryQuery): Promise<OutfitRepositoryListResult>;
  findById(userId: string, outfitId: string): Promise<OutfitRecord | null>;
  update(userId: string, outfitId: string, input: UpdateOutfitDto): Promise<OutfitRecord | null>;
  delete(userId: string, outfitId: string): Promise<boolean>;
  removeWardrobeItemReferences(userId: string, wardrobeItemId: string): Promise<void>;
  clearFragranceReferences(userId: string, fragranceId: string): Promise<void>;
  ensureIndexes(): Promise<void>;
}

export interface IWearHistoryRepository {
  create(userId: string, input: CreateWearHistoryDto): Promise<WearHistoryRecord>;
  list(userId: string, query: WearHistoryRepositoryQuery): Promise<WearHistoryRepositoryListResult>;
  findById(userId: string, historyId: string): Promise<WearHistoryRecord | null>;
  update(userId: string, historyId: string, input: UpdateWearHistoryDto): Promise<WearHistoryRecord | null>;
  delete(userId: string, historyId: string): Promise<boolean>;
  ensureIndexes(): Promise<void>;
}
