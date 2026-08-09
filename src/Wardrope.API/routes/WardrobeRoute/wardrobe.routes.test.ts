import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type {
  AuthenticatedRequestContext,
  LoginRequestDto,
  RegisterRequestDto,
  SessionStatusDto,
} from '../../../Wardrope.Core/Models/Auth/auth.model';
import type {
  CreateWardrobeItemDto,
  UpdateWardrobeItemDto,
  WardrobeCategory,
} from '../../../Wardrope.Core/Models/Wardrobe/wardrobe.model';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import { WardrobeService } from '../../../Wardrope.Core/services/ServicesImplementation/Wardrobe/wardrobe.service';
import type {
  IWardrobeRepository,
  WardrobeItemRecord,
  WardrobeRepositoryListResult,
  WardrobeRepositoryQuery,
} from '../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import { createApp } from '../../server/app';
import { createApiRouter } from '..';

const USER_A_ID = '64b000000000000000000001';
const USER_B_ID = '64b000000000000000000002';
const SESSION_A = 'session-a';
const SESSION_B = 'session-b';
const CSRF_A = 'csrf-a';
const CSRF_B = 'csrf-b';

function publicUser(id: string, email: string) {
  return {
    id,
    email,
    displayName: email.startsWith('a@') ? 'User A' : 'User B',
    createdAt: '2026-08-09T00:00:00.000Z',
  };
}

function authContext(
  userId: string,
  email: string,
  sessionId: string,
  csrfTokenHash: string,
): AuthenticatedRequestContext {
  return {
    sessionId,
    csrfTokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    user: publicUser(userId, email),
  };
}

const authService: IAuthService = {
  register: async (_request: RegisterRequestDto) => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' }),
  login: async (_request: LoginRequestDto) => ({ ok: false, reason: 'INVALID_CREDENTIALS' }),
  getSession: async (): Promise<SessionStatusDto> => ({ authenticated: false }),
  authenticate: async (sessionToken) => {
    if (sessionToken === SESSION_A) {
      return authContext(USER_A_ID, 'a@example.com', 'session-record-a', CSRF_A);
    }

    if (sessionToken === SESSION_B) {
      return authContext(USER_B_ID, 'b@example.com', 'session-record-b', CSRF_B);
    }

    return null;
  },
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

class FakeWardrobeRepository implements IWardrobeRepository {
  private readonly items = new Map<string, WardrobeItemRecord>();
  private sequence = 0;

  private nextId(): string {
    this.sequence += 1;
    return this.sequence.toString(16).padStart(24, '0');
  }

  async create(userId: string, input: CreateWardrobeItemDto): Promise<WardrobeItemRecord> {
    const now = new Date();
    const item: WardrobeItemRecord = {
      id: this.nextId(),
      userId,
      name: input.name,
      category: input.category,
      subcategory: input.subcategory,
      brand: input.brand ?? null,
      colors: [...input.colors],
      materials: [...(input.materials ?? [])],
      pattern: input.pattern ?? null,
      size: input.size ?? null,
      favorite: input.favorite ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(item.id, item);
    return { ...item, colors: [...item.colors], materials: [...item.materials] };
  }

  async list(
    userId: string,
    query: WardrobeRepositoryQuery,
  ): Promise<WardrobeRepositoryListResult> {
    let items = [...this.items.values()].filter((item) => item.userId === userId);

    if (query.category) {
      items = items.filter((item) => item.category === query.category);
    }

    if (query.favorite !== undefined) {
      items = items.filter((item) => item.favorite === query.favorite);
    }

    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter((item) =>
        [item.name, item.brand ?? '', item.subcategory]
          .some((value) => value.toLowerCase().includes(needle)),
      );
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const totalItems = items.length;
    const start = (query.page - 1) * query.pageSize;

    return {
      items: items.slice(start, start + query.pageSize).map((item) => ({
        ...item,
        colors: [...item.colors],
        materials: [...item.materials],
      })),
      totalItems,
    };
  }

  async findById(userId: string, itemId: string): Promise<WardrobeItemRecord | null> {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) {
      return null;
    }

    return { ...item, colors: [...item.colors], materials: [...item.materials] };
  }

  async update(
    userId: string,
    itemId: string,
    input: UpdateWardrobeItemDto,
  ): Promise<WardrobeItemRecord | null> {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) {
      return null;
    }

    const updated: WardrobeItemRecord = {
      ...item,
      ...input,
      colors: input.colors ? [...input.colors] : [...item.colors],
      materials: input.materials ? [...input.materials] : [...item.materials],
      updatedAt: new Date(item.updatedAt.getTime() + 1_000),
    };
    this.items.set(itemId, updated);
    return { ...updated, colors: [...updated.colors], materials: [...updated.materials] };
  }

  async delete(userId: string, itemId: string): Promise<boolean> {
    const item = this.items.get(itemId);
    if (!item || item.userId !== userId) {
      return false;
    }

    return this.items.delete(itemId);
  }

  async ensureIndexes(): Promise<void> {
    return undefined;
  }
}

function buildWardrobeApp() {
  const repository = new FakeWardrobeRepository();
  const wardrobeService = new WardrobeService(repository);
  return createApp(createApiRouter(healthService, authService, wardrobeService));
}

type HeaderSettable<T> = {
  set(field: string, value: string): T;
};

function asUser<T extends HeaderSettable<T>>(
  req: T,
  sessionToken = SESSION_A,
  csrfToken?: string,
): T {
  req.set('Origin', 'http://localhost:5173');
  req.set('Cookie', `wardrope_session=${sessionToken}`);
  if (csrfToken) {
    req.set('X-CSRF-Token', csrfToken);
  }
  return req;
}

async function createItem(
  app: ReturnType<typeof buildWardrobeApp>,
  input: Partial<CreateWardrobeItemDto> = {},
  sessionToken = SESSION_A,
  csrfToken = CSRF_A,
) {
  return asUser(
    request(app).post('/api/v1/wardrobe'),
    sessionToken,
    csrfToken,
  )
    .send({
      name: 'Navy Blazer',
      category: 'outerwear' satisfies WardrobeCategory,
      subcategory: 'Blazer',
      colors: ['Navy'],
      ...input,
    })
    .expect(201);
}

describe('Wardrope wardrobe API', () => {
  it('requires authentication for wardrobe reads', async () => {
    const response = await request(buildWardrobeApp())
      .get('/api/v1/wardrobe')
      .set('Origin', 'http://localhost:5173')
      .expect(401);

    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('requires CSRF for wardrobe creation', async () => {
    const response = await asUser(
      request(buildWardrobeApp()).post('/api/v1/wardrobe'),
    )
      .send({
        name: 'Navy Blazer',
        category: 'outerwear',
        subcategory: 'Blazer',
        colors: ['Navy'],
      })
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('creates and normalizes an owner-scoped item without leaking userId', async () => {
    const response = await createItem(buildWardrobeApp(), {
      name: '  Navy   Blazer  ',
      brand: '  Canali  ',
      colors: ['Navy', 'navy', ' White '],
      materials: [' Wool ', 'wool', 'Cashmere'],
      size: ' 40R ',
      favorite: true,
    });

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      name: 'Navy Blazer',
      brand: 'Canali',
      colors: ['Navy', 'White'],
      materials: ['Wool', 'Cashmere'],
      size: '40R',
      favorite: true,
    });
    expect(response.body.data.userId).toBeUndefined();
  });

  it('rejects client-controlled ownership and unknown fields', async () => {
    const response = await asUser(
      request(buildWardrobeApp()).post('/api/v1/wardrobe'),
      SESSION_A,
      CSRF_A,
    )
      .send({
        name: 'Navy Blazer',
        category: 'outerwear',
        subcategory: 'Blazer',
        colors: ['Navy'],
        userId: USER_B_ID,
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists only the authenticated owner and supports allowlisted filters', async () => {
    const app = buildWardrobeApp();

    await createItem(app, { name: 'Navy Blazer', favorite: true });
    await createItem(app, {
      name: 'White Oxford Shirt',
      category: 'top',
      subcategory: 'Shirt',
      colors: ['White'],
      brand: 'Eton',
    });
    await createItem(
      app,
      {
        name: 'Private Red Jacket',
        category: 'outerwear',
        subcategory: 'Jacket',
        colors: ['Red'],
        favorite: true,
      },
      SESSION_B,
      CSRF_B,
    );

    const filtered = await asUser(
      request(app).get('/api/v1/wardrobe?category=outerwear&favorite=true&search=navy&page=1&pageSize=1'),
    ).expect(200);

    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0].name).toBe('Navy Blazer');
    expect(filtered.body.data.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });
    expect(JSON.stringify(filtered.body)).not.toContain('Private Red Jacket');
  });

  it('rejects unknown wardrobe query parameters', async () => {
    const response = await asUser(
      request(buildWardrobeApp()).get('/api/v1/wardrobe?userId=someone-else'),
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the same 404 for another owner and a missing item', async () => {
    const app = buildWardrobeApp();
    const created = await createItem(app);
    const itemId = created.body.data.id as string;

    const otherOwner = await asUser(
      request(app).get(`/api/v1/wardrobe/${itemId}`),
      SESSION_B,
    ).expect(404);
    const missing = await asUser(
      request(app).get('/api/v1/wardrobe/ffffffffffffffffffffffff'),
    ).expect(404);

    expect(otherOwner.body.error).toEqual(missing.body.error);
    expect(otherOwner.body.error.code).toBe('WARDROBE_ITEM_NOT_FOUND');
  });

  it('edits an item and can intentionally clear nullable product facts', async () => {
    const app = buildWardrobeApp();
    const created = await createItem(app, {
      brand: 'Canali',
      pattern: 'solid',
      size: '40R',
      favorite: false,
    });
    const itemId = created.body.data.id as string;
    const createdUpdatedAt = created.body.data.updatedAt as string;

    const updated = await asUser(
      request(app).patch(`/api/v1/wardrobe/${itemId}`),
      SESSION_A,
      CSRF_A,
    )
      .send({
        name: '  Evening   Blazer ',
        brand: null,
        pattern: null,
        size: null,
        favorite: true,
        colors: ['Midnight', 'midnight'],
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      name: 'Evening Blazer',
      brand: null,
      pattern: null,
      size: null,
      favorite: true,
      colors: ['Midnight'],
    });
    expect(new Date(updated.body.data.updatedAt).getTime())
      .toBeGreaterThan(new Date(createdUpdatedAt).getTime());
  });

  it('requires CSRF for wardrobe edits', async () => {
    const app = buildWardrobeApp();
    const created = await createItem(app);
    const itemId = created.body.data.id as string;

    const response = await asUser(
      request(app).patch(`/api/v1/wardrobe/${itemId}`),
    )
      .send({ favorite: true })
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('rejects empty or ownership-manipulating patches', async () => {
    const app = buildWardrobeApp();
    const created = await createItem(app);
    const itemId = created.body.data.id as string;

    const empty = await asUser(
      request(app).patch(`/api/v1/wardrobe/${itemId}`),
      SESSION_A,
      CSRF_A,
    )
      .send({})
      .expect(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const ownerOverride = await asUser(
      request(app).patch(`/api/v1/wardrobe/${itemId}`),
      SESSION_A,
      CSRF_A,
    )
      .send({ userId: USER_B_ID })
      .expect(400);
    expect(ownerOverride.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not allow another owner to update or delete an item', async () => {
    const app = buildWardrobeApp();
    const created = await createItem(app);
    const itemId = created.body.data.id as string;

    const update = await asUser(
      request(app).patch(`/api/v1/wardrobe/${itemId}`),
      SESSION_B,
      CSRF_B,
    )
      .send({ favorite: true })
      .expect(404);
    expect(update.body.error.code).toBe('WARDROBE_ITEM_NOT_FOUND');

    const deletion = await asUser(
      request(app).delete(`/api/v1/wardrobe/${itemId}`),
      SESSION_B,
      CSRF_B,
    ).expect(404);
    expect(deletion.body.error.code).toBe('WARDROBE_ITEM_NOT_FOUND');

    await asUser(request(app).get(`/api/v1/wardrobe/${itemId}`)).expect(200);
  });

  it('deletes the current owner item and makes it unavailable afterwards', async () => {
    const app = buildWardrobeApp();
    const created = await createItem(app);
    const itemId = created.body.data.id as string;

    const deleted = await asUser(
      request(app).delete(`/api/v1/wardrobe/${itemId}`),
      SESSION_A,
      CSRF_A,
    ).expect(200);
    expect(deleted.body.data).toEqual({ deleted: true });

    await asUser(request(app).get(`/api/v1/wardrobe/${itemId}`)).expect(404);
  });

  it('rejects malformed item identifiers before repository lookup', async () => {
    const response = await asUser(
      request(buildWardrobeApp()).get('/api/v1/wardrobe/not-an-object-id'),
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects untrusted browser origins before wardrobe authentication', async () => {
    const response = await request(buildWardrobeApp())
      .get('/api/v1/wardrobe')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', `wardrope_session=${SESSION_A}`)
      .expect(403);

    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});
