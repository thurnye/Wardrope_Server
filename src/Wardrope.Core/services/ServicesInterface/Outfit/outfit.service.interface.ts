import type {
  CreateOutfitDto,
  CreateWearHistoryDto,
  OutfitDto,
  OutfitListDto,
  OutfitListQueryDto,
  UpdateOutfitDto,
  UpdateWearHistoryDto,
  WearHistoryDto,
  WearHistoryListDto,
  WearHistoryListQueryDto,
} from '../../../Models/Outfit/outfit.model';

export type OutfitMutationResult =
  | { ok: true; outfit: OutfitDto }
  | { ok: false; reason: 'NOT_FOUND' | 'WARDROBE_ITEM_NOT_FOUND' | 'FRAGRANCE_NOT_FOUND' };

export type WearHistoryMutationResult =
  | { ok: true; entry: WearHistoryDto }
  | { ok: false; reason: 'NOT_FOUND' | 'WARDROBE_ITEM_NOT_FOUND' | 'FRAGRANCE_NOT_FOUND' | 'OUTFIT_NOT_FOUND' };

export interface IOutfitService {
  create(userId: string, input: CreateOutfitDto): Promise<OutfitMutationResult>;
  list(userId: string, query: OutfitListQueryDto): Promise<OutfitListDto>;
  getById(userId: string, outfitId: string): Promise<OutfitDto | null>;
  update(userId: string, outfitId: string, input: UpdateOutfitDto): Promise<OutfitMutationResult>;
  delete(userId: string, outfitId: string): Promise<boolean>;
}

export interface IWearHistoryService {
  create(userId: string, input: CreateWearHistoryDto): Promise<WearHistoryMutationResult>;
  list(userId: string, query: WearHistoryListQueryDto): Promise<WearHistoryListDto>;
  getById(userId: string, historyId: string): Promise<WearHistoryDto | null>;
  update(userId: string, historyId: string, input: UpdateWearHistoryDto): Promise<WearHistoryMutationResult>;
  delete(userId: string, historyId: string): Promise<boolean>;
}
