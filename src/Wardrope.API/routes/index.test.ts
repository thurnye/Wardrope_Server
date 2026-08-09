import { afterEach, describe, expect, it } from 'vitest';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type { IPhysicalProfileService } from '../../Wardrope.Core/services/ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import type { IWardrobeService } from '../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import { createApiRouter } from '.';

const healthService: IHealthService = {
  getStatus: () => ({
    service: 'wardrope-server',
    environment: 'test',
    uptimeSeconds: 1,
    timestamp: new Date().toISOString(),
    database: 'connected',
  }),
  getReadiness: () => ({
    ready: true,
    database: 'connected',
    timestamp: new Date().toISOString(),
  }),
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
  list: async (_userId, query) => ({
    items: [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 0,
      totalPages: 0,
    },
  }),
  getById: async () => null,
  update: async () => null,
  delete: async () => false,
} satisfies IWardrobeService;

const physicalProfileService: IPhysicalProfileService = {
  get: async () => null,
  replace: async () => { throw new Error('not used'); },
  reset: async () => undefined,
};

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('createApiRouter physical profile composition', () => {
  it('allows isolated test routers to omit Physical Profile', () => {
    process.env.NODE_ENV = 'test';
    expect(() => createApiRouter(healthService, authService, wardrobeService)).not.toThrow();
  });

  it('fails closed outside test when Physical Profile is not wired', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(healthService, authService, wardrobeService)).toThrow(
      /Physical Profile service is required/i,
    );
  });

  it('allows production composition when Physical Profile is explicitly supplied', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createApiRouter(
      healthService,
      authService,
      wardrobeService,
      undefined,
      physicalProfileService,
    )).not.toThrow();
  });
});
