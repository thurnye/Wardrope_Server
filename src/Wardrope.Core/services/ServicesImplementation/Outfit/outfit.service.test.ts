import { describe, expect, it, vi } from 'vitest';
import type { IFragranceService } from '../../ServicesInterface/Fragrance/fragrance.service.interface';
import type { IWardrobeService } from '../../ServicesInterface/Wardrobe/wardrobe.service.interface';
import type {
  IOutfitRepository,
  IWearHistoryRepository,
  OutfitRecord,
  WearHistoryRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Outfit/outfit.repository.interface';
import { OutfitService, WearHistoryService } from './outfit.service';

const USER_ID = '64b000000000000000000001';
const ITEM_A = '64c000000000000000000001';
const ITEM_B = '64c000000000000000000002';
const FRAGRANCE_ID = '64d000000000000000000001';
const OUTFIT_ID = '64e000000000000000000001';
const HISTORY_ID = '64f000000000000000000001';
const NOW = new Date('2026-08-09T15:00:00.000Z');

function outfitRecord(overrides: Partial<OutfitRecord> = {}): OutfitRecord {
  return {
    id: OUTFIT_ID,
    userId: USER_ID,
    name: 'Dinner look',
    wardrobeItemIds: [ITEM_A, ITEM_B],
    fragranceId: FRAGRANCE_ID,
    favorite: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function historyRecord(overrides: Partial<WearHistoryRecord> = {}): WearHistoryRecord {
  return {
    id: HISTORY_ID,
    userId: USER_ID,
    wornAt: NOW,
    wardrobeItemIds: [ITEM_A, ITEM_B],
    fragranceId: FRAGRANCE_ID,
    sourceOutfitId: null,
    source: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function wardrobeService(foundIds = new Set([ITEM_A, ITEM_B])): IWardrobeService {
  return {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(async (_userId, itemId) => foundIds.has(itemId) ? ({ id: itemId } as never) : null),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function fragranceService(found = true): IFragranceService {
  return {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(async () => found ? ({ id: FRAGRANCE_ID } as never) : null),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function outfitRepository(): IOutfitRepository {
  return {
    create: vi.fn(async (_userId, input) => outfitRecord(input)),
    list: vi.fn(async () => ({ items: [outfitRecord()], totalItems: 1 })),
    findById: vi.fn(async () => outfitRecord()),
    update: vi.fn(async (_userId, _id, input) => outfitRecord(input)),
    delete: vi.fn(async () => true),
    removeWardrobeItemReferences: vi.fn(async () => undefined),
    clearFragranceReferences: vi.fn(async () => undefined),
    ensureIndexes: vi.fn(async () => undefined),
  };
}

function historyRepository(): IWearHistoryRepository {
  return {
    create: vi.fn(async (_userId, input) => historyRecord({
      wornAt: new Date(input.wornAt),
      wardrobeItemIds: [...input.wardrobeItemIds],
      fragranceId: input.fragranceId ?? null,
      sourceOutfitId: input.sourceOutfitId ?? null,
      source: input.source ?? 'manual',
    })),
    list: vi.fn(async () => ({ items: [historyRecord()], totalItems: 1 })),
    findById: vi.fn(async () => historyRecord()),
    update: vi.fn(async (_userId, _id, input) => historyRecord({
      ...(input.wornAt ? { wornAt: new Date(input.wornAt) } : {}),
      ...(input.wardrobeItemIds ? { wardrobeItemIds: [...input.wardrobeItemIds] } : {}),
      ...(input.fragranceId !== undefined ? { fragranceId: input.fragranceId } : {}),
    })),
    delete: vi.fn(async () => true),
    ensureIndexes: vi.fn(async () => undefined),
  };
}

describe('OutfitService', () => {
  it('rejects an outfit when any referenced wardrobe item is unavailable to the owner', async () => {
    const repo = outfitRepository();
    const service = new OutfitService(repo, wardrobeService(new Set([ITEM_A])), fragranceService());
    await expect(service.create(USER_ID, {
      name: 'Dinner look',
      wardrobeItemIds: [ITEM_A, ITEM_B],
      fragranceId: FRAGRANCE_ID,
    })).resolves.toEqual({ ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('normalizes duplicate ID casing before persistence', async () => {
    const repo = outfitRepository();
    const service = new OutfitService(repo, wardrobeService(), fragranceService());
    const result = await service.create(USER_ID, {
      name: '  Dinner   look ',
      wardrobeItemIds: [ITEM_A.toUpperCase(), ITEM_A, ITEM_B],
      fragranceId: FRAGRANCE_ID,
    });
    expect(result.ok).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      name: 'Dinner look',
      wardrobeItemIds: [ITEM_A, ITEM_B],
    }));
  });
});

describe('WearHistoryService', () => {
  it('forces browser-created entries to manual provenance', async () => {
    const outfits = outfitRepository();
    const history = historyRepository();
    const service = new WearHistoryService(history, outfits, wardrobeService(), fragranceService());
    const result = await service.create(USER_ID, {
      wornAt: NOW.toISOString(),
      wardrobeItemIds: [ITEM_A],
      source: 'dress-me',
      sourceOutfitId: OUTFIT_ID,
    });
    expect(result.ok).toBe(true);
    expect(history.create).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      source: 'manual',
      sourceOutfitId: null,
    }));
  });

  it('snapshots a saved outfit and marks provenance on the server', async () => {
    const outfits = outfitRepository();
    const history = historyRepository();
    const service = new WearHistoryService(history, outfits, wardrobeService(), fragranceService());
    const result = await service.recordOutfitWear(USER_ID, OUTFIT_ID, NOW.toISOString());
    expect(result.ok).toBe(true);
    expect(history.create).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      wardrobeItemIds: [ITEM_A, ITEM_B],
      fragranceId: FRAGRANCE_ID,
      sourceOutfitId: OUTFIT_ID,
      source: 'saved-outfit',
    }));
  });

  it('does not rewrite source provenance during edits', async () => {
    const outfits = outfitRepository();
    const history = historyRepository();
    const service = new WearHistoryService(history, outfits, wardrobeService(), fragranceService());
    await service.update(USER_ID, HISTORY_ID, {
      wornAt: '2026-08-08T12:00:00.000Z',
      source: 'dress-me',
      sourceOutfitId: OUTFIT_ID,
    });
    expect(history.update).toHaveBeenCalledWith(USER_ID, HISTORY_ID, {
      wornAt: '2026-08-08T12:00:00.000Z',
    });
  });
});
