import { afterEach, describe, expect, it } from 'vitest';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IFragranceService } from '../../Wardrope.Core/services/ServicesInterface/Fragrance/fragrance.service.interface';
import type { IFragranceImageService } from '../../Wardrope.Core/services/ServicesInterface/FragranceImage/fragrance-image.service.interface';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type { IOutfitService, IWearHistoryService } from '../../Wardrope.Core/services/ServicesInterface/Outfit/outfit.service.interface';
import type { IPhysicalProfileService } from '../../Wardrope.Core/services/ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import type { IPreferencesService } from '../../Wardrope.Core/services/ServicesInterface/Preferences/preferences.service.interface';
import type { IProductImportService } from '../../Wardrope.Core/services/ServicesInterface/ProductImport/product-import.service.interface';
import type { IWardropeService } from '../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWeatherService } from '../../Wardrope.Core/services/ServicesInterface/Weather/weather.service.interface';
import { createApiRouter } from '.';

const healthService: IHealthService = {
  getStatus: () => ({ service: 'wardrope-server', environment: 'test', uptimeSeconds: 1, timestamp: new Date().toISOString(), database: 'connected' }),
  getReadiness: () => ({ ready: true, database: 'connected', timestamp: new Date().toISOString() }),
};

const authService = {
  register: async () => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' as const }),
  login: async () => ({ ok: false, reason: 'INVALID_CREDENTIALS' as const }),
  getSession: async () => ({ authenticated: false as const }),
  authenticate: async () => null,
  verifyCsrf: () => false,
  logout: async () => undefined,
} satisfies IAuthService;

const wardrobeService = {
  create: async () => { throw new Error('not used'); },
  list: async (_userId, query) => ({ items: [], pagination: { page: query.page, pageSize: query.pageSize, totalItems: 0, totalPages: 0 } }),
  getById: async () => null,
  update: async () => null,
  delete: async () => false,
} satisfies IWardrobeService;

const physicalProfileService: IPhysicalProfileService = {
  get: async () => null,
  replace: async () => { throw new Error('not used'); },
  reset: async () => undefined,
};

const productImportService: IProductImportService = {
  preview: async () => ({ ok: false, reason: 'SOURCE_UNAVAILABLE' }),
  importImage: async () => ({ ok: false, reason: 'SOURCE_UNAVAILABLE' }),
};

const preferencesService: IPreferencesService = {
  get: async () => null,
  replace: async () => { throw new Error('not used'); },
  reset: async () => undefined,
};

const weatherService: IWeatherService = {
  getContext: async () => ({ ok: false, reason: 'PROVIDER_UNAVAILABLE' }),
};

const fragranceService: IFragranceService = {
  create: async () => { throw new Error('not used'); },
  list: async (_userId, query) => ({ items: [], pagination: { page: query.page, pageSize: query.pageSize, totalItems: 0, totalPages: 0 } }),
  getById: async () => null,
  update: async () => null,
  delete: async () => false,
};

const fragranceImageService: IFragranceImageService = {
  replace: async () => ({ ok: false, reason: 'NOT_FOUND' }),
  read: async () => ({ ok: false, reason: 'NOT_FOUND' }),
  remove: async () => ({ ok: false, reason: 'NOT_FOUND' }),
};

const outfitService: IOutfitService = {
  create: async () => ({ ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' }),
  list: async (_userId, query) => ({ items: [], pagination: { page: query.page, pageSize: query.pageSize, totalItems: 0, totalPages: 0 } }),
  getById: async () => null,
  update: async () => ({ ok: false, reason: 'NOT_FOUND' }),
  delete: async () => false,
};

const wearHistoryService: IWearHistoryService = {
  create: async () => ({ ok: false, reason: 'WARDROBE_ITEM_NOT_FOUND' }),
  recordOutfitWear: async () => ({ ok: false, reason: 'OUTFIT_NOT_FOUND' }),
  list: async (_userId, query) => ({ items: [], pagination: { page: query.page, pageSize: query.pageSize, totalItems: 0, totalPages: 0 } }),
  getById: async () => null,
  update: async () => ({ ok: false, reason: 'NOT_FOUND' }),
  delete: async () => false,
};

const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

describe('createApiRouter feature composition', () => {
  it('allows isolated test routers to omit optional feature compositions', () => {
    process.env.NODE_ENV = 'test';
    expect(() => createApiRouter(healthService, authService, wardrobeService)).not.toThrow();
  });

  it('fails closed outside test when Physical Profile is not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(healthService, authService, wardrobeService)).toThrow(/Physical Profile service is required/i);
  });

  it('fails closed outside test when Product Import is not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(healthService, authService, wardrobeService, undefined, physicalProfileService)).toThrow(/Product Import service is required/i);
  });

  it('fails closed outside test when Preferences is not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(healthService, authService, wardrobeService, undefined, physicalProfileService, productImportService)).toThrow(/Preferences service is required/i);
  });

  it('fails closed outside test when Weather is not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(healthService, authService, wardrobeService, undefined, physicalProfileService, productImportService, preferencesService)).toThrow(/Weather service is required/i);
  });

  it('fails closed outside test when Fragrances are not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(healthService, authService, wardrobeService, undefined, physicalProfileService, productImportService, preferencesService, weatherService)).toThrow(/Fragrance services are required/i);
  });

  it('fails closed outside test when Outfits and Wear History are not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(
      healthService,
      authService,
      wardrobeService,
      undefined,
      physicalProfileService,
      productImportService,
      preferencesService,
      weatherService,
      fragranceService,
      fragranceImageService,
    )).toThrow(/Outfit and Wear History services are required/i);
  });

  it('allows production composition when required features are explicitly supplied', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(
      healthService,
      authService,
      wardrobeService,
      undefined,
      physicalProfileService,
      productImportService,
      preferencesService,
      weatherService,
      fragranceService,
      fragranceImageService,
      outfitService,
      wearHistoryService,
    )).not.toThrow();
  });
});
