import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedRequestContext,
  LoginRequestDto,
  RegisterRequestDto,
  SessionStatusDto,
} from '../../../Wardrope.Core/Models/Auth/auth.model';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IOutfitService, IWearHistoryService } from '../../../Wardrope.Core/services/ServicesInterface/Outfit/outfit.service.interface';
import { createApp } from '../../server/app';
import { createOutfitRoutes } from './outfit.routes';

const USER_A = '64b000000000000000000001';
const SESSION_A = 'session-a';
const CSRF_A = 'csrf-a';
const OUTFIT_ID = '64e000000000000000000001';
const ITEM_ID = '64c000000000000000000001';
const HISTORY_ID = '64f000000000000000000001';
const WORN_AT = '2026-08-09T14:00:00.000Z';

function authContext(): AuthenticatedRequestContext {
  return {
    sessionId: 'record-a',
    csrfTokenHash: CSRF_A,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: USER_A,
      email: 'a@example.com',
      displayName: 'User A',
      createdAt: '2026-08-09T00:00:00.000Z',
    },
  };
}

const authService: IAuthService = {
  register: async (_request: RegisterRequestDto) => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' }),
  login: async (_request: LoginRequestDto) => ({ ok: false, reason: 'INVALID_CREDENTIALS' }),
  getSession: async (): Promise<SessionStatusDto> => ({ authenticated: false }),
  authenticate: async (token) => token === SESSION_A ? authContext() : null,
  verifyCsrf: (context, csrf) => context.csrfTokenHash === csrf,
  logout: async () => undefined,
};

const outfit = {
  id: OUTFIT_ID,
  name: 'Dinner look',
  wardrobeItemIds: [ITEM_ID],
  fragranceId: null,
  favorite: false,
  createdAt: '2026-08-09T13:00:00.000Z',
  updatedAt: '2026-08-09T13:00:00.000Z',
};

const historyEntry = {
  id: HISTORY_ID,
  wornAt: WORN_AT,
  wardrobeItemIds: [ITEM_ID],
  fragranceId: null,
  sourceOutfitId: OUTFIT_ID,
  source: 'saved-outfit' as const,
  createdAt: '2026-08-09T14:01:00.000Z',
  updatedAt: '2026-08-09T14:01:00.000Z',
};

function buildApp(overrides?: {
  outfitService?: Partial<IOutfitService>;
  wearHistoryService?: Partial<IWearHistoryService>;
}) {
  const outfitService: IOutfitService = {
    create: vi.fn().mockResolvedValue({ ok: true, outfit }),
    list: vi.fn().mockResolvedValue({ items: [outfit], pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 } }),
    getById: vi.fn().mockResolvedValue(outfit),
    update: vi.fn().mockResolvedValue({ ok: true, outfit }),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides?.outfitService,
  };
  const wearHistoryService: IWearHistoryService = {
    create: vi.fn().mockResolvedValue({ ok: true, entry: { ...historyEntry, sourceOutfitId: null, source: 'manual' } }),
    recordOutfitWear: vi.fn().mockResolvedValue({ ok: true, entry: historyEntry }),
    list: vi.fn().mockResolvedValue({ items: [historyEntry], pagination: { page: 1, pageSize: 30, totalItems: 1, totalPages: 1 } }),
    getById: vi.fn().mockResolvedValue(historyEntry),
    update: vi.fn().mockResolvedValue({ ok: true, entry: historyEntry }),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides?.wearHistoryService,
  };
  const api = Router();
  api.use('/outfits', createOutfitRoutes(outfitService, wearHistoryService, authService));
  return { app: createApp(api), outfitService, wearHistoryService };
}

function asUser(test: request.Test, csrf?: string) {
  test.set('Origin', 'http://localhost:5173').set('Cookie', `wardrope_session=${SESSION_A}`);
  if (csrf) test.set('X-CSRF-Token', csrf);
  return test;
}

describe('Outfits and Wear History API', () => {
  it('requires authentication and CSRF for writes', async () => {
    const { app } = buildApp();
    await request(app).get('/api/v1/outfits').set('Origin', 'http://localhost:5173').expect(401);
    await asUser(request(app).post('/api/v1/outfits')).send({ name: 'Dinner', wardrobeItemIds: [ITEM_ID] }).expect(403);
  });

  it('rejects caller-selected ownership and wear provenance', async () => {
    const { app, outfitService, wearHistoryService } = buildApp();
    await asUser(request(app).post('/api/v1/outfits'), CSRF_A)
      .send({ name: 'Dinner', wardrobeItemIds: [ITEM_ID], userId: USER_A })
      .expect(400);
    await asUser(request(app).post('/api/v1/outfits/wear-history'), CSRF_A)
      .send({ wornAt: WORN_AT, wardrobeItemIds: [ITEM_ID], source: 'dress-me' })
      .expect(400);
    await asUser(request(app).post('/api/v1/outfits/wear-history'), CSRF_A)
      .send({ wornAt: WORN_AT, wardrobeItemIds: [ITEM_ID], sourceOutfitId: OUTFIT_ID })
      .expect(400);
    expect(outfitService.create).not.toHaveBeenCalled();
    expect(wearHistoryService.create).not.toHaveBeenCalled();
  });

  it('records a saved outfit wear through the dedicated server provenance endpoint', async () => {
    const { app, wearHistoryService } = buildApp();
    const response = await asUser(request(app).post(`/api/v1/outfits/${OUTFIT_ID}/wear`), CSRF_A)
      .send({ wornAt: WORN_AT })
      .expect(201);
    expect(wearHistoryService.recordOutfitWear).toHaveBeenCalledWith(USER_A, OUTFIT_ID, WORN_AT);
    expect(response.body.data).toMatchObject({ source: 'saved-outfit', sourceOutfitId: OUTFIT_ID });
  });

  it('rejects future wear timestamps and duplicate wardrobe IDs', async () => {
    const { app, wearHistoryService } = buildApp();
    await asUser(request(app).post('/api/v1/outfits/wear-history'), CSRF_A)
      .send({ wornAt: '2099-01-01T00:00:00.000Z', wardrobeItemIds: [ITEM_ID] })
      .expect(400);
    await asUser(request(app).post('/api/v1/outfits/wear-history'), CSRF_A)
      .send({ wornAt: WORN_AT, wardrobeItemIds: [ITEM_ID, ITEM_ID] })
      .expect(400);
    expect(wearHistoryService.create).not.toHaveBeenCalled();
  });

  it('exposes no userId in successful outfit or history payloads', async () => {
    const { app } = buildApp();
    const outfits = await asUser(request(app).get('/api/v1/outfits')).expect(200);
    const history = await asUser(request(app).get('/api/v1/outfits/wear-history')).expect(200);
    expect(JSON.stringify(outfits.body.data)).not.toContain('userId');
    expect(JSON.stringify(history.body.data)).not.toContain('userId');
  });
});
