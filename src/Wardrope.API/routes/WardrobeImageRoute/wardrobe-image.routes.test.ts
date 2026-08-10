import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type { IWardrobeService } from '../../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWardrobeImageService } from '../../../Wardrope.Core/services/ServicesInterface/WardrobeImage/wardrobe-image.service.interface';
import { createApp } from '../../server/app';
import { createApiRouter } from '..';

const USER_ID = '64b000000000000000000001';
const ITEM_ID = '64c000000000000000000001';
const SESSION = 'session-a';
const CSRF = 'csrf-a';

const item = {
  id: ITEM_ID,
  name: 'Navy Blazer',
  category: 'outerwear' as const,
  subcategory: 'Blazer',
  brand: 'Canali',
  colors: ['Navy'],
  materials: ['Wool'],
  pattern: 'solid' as const,
  size: '40R',
  favorite: false,
  images: [{
    contentType: 'image/webp' as const,
    width: 800,
    height: 1200,
    sizeBytes: 13,
    updatedAt: '2026-08-09T06:00:00.000Z',
  }],
  createdAt: '2026-08-09T05:00:00.000Z',
  updatedAt: '2026-08-09T06:00:00.000Z',
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

const authService: IAuthService = {
  register: async () => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' }),
  login: async () => ({ ok: false, reason: 'INVALID_CREDENTIALS' }),
  getSession: async () => ({ authenticated: false }),
  authenticate: async (token) => token === SESSION
    ? {
        sessionId: 'session-record',
        csrfTokenHash: CSRF,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: USER_ID,
          email: 'a@example.com',
          displayName: 'User A',
          createdAt: '2026-08-09T00:00:00.000Z',
        },
      }
    : null,
  verifyCsrf: (context, csrfToken) => context.csrfTokenHash === csrfToken,
  logout: async () => undefined,
};

function harness(itemExists = true) {
  const wardrobeService: IWardrobeService = {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn().mockResolvedValue(itemExists ? item : null),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as IWardrobeService;

  const imageService: IWardrobeImageService = {
    replace: vi.fn().mockResolvedValue({ ok: true, item }),
    read: vi.fn().mockResolvedValue({
      ok: true,
      image: {
        body: Buffer.from('private-image'),
        contentType: 'image/webp',
        contentLength: 13,
        etag: '"private-etag"',
        lastModified: new Date('2026-08-09T06:00:00.000Z'),
      },
    }),
    remove: vi.fn().mockResolvedValue({ ok: true, item: { ...item, images: [] } }),
  };

  return {
    app: createApp(createApiRouter(healthService, authService, wardrobeService, imageService)),
    wardrobeService,
    imageService,
  };
}

function authenticated<T extends { set(field: string, value: string): T }>(req: T, csrf = true): T {
  req.set('Origin', 'http://localhost:5173');
  req.set('Cookie', `wardrope_session=${SESSION}`);
  if (csrf) req.set('X-CSRF-Token', CSRF);
  return req;
}

describe('Wardrope wardrobe image API', () => {
  it('reads a selected image index without rejecting the additional route parameter', async () => {
    const { app, imageService } = harness();
    await authenticated(request(app).get(`/api/v1/wardrobe/${ITEM_ID}/images/2`), false)
      .expect(200);
    expect(imageService.read).toHaveBeenCalledWith(USER_ID, ITEM_ID, 2);
  });

  it('requires authentication for private image reads', async () => {
    const { app } = harness();
    const response = await request(app)
      .get(`/api/v1/wardrobe/${ITEM_ID}/image`)
      .set('Origin', 'http://localhost:5173')
      .expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('requires CSRF before multipart parsing for image writes', async () => {
    const { app, imageService } = harness();
    const response = await authenticated(
      request(app).put(`/api/v1/wardrobe/${ITEM_ID}/image`),
      false,
    )
      .attach('image', Buffer.alloc(11 * 1024 * 1024), 'oversized.jpg')
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    expect(imageService.replace).not.toHaveBeenCalled();
  });

  it('checks ownership before buffering an oversized upload', async () => {
    const { app, imageService } = harness(false);
    const response = await authenticated(
      request(app).put(`/api/v1/wardrobe/${ITEM_ID}/image`),
    )
      .attach('image', Buffer.alloc(11 * 1024 * 1024), 'oversized.jpg')
      .expect(404);

    expect(response.body.error.code).toBe('WARDROBE_ITEM_NOT_FOUND');
    expect(imageService.replace).not.toHaveBeenCalled();
  });

  it('rejects oversized multipart files after authentication and ownership checks', async () => {
    const { app, imageService } = harness();
    const response = await authenticated(
      request(app).put(`/api/v1/wardrobe/${ITEM_ID}/image`),
    )
      .attach('image', Buffer.alloc(11 * 1024 * 1024), 'oversized.jpg')
      .expect(413);

    expect(response.body.error.code).toBe('WARDROBE_IMAGE_TOO_LARGE');
    expect(imageService.replace).not.toHaveBeenCalled();
  });

  it('passes one buffered image to the Core service and never exposes storage keys', async () => {
    const { app, imageService } = harness();
    const response = await authenticated(
      request(app).put(`/api/v1/wardrobe/${ITEM_ID}/image`),
    )
      .attach('image', Buffer.from('not-decoded-here'), {
        filename: '../../attacker-name.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(imageService.replace).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      expect.objectContaining({ declaredContentType: 'image/png' }),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/objectKey|bucket|s3/i);
  });

  it('serves private binary image content with revalidation caching', async () => {
    const { app } = harness();
    const response = await authenticated(
      request(app).get(`/api/v1/wardrobe/${ITEM_ID}/image`),
      false,
    ).expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/webp/);
    expect(response.headers['cache-control']).toBe('private, no-cache');
    expect(response.headers.etag).toBe('"private-etag"');
    expect(response.body).toEqual(Buffer.from('private-image'));

    await authenticated(
      request(app)
        .get(`/api/v1/wardrobe/${ITEM_ID}/image`)
        .set('If-None-Match', '"private-etag"'),
      false,
    ).expect(304);
  });

  it('removes an image through an authenticated CSRF-protected request', async () => {
    const { app, imageService } = harness();
    const response = await authenticated(
      request(app).delete(`/api/v1/wardrobe/${ITEM_ID}/image`),
    ).expect(200);

    expect(imageService.remove).toHaveBeenCalledWith(USER_ID, ITEM_ID);
    expect(response.body.data.images).toEqual([]);
  });
});
