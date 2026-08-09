import type {
  CreateOutfitDto,
  CreateWearHistoryDto,
  OutfitListDto,
  OutfitListQueryDto,
  UpdateOutfitDto,
  UpdateWearHistoryDto,
  WearHistoryListDto,
  WearHistoryListQueryDto,
} from '../../../Models/Outfit/outfit.model';
import { toOutfitDto, toWearHistoryDto } from '../../../mappers/Outfit/outfit.mapper';
import type {
  IOutfitRepository,
  IWearHistoryRepository,
  OutfitRepositoryQuery,
  WearHistoryRepositoryQuery,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Outfit/outfit.repository.interface';
import type { IFragranceService } from '../../ServicesInterface/Fragrance/fragrance.service.interface';
import type {
  IOutfitService,
  IWearHistoryService,
  OutfitMutationResult,
  WearHistoryMutationResult,
} from '../../ServicesInterface/Outfit/outfit.service.interface';
import type { IWardrobeService } from '../../ServicesInterface/Wardrobe/wardrobe.service.interface';

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.toLowerCase()))];
}

async function validateWardrobeItems(
  service: IWardrobeService,
  userId: string,
  itemIds: string[],
): Promise<boolean> {
  const results = await Promise.all(itemIds.map((itemId) => service.getById(userId, itemId)));
  return results.every(Boolean);
}

async function validateFragrance(
  service: IFragranceService,
  userId: string,
  fragranceId: string | null | undefined,
): Promise<boolean> {
  return !fragranceId || Boolean(await service.getById(userId, fragranceId));
}

export class OutfitService implements IOutfitService {
  constructor(
    private readonly repository: IOutfitRepository,
    private readonly wardrobeService: IWardrobeService,
    private readonly fragranceService: IFragranceService,
  ) {}

  async create(userId: string, input: CreateOutfitDto): Promise<OutfitMutationResult> {
    const wardrobeItemIds = normalizeIds(input.wardrobeItemIds);
    if (!await validateWardrobeItems(this.wardrobeService, userId, wardrobeItemIds)) {
      return { ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' };
    }
    if (!await validateFragrance(this.fragranceService, userId, input.fragranceId)) {
      return { ok: false, reason: 'FRAGRANCE_NOT_FOUND' };
    }

    const outfit = await this.repository.create(userId, {
      name: normalizeText(input.name),
      wardrobeItemIds,
      fragranceId: input.fragranceId ?? null,
      favorite: input.favorite ?? false,
    });
    return { ok: true, outfit: toOutfitDto(outfit) };
  }

  async list(userId: string, query: OutfitListQueryDto): Promise<OutfitListDto> {
    const repositoryQuery: OutfitRepositoryQuery = { page: query.page, pageSize: query.pageSize };
    if (query.favorite !== undefined) repositoryQuery.favorite = query.favorite;
    if (query.search) repositoryQuery.search = normalizeText(query.search);
    const result = await this.repository.list(userId, repositoryQuery);
    return {
      items: result.items.map(toOutfitDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / query.pageSize),
      },
    };
  }

  async getById(userId: string, outfitId: string) {
    const outfit = await this.repository.findById(userId, outfitId);
    return outfit ? toOutfitDto(outfit) : null;
  }

  async update(userId: string, outfitId: string, input: UpdateOutfitDto): Promise<OutfitMutationResult> {
    if (!await this.repository.findById(userId, outfitId)) return { ok: false, reason: 'NOT_FOUND' };

    const normalized: UpdateOutfitDto = {};
    if (input.name !== undefined) normalized.name = normalizeText(input.name);
    if (input.wardrobeItemIds !== undefined) {
      normalized.wardrobeItemIds = normalizeIds(input.wardrobeItemIds);
      if (!await validateWardrobeItems(this.wardrobeService, userId, normalized.wardrobeItemIds)) {
        return { ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' };
      }
    }
    if (input.fragranceId !== undefined) {
      normalized.fragranceId = input.fragranceId;
      if (!await validateFragrance(this.fragranceService, userId, input.fragranceId)) {
        return { ok: false, reason: 'FRAGRANCE_NOT_FOUND' };
      }
    }
    if (input.favorite !== undefined) normalized.favorite = input.favorite;

    const outfit = await this.repository.update(userId, outfitId, normalized);
    return outfit ? { ok: true, outfit: toOutfitDto(outfit) } : { ok: false, reason: 'NOT_FOUND' };
  }

  delete(userId: string, outfitId: string): Promise<boolean> {
    return this.repository.delete(userId, outfitId);
  }
}

export class WearHistoryService implements IWearHistoryService {
  constructor(
    private readonly repository: IWearHistoryRepository,
    private readonly outfitRepository: IOutfitRepository,
    private readonly wardrobeService: IWardrobeService,
    private readonly fragranceService: IFragranceService,
  ) {}

  async create(userId: string, input: CreateWearHistoryDto): Promise<WearHistoryMutationResult> {
    const wardrobeItemIds = normalizeIds(input.wardrobeItemIds);
    if (!await validateWardrobeItems(this.wardrobeService, userId, wardrobeItemIds)) {
      return { ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' };
    }
    if (!await validateFragrance(this.fragranceService, userId, input.fragranceId)) {
      return { ok: false, reason: 'FRAGRANCE_NOT_FOUND' };
    }

    const entry = await this.repository.create(userId, {
      wornAt: new Date(input.wornAt).toISOString(),
      wardrobeItemIds,
      fragranceId: input.fragranceId ?? null,
      sourceOutfitId: null,
      source: 'manual',
    });
    return { ok: true, entry: toWearHistoryDto(entry) };
  }

  async recordOutfitWear(userId: string, outfitId: string, wornAt: string): Promise<WearHistoryMutationResult> {
    const outfit = await this.outfitRepository.findById(userId, outfitId);
    if (!outfit) return { ok: false, reason: 'OUTFIT_NOT_FOUND' };

    const entry = await this.repository.create(userId, {
      wornAt: new Date(wornAt).toISOString(),
      wardrobeItemIds: [...outfit.wardrobeItemIds],
      fragranceId: outfit.fragranceId,
      sourceOutfitId: outfit.id,
      source: 'saved-outfit',
    });
    return { ok: true, entry: toWearHistoryDto(entry) };
  }

  async list(userId: string, query: WearHistoryListQueryDto): Promise<WearHistoryListDto> {
    const repositoryQuery: WearHistoryRepositoryQuery = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.from) repositoryQuery.from = new Date(query.from);
    if (query.to) repositoryQuery.to = new Date(query.to);
    const result = await this.repository.list(userId, repositoryQuery);
    return {
      items: result.items.map(toWearHistoryDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / query.pageSize),
      },
    };
  }

  async getById(userId: string, historyId: string) {
    const entry = await this.repository.findById(userId, historyId);
    return entry ? toWearHistoryDto(entry) : null;
  }

  async update(userId: string, historyId: string, input: UpdateWearHistoryDto): Promise<WearHistoryMutationResult> {
    if (!await this.repository.findById(userId, historyId)) return { ok: false, reason: 'NOT_FOUND' };

    const normalized: UpdateWearHistoryDto = {};
    if (input.wornAt !== undefined) normalized.wornAt = new Date(input.wornAt).toISOString();
    if (input.wardrobeItemIds !== undefined) {
      normalized.wardrobeItemIds = normalizeIds(input.wardrobeItemIds);
      if (!await validateWardrobeItems(this.wardrobeService, userId, normalized.wardrobeItemIds)) {
        return { ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' };
      }
    }
    if (input.fragranceId !== undefined) {
      normalized.fragranceId = input.fragranceId;
      if (!await validateFragrance(this.fragranceService, userId, input.fragranceId)) {
        return { ok: false, reason: 'FRAGRANCE_NOT_FOUND' };
      }
    }

    const entry = await this.repository.update(userId, historyId, normalized);
    return entry ? { ok: true, entry: toWearHistoryDto(entry) } : { ok: false, reason: 'NOT_FOUND' };
  }

  delete(userId: string, historyId: string): Promise<boolean> {
    return this.repository.delete(userId, historyId);
  }
}
