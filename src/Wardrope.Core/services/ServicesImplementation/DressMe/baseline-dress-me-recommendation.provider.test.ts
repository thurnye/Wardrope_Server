import { describe, expect, it } from 'vitest';
import type { DressMeProviderContext } from '../../../Models/DressMe/dress-me.model';
import type { WardrobeItemDto } from '../../../Models/Wardrobe/wardrobe.model';
import { BaselineDressMeRecommendationProvider } from './baseline-dress-me-recommendation.provider';

const NOW = '2026-08-09T15:00:00.000Z';
const TOP_ID = '64c000000000000000000001';
const BOTTOM_ID = '64c000000000000000000002';
const SHOE_ID = '64c000000000000000000003';

function item(
  id: string,
  category: WardrobeItemDto['category'],
  name: string,
  favorite = false,
): WardrobeItemDto {
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
    favorite,
    sourceUrl: null,
    image: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function context(): DressMeProviderContext {
  return {
    request: {
      occasion: 'business',
      dressCode: 'business-casual',
      forAt: NOW,
      includeFragrance: false,
      recommendationCount: 3,
    },
    wardrobeItems: [
      item(TOP_ID, 'top', 'Oxford shirt', true),
      item(BOTTOM_ID, 'bottom', 'Chino trouser'),
      item(SHOE_ID, 'footwear', 'Leather loafer'),
    ],
    fragrances: [],
    savedOutfits: [],
    wearHistory: [],
    physicalProfile: null,
    preferences: {
      preferredAesthetics: ['smart-casual'],
      avoidedAesthetics: [],
      preferredColors: ['Navy'],
      avoidedColors: [],
      experimentationLevel: 'balanced',
      accessoryLevel: 'minimal',
      patternLevel: 'minimal',
      layeringLevel: 'balanced',
      repeatPreference: 'maximize-variety',
      updatedAt: NOW,
    },
    weather: {
      locationLabel: 'Toronto, Ontario, Canada',
      at: NOW,
      temperatureC: 25,
      feelsLikeC: 26,
      condition: 'Clear',
      chanceOfRainPercent: 0,
      chanceOfSnowPercent: 0,
      windKph: 8,
    },
  };
}

describe('BaselineDressMeRecommendationProvider', () => {
  it('builds an owned top + bottom composition and prefers business-aligned pieces', async () => {
    const provider = new BaselineDressMeRecommendationProvider();
    const recommendations = await provider.recommend(context());

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.wardrobeItemIds).toEqual(expect.arrayContaining([TOP_ID, BOTTOM_ID]));
    expect(recommendations[0]?.reasons).toEqual(expect.arrayContaining([
      'preferred-colors',
      'occasion-aligned',
    ]));
    expect(recommendations[0]?.score).toBeGreaterThan(55);
  });

  it('penalizes recently repeated pieces when variety is preferred', async () => {
    const provider = new BaselineDressMeRecommendationProvider();
    const base = context();
    base.wardrobeItems.push(item('64c000000000000000000004', 'top', 'Second Oxford shirt'));
    base.wearHistory = [{
      id: '64f000000000000000000001',
      wornAt: '2026-08-08T15:00:00.000Z',
      wardrobeItemIds: [TOP_ID],
      fragranceId: null,
      sourceOutfitId: null,
      source: 'manual',
      createdAt: '2026-08-08T15:01:00.000Z',
      updatedAt: '2026-08-08T15:01:00.000Z',
    }];

    const recommendations = await provider.recommend(base);
    expect(recommendations[0]?.wardrobeItemIds).not.toContain(TOP_ID);
  });
});
