import {
  DRESS_ME_REASON_CODES,
  type DressMeProviderContext,
  type DressMeProviderRecommendation,
  type DressMeRecommendationDto,
  type DressMeRequestDto,
  type DressMeResult,
  type DressMeWarningCode,
  type DressMeWeatherDto,
} from '../../../Models/DressMe/dress-me.model';
import type { FragranceDto } from '../../../Models/Fragrance/fragrance.model';
import type { OutfitDto, WearHistoryDto } from '../../../Models/Outfit/outfit.model';
import type { WardrobeItemDto } from '../../../Models/Wardrobe/wardrobe.model';
import type { IDressMeRecommendationProvider, IDressMeService } from '../../ServicesInterface/DressMe/dress-me.service.interface';
import type { IFragranceService } from '../../ServicesInterface/Fragrance/fragrance.service.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IOutfitService, IWearHistoryService } from '../../ServicesInterface/Outfit/outfit.service.interface';
import type { IPhysicalProfileService } from '../../ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import type { IPreferencesService } from '../../ServicesInterface/Preferences/preferences.service.interface';
import type { IWardrobeService } from '../../ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWeatherService } from '../../ServicesInterface/Weather/weather.service.interface';

const WARDROBE_PAGE_SIZE = 60;
const WARDROBE_MAX_PAGES = 10;
const FRAGRANCE_PAGE_SIZE = 60;
const FRAGRANCE_MAX_PAGES = 3;
const OUTFIT_PAGE_SIZE = 60;
const OUTFIT_MAX_PAGES = 2;
const HISTORY_PAGE_SIZE = 100;
const VALID_REASONS = new Set<string>(DRESS_ME_REASON_CODES);

interface BoundedResult<T> {
  items: T[];
  truncated: boolean;
}

async function loadWardrobe(service: IWardrobeService, userId: string): Promise<BoundedResult<WardrobeItemDto>> {
  const items: WardrobeItemDto[] = [];
  for (let page = 1; page <= WARDROBE_MAX_PAGES; page += 1) {
    const result = await service.list(userId, { page, pageSize: WARDROBE_PAGE_SIZE });
    items.push(...result.items);
    if (page >= result.pagination.totalPages) return { items, truncated: false };
  }
  return { items, truncated: true };
}

async function loadFragrances(service: IFragranceService, userId: string): Promise<BoundedResult<FragranceDto>> {
  const items: FragranceDto[] = [];
  for (let page = 1; page <= FRAGRANCE_MAX_PAGES; page += 1) {
    const result = await service.list(userId, { page, pageSize: FRAGRANCE_PAGE_SIZE, available: true });
    items.push(...result.items);
    if (page >= result.pagination.totalPages) return { items, truncated: false };
  }
  return { items, truncated: true };
}

async function loadOutfits(service: IOutfitService, userId: string): Promise<BoundedResult<OutfitDto>> {
  const items: OutfitDto[] = [];
  for (let page = 1; page <= OUTFIT_MAX_PAGES; page += 1) {
    const result = await service.list(userId, { page, pageSize: OUTFIT_PAGE_SIZE });
    items.push(...result.items);
    if (page >= result.pagination.totalPages) return { items, truncated: false };
  }
  return { items, truncated: true };
}

async function loadWearHistory(service: IWearHistoryService, userId: string): Promise<BoundedResult<WearHistoryDto>> {
  const result = await service.list(userId, { page: 1, pageSize: HISTORY_PAGE_SIZE });
  return { items: result.items, truncated: result.pagination.totalPages > 1 };
}

function chooseWeatherMoment(
  weather: Awaited<ReturnType<IWeatherService['getContext']>>,
  forAt: string,
): DressMeWeatherDto | null {
  if (!weather.ok) return null;
  const moments = [weather.context.current, ...weather.context.nextHours];
  if (moments.length === 0) return null;
  const target = new Date(forAt).getTime();
  const chosen = moments.reduce((best, candidate) => {
    const bestDistance = Math.abs(new Date(best.at).getTime() - target);
    const candidateDistance = Math.abs(new Date(candidate.at).getTime() - target);
    return candidateDistance < bestDistance ? candidate : best;
  });
  const locationLabel = [
    weather.context.location.name,
    weather.context.location.region,
    weather.context.location.country,
  ].filter(Boolean).join(', ') || null;

  return {
    locationLabel,
    at: chosen.at,
    temperatureC: chosen.temperatureC,
    feelsLikeC: chosen.feelsLikeC,
    condition: chosen.condition,
    chanceOfRainPercent: chosen.chanceOfRainPercent ?? weather.context.today.chanceOfRainPercent,
    chanceOfSnowPercent: chosen.chanceOfSnowPercent ?? weather.context.today.chanceOfSnowPercent,
    windKph: chosen.windKph,
  };
}

function isPartialOutfit(items: WardrobeItemDto[]): boolean {
  const categories = new Set(items.map((item) => item.category));
  return !(categories.has('one-piece') || (categories.has('top') && categories.has('bottom')));
}

function validateProviderRecommendations(
  raw: DressMeProviderRecommendation[],
  wardrobeItems: WardrobeItemDto[],
  fragrances: FragranceDto[],
  recommendationCount: number,
): DressMeRecommendationDto[] {
  const itemIds = new Set(wardrobeItems.map((item) => item.id));
  const fragranceIds = new Set(fragrances.map((fragrance) => fragrance.id));
  const seen = new Set<string>();
  const valid: DressMeRecommendationDto[] = [];

  for (const recommendation of raw) {
    const uniqueItems = [...new Set(recommendation.wardrobeItemIds.map((id) => id.toLowerCase()))];
    if (uniqueItems.length < 1 || uniqueItems.length > 12) continue;
    if (!uniqueItems.every((id) => itemIds.has(id))) continue;
    if (recommendation.fragranceId && !fragranceIds.has(recommendation.fragranceId)) continue;
    if (!Number.isFinite(recommendation.score)) continue;

    const reasons = [...new Set(recommendation.reasons.filter((reason) => VALID_REASONS.has(reason)))];
    const key = `${uniqueItems.slice().sort().join(':')}|${recommendation.fragranceId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    valid.push({
      wardrobeItemIds: uniqueItems,
      fragranceId: recommendation.fragranceId ?? null,
      score: Math.max(0, Math.min(100, Math.round(recommendation.score))),
      reasons,
    });
    if (valid.length >= recommendationCount) break;
  }

  return valid;
}

export class DressMeService implements IDressMeService {
  constructor(
    private readonly wardrobeService: IWardrobeService,
    private readonly fragranceService: IFragranceService,
    private readonly outfitService: IOutfitService,
    private readonly wearHistoryService: IWearHistoryService,
    private readonly physicalProfileService: IPhysicalProfileService,
    private readonly preferencesService: IPreferencesService,
    private readonly weatherService: IWeatherService,
    private readonly provider: IDressMeRecommendationProvider,
    private readonly logger: IApplicationLogger,
    private readonly fallbackProvider?: IDressMeRecommendationProvider,
  ) {}

  private async invokeProvider(
    provider: IDressMeRecommendationProvider,
    context: DressMeProviderContext,
  ): Promise<DressMeProviderRecommendation[] | null> {
    try {
      return await provider.recommend(context);
    } catch {
      return null;
    }
  }

  async recommend(userId: string, input: DressMeRequestDto): Promise<DressMeResult> {
    const interpreted = interpretNaturalDressMeRequest(input);
    const forAt = input.forAt ?? new Date().toISOString();
    const includeFragrance = interpreted.includeFragrance;
    const recommendationCount = input.recommendationCount ?? 3;

    const [wardrobe, fragrances, savedOutfits, wearHistory, physicalProfile, preferences] = await Promise.all([
      loadWardrobe(this.wardrobeService, userId),
      includeFragrance
        ? loadFragrances(this.fragranceService, userId)
        : Promise.resolve({ items: [] as FragranceDto[], truncated: false }),
      loadOutfits(this.outfitService, userId),
      loadWearHistory(this.wearHistoryService, userId),
      this.physicalProfileService.get(userId),
      this.preferencesService.get(userId),
    ]);

    if (wardrobe.items.length === 0) return { ok: false, reason: 'WARDROBE_EMPTY' };

    const warnings = new Set<DressMeWarningCode>();
    if (!physicalProfile) warnings.add('physical-profile-missing');
    if (!preferences) warnings.add('preferences-missing');
    if (includeFragrance && fragrances.items.length === 0) warnings.add('fragrances-unavailable');
    if (wardrobe.truncated || fragrances.truncated || savedOutfits.truncated || wearHistory.truncated) {
      warnings.add('candidate-limit-reached');
    }

    let weather: DressMeWeatherDto | null = null;
    if (input.location) {
      const result = await this.weatherService.getContext(input.location);
      if (result.ok) weather = chooseWeatherMoment(result, forAt);
      else warnings.add('weather-unavailable');
    } else {
      warnings.add('weather-not-requested');
    }

    const context: DressMeProviderContext = {
      request: {
        occasion: interpreted.occasion,
        dressCode: interpreted.dressCode,
        forAt,
        includeFragrance,
        recommendationCount,
        additionalContext: input.additionalContext?.trim() || null,
      },
      wardrobeItems: wardrobe.items,
      fragrances: fragrances.items,
      savedOutfits: savedOutfits.items,
      wearHistory: wearHistory.items,
      physicalProfile,
      preferences,
      weather,
    };

    let activeProvider = this.provider;
    let raw = await this.invokeProvider(activeProvider, context);
    let recommendations = raw
      ? validateProviderRecommendations(raw, wardrobe.items, fragrances.items, recommendationCount)
      : [];

    if ((raw === null || recommendations.length === 0) && this.fallbackProvider) {
      this.logger.warn('dress_me_provider_fallback');
      activeProvider = this.fallbackProvider;
      raw = await this.invokeProvider(activeProvider, context);
      recommendations = raw
        ? validateProviderRecommendations(raw, wardrobe.items, fragrances.items, recommendationCount)
        : [];
    }

    if (raw === null) {
      this.logger.error('dress_me_provider_failed');
      return { ok: false, reason: 'PROVIDER_UNAVAILABLE' };
    }
    if (recommendations.length === 0) return { ok: false, reason: 'NO_RECOMMENDATION' };

    const wardrobeMap = new Map(wardrobe.items.map((item) => [item.id, item]));
    if (recommendations.some((recommendation) =>
      isPartialOutfit(
        recommendation.wardrobeItemIds
          .map((id) => wardrobeMap.get(id))
          .filter((item): item is WardrobeItemDto => Boolean(item)),
      ),
    )) {
      warnings.add('partial-outfit');
    }

    return {
      ok: true,
      response: {
        forAt,
        generatedAt: new Date().toISOString(),
        engine: activeProvider.engine,
        weather,
        warnings: [...warnings],
        recommendations,
      },
    };
  }
}

export function interpretNaturalDressMeRequest(input: DressMeRequestDto): {
  occasion: DressMeRequestDto['occasion'];
  dressCode: NonNullable<DressMeProviderContext['request']['dressCode']> | null;
  includeFragrance: boolean;
} {
  const text = input.additionalContext?.toLocaleLowerCase('en') ?? '';
  const occasionRules: Array<[RegExp, DressMeRequestDto['occasion']]> = [
    [/\b(?:wedding|bridal|reception)\b/, 'wedding'],
    [/\b(?:date|romantic|anniversary)\b/, 'date'],
    [/\b(?:party|club|celebration|birthday)\b/, 'party'],
    [/\b(?:interview|meeting|office|work)\b/, 'work'],
    [/\b(?:business|conference|corporate)\b/, 'business'],
    [/\b(?:church|mosque|temple|religious|worship)\b/, 'religious'],
    [/\b(?:travel|flight|airport|road trip)\b/, 'travel'],
    [/\b(?:hike|hiking|outdoor|camping)\b/, 'outdoor'],
    [/\b(?:gym|workout|training|exercise)\b/, 'workout'],
    [/\b(?:gala|ceremony|formal event)\b/, 'formal-event'],
  ];
  const dressCodeRules: Array<[RegExp, NonNullable<DressMeProviderContext['request']['dressCode']>]> = [
    [/\bblack[ -]?tie\b/, 'black-tie'],
    [/\bsemi[ -]?formal\b/, 'semi-formal'],
    [/\bbusiness[ -]?casual\b/, 'business-casual'],
    [/\bsmart[ -]?casual\b/, 'smart-casual'],
    [/\bcocktail\b/, 'cocktail'],
    [/\bformal\b/, 'formal'],
    [/\bbusiness\b/, 'business'],
    [/\bcasual\b/, 'casual'],
  ];
  const occasion = occasionRules.find(([pattern]) => pattern.test(text))?.[1] ?? input.occasion;
  const dressCode = dressCodeRules.find(([pattern]) => pattern.test(text))?.[1] ?? input.dressCode ?? null;
  const excludesFragrance = /\b(?:no|without|skip|avoid)\s+(?:fragrance|perfume|cologne|scent)\b/.test(text);
  const requestsFragrance = /\b(?:include|add|wear|with)\s+(?:a\s+)?(?:fragrance|perfume|cologne|scent)\b/.test(text);
  return {
    occasion,
    dressCode,
    includeFragrance: excludesFragrance ? false : requestsFragrance ? true : input.includeFragrance ?? true,
  };
}
