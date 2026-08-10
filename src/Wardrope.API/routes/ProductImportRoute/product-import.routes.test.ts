import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedRequestContext,
  LoginRequestDto,
  RegisterRequestDto,
  SessionStatusDto,
} from '../../../Wardrope.Core/Models/Auth/auth.model';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type { IProductImportService } from '../../../Wardrope.Core/services/ServicesInterface/ProductImport/product-import.service.interface';
import type { IWardrobeService } from '../../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import { createApp } from '../../server/app';
import { createApiRouter } from '..';

const USER_ID = '64b000000000000000000001';
const ITEM_ID = '64c000000000000000000001';
const SESSION = 'session-a';
const CSRF = 'csrf-a';

function authContext(): AuthenticatedRequestContext {
  return {
    sessionId: 'session-record-a',
    csrfTokenHash: CSRF,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    user: {
      id: USER_ID,
      email: 'a@example.com',
      displayName: 'User A',
      createdAt: '2026-08-09T00:00:00.000Z',
    },
  };
}

const authService: IAuthService = {
  register: async (_request: RegisterRequestDto) => ({
    ok: false,
    reason: 'EMAIL_UNAVAILABLE',
  }),
  login: async (_request: LoginRequestDto) => ({
    ok: false,
    reason: 'INVALID_CREDENTIALS',
  }),
  getSession: async (): Promise<SessionStatusDto> => ({ authenticated: false }),
  authenticate: async (sessionToken) =>
    sessionToken === SESSION ? authContext() : null,
  verifyCsrf: (context, csrfToken) => context.csrfTokenHash === csrfToken,
  logout: async () => undefined,
};

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

const wardrobeService: IWardrobeService = {
  create: async () => {
    throw new Error('not used');
  },
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
};

const productImportService: IProductImportService = {
  preview: vi.fn(),
  importImage: vi.fn(),
};

function buildApp() {
  return createApp(
    createApiRouter(
      healthService,
      authService,
      wardrobeService,
      undefined,
      undefined,
      productImportService,
    ),
  );
}

function asUser<T extends { set(field: string, value: string): T }>(
  req: T,
  csrf?: string,
): T {
  req.set('Origin', 'http://localhost:5173');
  req.set('Cookie', `wardrope_session=${SESSION}`);
  if (csrf) req.set('X-CSRF-Token', csrf);
  return req;
}

beforeEach(() => {
  vi.mocked(productImportService.preview).mockReset();
  vi.mocked(productImportService.importImage).mockReset();
});

describe('Wardrope product link import API', () => {
  it('requires authentication before previewing a remote product page', async () => {
    await request(buildApp())
      .post('/api/v1/wardrobe/import-preview')
      .set('Origin', 'http://localhost:5173')
      .send({ sourceUrl: 'https://shop.example/product' })
      .expect(401);

    expect(productImportService.preview).not.toHaveBeenCalled();
  });

  it('requires CSRF before triggering an outbound product preview', async () => {
    await asUser(request(buildApp()).post('/api/v1/wardrobe/import-preview'))
      .send({ sourceUrl: 'https://shop.example/product' })
      .expect(403);

    expect(productImportService.preview).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS and unknown preview fields before the importer runs', async () => {
    const invalidUrl = await asUser(
      request(buildApp()).post('/api/v1/wardrobe/import-preview'),
      CSRF,
    )
      .send({ sourceUrl: 'http://shop.example/product' })
      .expect(400);
    expect(invalidUrl.body.error.code).toBe('VALIDATION_ERROR');

    await asUser(
      request(buildApp()).post('/api/v1/wardrobe/import-preview'),
      CSRF,
    )
      .send({
        sourceUrl: 'https://shop.example/product',
        imageUrl: 'https://attacker.example/a.jpg',
      })
      .expect(400);

    expect(productImportService.preview).not.toHaveBeenCalled();
  });

  it('returns only bounded product suggestions and image availability', async () => {
    vi.mocked(productImportService.preview).mockResolvedValueOnce({
      ok: true,
      preview: {
        sourceUrl: 'https://shop.example/product',
        name: 'Navy Sneaker',
        brand: 'Example',
        colors: ['Navy'],
        materials: ['Leather'],
        suggestedCategory: 'footwear',
        suggestedSubcategory: 'Sneakers',
        imageAvailable: true,
        imageUrls: ['https://shop.example/product/image-1.jpg'],
      },
    });

    const response = await asUser(
      request(buildApp()).post('/api/v1/wardrobe/import-preview'),
      CSRF,
    )
      .send({ sourceUrl: 'https://shop.example/product' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      name: 'Navy Sneaker',
      sourceUrl: 'https://shop.example/product',
      imageAvailable: true,
    });
    expect(response.body.data.imageUrls).toEqual([
      'https://shop.example/product/image-1.jpg',
    ]);
  });

  it('imports the source image using only the authenticated owner and stored item source link', async () => {
    vi.mocked(productImportService.importImage).mockResolvedValueOnce({
      ok: true,
      item: {
        id: ITEM_ID,
        name: 'Navy Sneaker',
        category: 'footwear',
        subcategory: 'Sneakers',
        brand: 'Example',
        colors: ['Navy'],
        materials: ['Leather'],
        pattern: null,
        size: null,
        favorite: false,
        sourceUrl: 'https://shop.example/product',
        images: [],
        createdAt: '2026-08-09T12:00:00.000Z',
        updatedAt: '2026-08-09T12:00:00.000Z',
      },
    });

    await asUser(
      request(buildApp()).post(
        `/api/v1/wardrobe/${ITEM_ID}/image/import-source`,
      ),
      CSRF,
    )
      .send({})
      .expect(200);

    expect(productImportService.importImage).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
    );
  });

  it('rejects hostile browser origins before product import', async () => {
    await request(buildApp())
      .post('/api/v1/wardrobe/import-preview')
      .set('Origin', 'https://evil.example')
      .set('Cookie', `wardrope_session=${SESSION}`)
      .set('X-CSRF-Token', CSRF)
      .send({ sourceUrl: 'https://shop.example/product' })
      .expect(403);

    expect(productImportService.preview).not.toHaveBeenCalled();
  });
});
