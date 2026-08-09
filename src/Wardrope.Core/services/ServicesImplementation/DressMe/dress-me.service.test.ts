import { describe, expect, it, vi } from 'vitest';
import type { DressMeProviderContext } from '../../../Models/DressMe/dress-me.model';
import type { FragranceDto } from '../../../Models/Fragrance/fragrance.model';
import type { OutfitDto, WearHistoryDto } from '../../../Models/Outfit/outfit.model';
import type { PhysicalProfileDto } from '../../../Models/PhysicalProfile/physical-profile.model';
import type { PreferencesDto } from '../../../Models/Preferences/preferences.model';
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
const OTHER_ID = '64c000000000000000000099';
const FRAGRANCE_ID = '64d000000000000000000001';
const NOW = '2026-08-09T15:00:00.000Z';

function wardrobeItem(id: string, category: WardrobeItemDto['category'], name: string): WardrobeItemDto {
  return {
    id,
    name,
    category,
    subcategory: name,
    brand: null,
    colors: ['Navy'],
    materials: ['Cotton'],
    pattern: 'solid',
    size: 'M',
    favorite: false,
    sourceUrl: null,
    image: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function harness(provider: IDressMeRecommendationProvider) {
  const items = [
    wardrobeItem(TOP_ID, 'top', 'Oxford shirt'),
    wardrobeItem(BOTTOM_ID, 'bottom', 'Chino trouser'),
  ];
  const fragrance: FragranceDto = {
    id: FRAGRANCE_ID,
    brand: 'Dior',
    name: 'Sauvage',
    productLine: null,
    concentration: 'eau-de-parfum',
    fragranceFamily: 'Aromatic',
    scentType: null,
    keyNotes: ['Bergamot'],
    bottleSizeMl: 100,
    amountRemainingPercent: 80,
    purchaseDate: null,
    purchasePrice: null,
    available: true,
    image: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const wardrobeService = {
    list: vi.fn(async () => ({
      items,
      pagination: { page: 1, pageSize: 60, totalItems: 2, totalPages: 1 },
    })),
  } as unknown as IWardrobeService;
  const fragranceService = {
    list: vi.fn(async () => ({
      items: [fragrance],
      pagination: { page: 1, pageSize: 60, totalItems: 1, totalPages: 1 },
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
  const physicalProfileService = {
    get: vi.fn(async () => null as PhysicalProfileDto | null),
  } as unknown as IPhysicalProfileService;
  const preferencesService = {
    get: vi.fn(async () => null as PreferencesDto | null),
  } as unknown as IPreferencesService;
  const weatherService: IWeatherService = {
    getContext: vi.fn(async () => ({
      ok: true,
      context: {
        location: { name: 'Toronto', region: 'Ontario', country: 'Canada', timezone: 'America/Toronto' },
        current: {
          at: NOW,
          temperatureC: 25,
          feelsLikeC: 26,
          condition: 'Partly cloudy',
          conditionCode: 1003,
          isDay: true,
          humidityPercent: 60,
          cloudPercent: 40,
          windKph: 10,
          gustKph: 15,
          precipitationMm: 0,
          chanceOfRainPercent: null,
          chanceOfSnowPercent: null,
          uvIndex: 5,
        },
        today: {
          date: '2026-08-09',
          minTemperatureC: 18,
          maxTemperatureC: 27,
          totalPrecipitationMm: 0,
          maxWindKph: 20,
          chanceOfRainPercent: 20,
          chanceOfSnowPercent: 0,
        },
        nextHours: [],
        fetchedAt: NOW,
      },
    })),
  };
  const logger: IApplicationLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return {
    items,
    weatherService,
    logger,
    service: new DressMeService(
      wardrobeService,
      fragranceService,
      outfitService,
      wearHistoryService,
      physicalProfileService,
      preferencesService,
      weatherService,
      provider,
      logger,
    ),
  };
}

describe('DressMeService', () => {
  it('rejects provider-selected IDs that are outside the authenticated candidate set', async () => {
    const provider: IDressMeRecommendationProvider = {
      engine: 'ai',
      recommend: vi.fn(async () => [{
        wardrobeItemIds: [OTHER_ID],
        fragranceId: null,
        score: 99,
        reasons: ['occasion-aligned'],
      }]),
    };
    const h = harness(provider);
    await expect(h.service.recommend(USER_ID, {
      occasion: 'work',
      includeFragrance: false,
      forAt: NOW,
    })).resolves.toEqual({ ok: false, reason: 'NO_RECOMMENDATION' });
  });

  it('keeps coordinates out of the response and selects weather through the existing service', async () => {
    const provider: IDressMeRecommendationProvider = {
      engine: 'baseline',
      recommend: vi.fn(async (context: DressMeProviderContext) => [{
        wardrobeItemIds: [TOP_ID, BOTTOM_ID],
        fragranceId: FRAGRANCE_ID,
        score: 82.4,
        reasons: ['occasion-aligned', 'occasion-aligned'],
      }]),
    };
    const h = harness(provider);
    const result = await h.service.recommend(USER_ID, {
      occasion: 'business',
      forAt: NOW,
      location: { latitude: 43.653226, longitude: -79.3831843 },
    });

    expect(h.weatherService.getContext).toHaveBeenCalledWith({ latitude: 43.653226, longitude: -79.3831843 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.engine).toBe('baseline');
    expect(result.response.weather?.locationLabel).toBe('Toronto, Ontario, Canada');
    expect(result.response.recommendations[0]).toMatchObject({
      wardrobeItemIds: [TOP_ID, BOTTOM_ID],
      fragranceId: FRAGRANCE_ID,
      score: 82,
      reasons: ['occasion-aligned'],
    });
    expect(JSON.stringify(result.response)).not.toMatch(/latitude|longitude|43\.653|-79\.383/);
  });

  it('sanitizes provider failures without logging user context', async () => {
    const provider: IDressMeRecommendationProvider = {
      engine: 'ai',
      recommend: vi.fn(async () => { throw new Error('secret prompt/provider details'); }),
    };
    const h = harness(provider);
    await expect(h.service.recommend(USER_ID, { occasion: 'everyday', forAt: NOW }))
      .resolves.toEqual({ ok: false, reason: 'PROVIDER_UNAVAILABLE' });
    expect(h.logger.error).toHaveBeenCalledWith('dress_me_provider_failed');
  });
});
