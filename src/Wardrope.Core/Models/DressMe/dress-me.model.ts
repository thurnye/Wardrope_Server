import type { FragranceDto } from '../Fragrance/fragrance.model';
import type { OutfitDto, WearHistoryDto } from '../Outfit/outfit.model';
import type { PhysicalProfileDto } from '../PhysicalProfile/physical-profile.model';
import type { PreferencesDto } from '../Preferences/preferences.model';
import type { WardrobeItemDto } from '../Wardrobe/wardrobe.model';

export const DRESS_ME_OCCASIONS = [
  'everyday',
  'work',
  'business',
  'date',
  'party',
  'wedding',
  'formal-event',
  'religious',
  'travel',
  'outdoor',
  'workout',
] as const;
export type DressMeOccasion = (typeof DRESS_ME_OCCASIONS)[number];

export const DRESS_ME_DRESS_CODES = [
  'casual',
  'smart-casual',
  'business-casual',
  'business',
  'cocktail',
  'semi-formal',
  'formal',
  'black-tie',
] as const;
export type DressMeDressCode = (typeof DRESS_ME_DRESS_CODES)[number];

export type DressMeEngine = 'baseline' | 'ai';

export interface DressMeLocationInput {
  latitude: number;
  longitude: number;
}

export interface DressMeRequestDto {
  occasion?: DressMeOccasion | undefined;
  dressCode?: DressMeDressCode | null | undefined;
  forAt?: string | undefined;
  location?: DressMeLocationInput | undefined;
  includeFragrance?: boolean | undefined;
  recommendationCount?: number | undefined;
  additionalContext?: string | undefined;
}

export const DRESS_ME_REASON_CODES = [
  'preferred-colors',
  'repeat-aware',
  'usual-size-match',
  'weather-layer',
  'weather-lightweight',
  'favorite-piece',
  'favorite-outfit-pattern',
  'occasion-aligned',
  'fragrance-paired',
] as const;
export type DressMeReasonCode = (typeof DRESS_ME_REASON_CODES)[number];

export const DRESS_ME_WARNING_CODES = [
  'weather-unavailable',
  'weather-not-requested',
  'physical-profile-missing',
  'preferences-missing',
  'fragrances-unavailable',
  'partial-outfit',
  'candidate-limit-reached',
] as const;
export type DressMeWarningCode = (typeof DRESS_ME_WARNING_CODES)[number];

export interface DressMeWeatherDto {
  locationLabel: string | null;
  at: string;
  temperatureC: number;
  feelsLikeC: number;
  condition: string;
  chanceOfRainPercent: number | null;
  chanceOfSnowPercent: number | null;
  windKph: number;
}

export interface DressMeRecommendationDto {
  wardrobeItemIds: string[];
  fragranceId: string | null;
  score: number;
  reasons: DressMeReasonCode[];
}

export interface DressMeResponseDto {
  forAt: string;
  generatedAt: string;
  engine: DressMeEngine;
  weather: DressMeWeatherDto | null;
  warnings: DressMeWarningCode[];
  recommendations: DressMeRecommendationDto[];
}

export interface DressMeProviderContext {
  request: {
    occasion: DressMeOccasion;
    includeFragrance: boolean;
    recommendationCount: number;
    dressCode: DressMeDressCode | null;
    forAt: string;
    additionalContext?: string | null | undefined;
  };
  wardrobeItems: WardrobeItemDto[];
  fragrances: FragranceDto[];
  savedOutfits: OutfitDto[];
  wearHistory: WearHistoryDto[];
  physicalProfile: PhysicalProfileDto | null;
  preferences: PreferencesDto | null;
  weather: DressMeWeatherDto | null;
}

export interface DressMeProviderRecommendation {
  wardrobeItemIds: string[];
  fragranceId: string | null;
  score: number;
  reasons: DressMeReasonCode[];
}

export type DressMeResult =
  | { ok: true; response: DressMeResponseDto }
  | { ok: false; reason: 'WARDROBE_EMPTY' | 'NO_RECOMMENDATION' | 'PROVIDER_UNAVAILABLE' };
