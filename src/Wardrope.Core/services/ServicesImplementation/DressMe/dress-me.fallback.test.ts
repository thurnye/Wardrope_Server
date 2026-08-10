import { describe, expect, it, vi } from 'vitest';
import type { FragranceDto } from '../../../Models/Fragrance/fragrance.model';
import type { OutfitDto, WearHistoryDto } from '../../../Models/Outfit/outfit.model';
import type { WardrobeItemDto } from '../../../Models/Wardrobe/wardrobe.model';
import type { IDressMeRecommendationProvider } from '../../ServicesInterface/DressMe/dress-me.service.interface';
import type { IFragranceService } from '../../ServicesInterface/Fragrance/fragrance.service.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IOutfitService, IWearHistoryService } from '../../ServicesInterface/Outfit/outfit.service.interface';
import type { IPhysicalProfileService } from '../../ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import type { IPreferencesService } from '../../ServicesInterface/Preferences/preferences.service.interface';
import type { IWardrobeService } from '../../ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWeatherService } from '../../ServicesInterface/Weather/weather.service.interface';
import { DressMeService } from './dress-me.service';

const USER_ID = '64b000000000000000000001';
const TOP_ID = '64c000000000000000000001';
const BOTTOM_ID = '64c000000000000000000002';
const NOW = '2026-08-09T15:00:00.000Z';

const wardrobeItems: WardrobeItemDto[] = [
  {
    id: TOP_ID,
    name: 'Oxford shirt',
    category: 'top',
    subcategory: 'Oxford shirt',
    brand: null,
    colors: ['Navy'],
    materials: ['Cotton'],
    pattern: 'solid',
    size: 'M',
    favorite: false,
    sourceUrl: null,
    images: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: BOTTOM_ID,
    name: 'Chino trouser',
    category: 'bottom',
    subcategory: 'Chino',
    brand: null,
    colors: ['Tan'],
    materials: ['Cotton'],
    pattern: 'solid',
    size: '32',
    favorite: false,
    sourceUrl: null,
    images: [],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

function service(primary: IDressMeRecommendationProvider, fallback: IDressMeRecommendationProvider) {
  const wardrobeService = {
    list: vi.fn(async () => ({
      items: wardrobeItems,
      pagination: { page: 1, pageSize: 60, totalItems: 2, totalPages: 1 },
    })),
  } as unknown as IWardrobeService;
  const fragranceService = {
    list: vi.fn(async () => ({
      items: [] as FragranceDto[],
      pagination: { page: 1, pageSize: 60, totalItems: 0, totalPages: 0 },
    })),
  } as unknown as IFragranceService;
  const outfitService = {
    list: vi.fn(async () => ({
      items: [] as OutfitDto[],
      pagination: { page: 1, pageSize: 60, totalItems: 0, totalPages: 0 },
    })),
  } as unknown as IOutfitService;
  const wearHistoryService = {
    list: vi.fn(async () => ({
      items: [] as WearHistoryDto[],
      pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
    })),
  } as unknown as IWearHistoryService;
  const physicalProfileService = { get: vi.fn(async () => null) } as unknown as IPhysicalProfileService;
  const preferencesService = { get: vi.fn(async () => null) } as unknown as IPreferencesService;
  const weatherService: IWeatherService = {
    getContext: vi.fn(async () => ({ ok: false as const, reason: 'PROVIDER_UNAVAILABLE' as const })),
  };
  const logger: IApplicationLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return {
    logger,
    dressMe: new DressMeService(
      wardrobeService,
      fragranceService,
      outfitService,
      wearHistoryService,
      physicalProfileService,
      preferencesService,
      weatherService,
      primary,
      logger,
      fallback,
    ),
  };
}

describe('DressMeService provider fallback', () => {
  it('falls back to baseline when the AI provider throws and reports the actual engine', async () => {
    const primary: IDressMeRecommendationProvider = {
      engine: 'ai',
      recommend: vi.fn(async () => { throw new Error('upstream details'); }),
    };
    const fallback: IDressMeRecommendationProvider = {
      engine: 'baseline',
      recommend: vi.fn(async () => [{
        wardrobeItemIds: [TOP_ID, BOTTOM_ID],
        fragranceId: null,
        score: 72,
        reasons: ['occasion-aligned' as const],
      }]),
    };
    const h = service(primary, fallback);

    const result = await h.dressMe.recommend(USER_ID, {
      occasion: 'work',
      includeFragrance: false,
      forAt: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.engine).toBe('baseline');
    expect(result.response.recommendations[0]?.wardrobeItemIds).toEqual([TOP_ID, BOTTOM_ID]);
    expect(h.logger.warn).toHaveBeenCalledWith('dress_me_provider_fallback');
    expect(h.logger.error).not.toHaveBeenCalled();
  });

  it('falls back when AI output contains no authenticated candidate IDs', async () => {
    const primary: IDressMeRecommendationProvider = {
      engine: 'ai',
      recommend: vi.fn(async () => [{
        wardrobeItemIds: ['64c000000000000000000099'],
        fragranceId: null,
        score: 99,
        reasons: ['occasion-aligned' as const],
      }]),
    };
    const fallback: IDressMeRecommendationProvider = {
      engine: 'baseline',
      recommend: vi.fn(async () => [{
        wardrobeItemIds: [TOP_ID, BOTTOM_ID],
        fragranceId: null,
        score: 70,
        reasons: ['occasion-aligned' as const],
      }]),
    };
    const h = service(primary, fallback);

    const result = await h.dressMe.recommend(USER_ID, {
      occasion: 'business',
      includeFragrance: false,
      forAt: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.engine).toBe('baseline');
    expect(fallback.recommend).toHaveBeenCalledTimes(1);
    expect(h.logger.warn).toHaveBeenCalledWith('dress_me_provider_fallback');
  });
});
