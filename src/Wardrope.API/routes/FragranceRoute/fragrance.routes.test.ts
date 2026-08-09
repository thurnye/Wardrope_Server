import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedRequestContext,
  LoginRequestDto,
  RegisterRequestDto,
  SessionStatusDto,
} from '../../../Wardrope.Core/Models/Auth/auth.model';
import { FragranceService } from '../../../Wardrope.Core/services/ServicesImplementation/Fragrance/fragrance.service';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IFragranceImageService } from '../../../Wardrope.Core/services/ServicesInterface/FragranceImage/fragrance-image.service.interface';
import type { IApplicationLogger } from '../../../Wardrope.Core/services/ServicesInterface/Logging/application-logger.service.interface';
import type { IFileStorageService } from '../../../Wardrope.Core/services/ServicesInterface/Storage/file-storage.service.interface';
import type {
  FragranceRecord,
  FragranceRepositoryQuery,
  IFragranceRepository,
} from '../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';
import { createApp } from '../../server/app';
import { createFragranceImageRoutes } from '../FragranceImageRoute/fragrance-image.routes';
import { createFragranceRoutes } from './fragrance.routes';

const USER_A = '64b000000000000000000001';
const USER_B = '64b000000000000000000002';
const FRAGRANCE_ID = '64d000000000000000000001';
const SESSION_A = 'session-a';
const SESSION_B = 'session-b';
const CSRF_A = 'csrf-a';
const CSRF_B = 'csrf-b';

function authContext(userId: string, sessionId: string, csrf: string): AuthenticatedRequestContext {
  return {
    sessionId,
    csrfTokenHash: csrf,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: userId,
      email: `${userId === USER_A ? 'a' : 'b'}@example.com`,
      displayName: userId === USER_A ? 'User A' : 'User B',
      createdAt: '2026-08-09T00:00:00.000Z',
    },
  };
}

const authService: IAuthService = {
  register: async (_request: RegisterRequestDto) => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' }),
  login: async (_request: LoginRequestDto) => ({ ok: false, reason: 'INVALID_CREDENTIALS' }),
  getSession: async (): Promise<SessionStatusDto> => ({ authenticated: false }),
  authenticate: async (token) => token === SESSION_A
    ? authContext(USER_A, 'record-a', CSRF_A)
    : token === SESSION_B ? authContext(USER_B, 'record-b', CSRF_B) : null,
  verifyCsrf: (context, csrf) => context.csrfTokenHash === csrf,
  logout: async () => undefined,
};

class FakeFragranceRepository implements IFragranceRepository {
  private readonly records = new Map<string, FragranceRecord>();

  async create(userId: string, input: Parameters<IFragranceRepository['create']>[1]) {
    const now = new Date('2026-08-09T15:00:00.000Z');
    const record: FragranceRecord = {
      id: FRAGRANCE_ID,
      userId,
      brand: input.brand,
      name: input.name,
      productLine: input.productLine ?? null,
      concentration: input.concentration ?? null,
      fragranceFamily: input.fragranceFamily ?? null,
      scentType: input.scentType ?? null,
      keyNotes: [...(input.keyNotes ?? [])],
      bottleSizeMl: input.bottleSizeMl ?? null,
      amountRemainingPercent: input.amountRemainingPercent ?? null,
      purchaseDate: input.purchaseDate ?? null,
      purchasePrice: input.purchasePrice ?? null,
      available: input.available ?? true,
      image: null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(`${userId}:${FRAGRANCE_ID}`, record);
    return record;
  }

  async list(userId: string, query: FragranceRepositoryQuery) {
    const items = [...this.records.values()].filter((record) =>
      record.userId === userId
      && (query.available === undefined || record.available === query.available)
      && (!query.concentration || record.concentration === query.concentration)
      && (!query.search || `${record.brand} ${record.name}`.toLowerCase().includes(query.search.toLowerCase())),
    );
    return { items, totalItems: items.length };
  }

  async findById(userId: string, fragranceId: string) {
    return this.records.get(`${userId}:${fragranceId}`) ?? null;
  }

  async update(userId: string, fragranceId: string, input: Parameters<IFragranceRepository['update']>[2]) {
    const current = await this.findById(userId, fragranceId);
    if (!current) return null;
    const updated: FragranceRecord = { ...current, ...input, updatedAt: new Date('2026-08-09T16:00:00.000Z') };
    this.records.set(`${userId}:${fragranceId}`, updated);
    return updated;
  }

  async deleteWithRecord(userId: string, fragranceId: string) {
    const key = `${userId}:${fragranceId}`;
    const record = this.records.get(key) ?? null;
    this.records.delete(key);
    return record;
  }

  async replaceImage() { return null; }
  async clearImage() { return null; }
  async ensureIndexes() { return undefined; }
}

function buildApp(imageService?: IFragranceImageService) {
  const repository = new FakeFragranceRepository();
  const storage: IFileStorageService = {
    storePrivateFile: vi.fn(), getPrivateFile: vi.fn(), deletePrivateFile: vi.fn(), shutdown: vi.fn(),
  };
  const logger: IApplicationLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const fragranceService = new FragranceService(repository, storage, logger);
  const api = Router();
  api.use('/fragrances', createFragranceRoutes(fragranceService, authService));
  if (imageService) api.use('/fragrances', createFragranceImageRoutes(imageService, fragranceService, authService));
  return { app: createApp(api), fragranceService };
}

function asUser(test: request.Test, session = SESSION_A, csrf?: string) {
  test.set('Origin', 'http://localhost:5173').set('Cookie', `wardrope_session=${session}`);
  if (csrf) test.set('X-CSRF-Token', csrf);
  return test;
}

const validBody = {
  brand: 'Maison Francis Kurkdjian',
  name: 'Baccarat Rouge 540',
  concentration: 'eau-de-parfum',
  fragranceFamily: 'Amber Floral',
  keyNotes: ['Jasmine', 'Saffron', 'Cedar'],
  bottleSizeMl: 70,
  amountRemainingPercent: 80,
  purchasePrice: { amount: 450, currency: 'cad' },
  available: true,
};

describe('Fragrances API', () => {
  it('requires auth and CSRF for mutations', async () => {
    const { app } = buildApp();
    await request(app).get('/api/v1/fragrances').set('Origin', 'http://localhost:5173').expect(401);
    await asUser(request(app).post('/api/v1/fragrances')).send(validBody).expect(403);
  });

  it('creates, reads, edits, lists, and deletes owner-scoped fragrance facts', async () => {
    const { app } = buildApp();
    const created = await asUser(request(app).post('/api/v1/fragrances'), SESSION_A, CSRF_A).send(validBody).expect(201);
    expect(created.body.data).toMatchObject({
      brand: validBody.brand,
      name: validBody.name,
      purchasePrice: { amount: 450, currency: 'CAD' },
      available: true,
    });
    expect(created.body.data.userId).toBeUndefined();
    expect(created.body.data.image?.objectKey).toBeUndefined();

    const id = created.body.data.id as string;
    expect((await asUser(request(app).get(`/api/v1/fragrances/${id}`)).expect(200)).body.data.name).toBe(validBody.name);
    await asUser(request(app).patch(`/api/v1/fragrances/${id}`), SESSION_A, CSRF_A).send({ amountRemainingPercent: 55 }).expect(200);
    expect((await asUser(request(app).get('/api/v1/fragrances?available=true&search=Baccarat')).expect(200)).body.data.items).toHaveLength(1);
    await asUser(request(app).delete(`/api/v1/fragrances/${id}`), SESSION_A, CSRF_A).expect(200);
    await asUser(request(app).get(`/api/v1/fragrances/${id}`)).expect(404);
  });

  it('rejects recommendation/context labels and client ownership fields', async () => {
    for (const forbidden of [
      { tags: ['date-night'] },
      { occasion: 'office' },
      { season: 'summer' },
      { sexy: true },
      { userId: USER_B },
    ]) {
      const { app } = buildApp();
      const response = await asUser(request(app).post('/api/v1/fragrances'), SESSION_A, CSRF_A)
        .send({ ...validBody, ...forbidden })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('keeps another account from reading or mutating a fragrance', async () => {
    const { app } = buildApp();
    const id = (await asUser(request(app).post('/api/v1/fragrances'), SESSION_A, CSRF_A).send(validBody).expect(201)).body.data.id;
    await asUser(request(app).get(`/api/v1/fragrances/${id}`), SESSION_B).expect(404);
    await asUser(request(app).patch(`/api/v1/fragrances/${id}`), SESSION_B, CSRF_B).send({ available: false }).expect(404);
  });

  it('checks ownership before buffering an uploaded bottle image', async () => {
    const imageService: IFragranceImageService = {
      replace: vi.fn(),
      read: vi.fn().mockResolvedValue({ ok: false, reason: 'NOT_FOUND' }),
      remove: vi.fn(),
    };
    const { app } = buildApp(imageService);
    await asUser(request(app).put(`/api/v1/fragrances/${FRAGRANCE_ID}/image`), SESSION_A, CSRF_A)
      .attach('image', Buffer.alloc(10), { filename: 'bottle.png', contentType: 'image/png' })
      .expect(404);
    expect(imageService.replace).not.toHaveBeenCalled();
  });
});
