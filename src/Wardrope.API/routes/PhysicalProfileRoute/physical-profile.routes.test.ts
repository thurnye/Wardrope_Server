import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type {
  AuthenticatedRequestContext,
  LoginRequestDto,
  RegisterRequestDto,
  SessionStatusDto,
} from '../../../Wardrope.Core/Models/Auth/auth.model';
import type { ReplacePhysicalProfileDto } from '../../../Wardrope.Core/Models/PhysicalProfile/physical-profile.model';
import { PhysicalProfileService } from '../../../Wardrope.Core/services/ServicesImplementation/PhysicalProfile/physical-profile.service';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type {
  IPhysicalProfileRepository,
  PhysicalProfileRecord,
  ReplacePhysicalProfileRecord,
} from '../../../Wardrope.DB/repositories/RepositoryInterface/PhysicalProfile/physical-profile.repository.interface';
import { createApp } from '../../server/app';
import { createPhysicalProfileRoutes } from './physical-profile.routes';

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

class FakePhysicalProfileRepository implements IPhysicalProfileRepository {
  private readonly records = new Map<string, PhysicalProfileRecord>();

  async findByUserId(userId: string): Promise<PhysicalProfileRecord | null> {
    return this.records.get(userId) ?? null;
  }

  async replace(
    userId: string,
    input: ReplacePhysicalProfileRecord,
  ): Promise<PhysicalProfileRecord> {
    const previous = this.records.get(userId);
    const now = new Date((previous?.updatedAt.getTime() ?? Date.now()) + 1_000);
    const record: PhysicalProfileRecord = {
      userId,
      ...input,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(userId, record);
    return record;
  }

  async delete(userId: string): Promise<boolean> {
    return this.records.delete(userId);
  }

  async ensureIndexes(): Promise<void> {
    return undefined;
  }
}

function buildApp() {
  const repository = new FakePhysicalProfileRepository();
  const service = new PhysicalProfileService(repository);
  const api = Router();
  api.use('/physical-profile', createPhysicalProfileRoutes(service, authService));
  return createApp(api);
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
  if (csrfToken) req.set('X-CSRF-Token', csrfToken);
  return req;
}

async function replaceProfile(
  app: ReturnType<typeof buildApp>,
  input: ReplacePhysicalProfileDto,
  sessionToken = SESSION_A,
  csrfToken = CSRF_A,
) {
  return asUser(
    request(app).put('/api/v1/physical-profile'),
    sessionToken,
    csrfToken,
  ).send(input);
}

describe('Wardrope physical profile API', () => {
  it('requires authentication and returns null before a profile exists', async () => {
    const app = buildApp();

    const unauthorized = await request(app)
      .get('/api/v1/physical-profile')
      .set('Origin', 'http://localhost:5173')
      .expect(401);
    expect(unauthorized.body.error.code).toBe('AUTHENTICATION_REQUIRED');

    const empty = await asUser(request(app).get('/api/v1/physical-profile')).expect(200);
    expect(empty.body.data).toBeNull();
  });

  it('requires CSRF for profile replacement and reset', async () => {
    const app = buildApp();

    const replace = await asUser(request(app).put('/api/v1/physical-profile'))
      .send({ heightCm: 180 })
      .expect(403);
    expect(replace.body.error.code).toBe('CSRF_VALIDATION_FAILED');

    const reset = await asUser(request(app).delete('/api/v1/physical-profile')).expect(403);
    expect(reset.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('rejects client ownership fields, unknown data, and empty profile writes', async () => {
    const app = buildApp();

    const ownerOverride = await replaceProfile(app, {
      heightCm: 180,
      ...({ userId: USER_B_ID } as unknown as ReplacePhysicalProfileDto),
    }).expect(400);
    expect(ownerOverride.body.error.code).toBe('VALIDATION_ERROR');

    const unknownField = await asUser(
      request(app).put('/api/v1/physical-profile'),
      SESSION_A,
      CSRF_A,
    )
      .send({ heightCm: 180, medicalCondition: 'private' })
      .expect(400);
    expect(unknownField.body.error.code).toBe('VALIDATION_ERROR');

    const empty = await replaceProfile(app, {}).expect(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
    expect(empty.body.data.fields[0].message).toMatch(/use DELETE to reset/i);
  });

  it('validates bounded measurements and paired shoe sizing', async () => {
    const app = buildApp();

    const badHeight = await replaceProfile(app, { heightCm: 500 }).expect(400);
    expect(badHeight.body.error.code).toBe('VALIDATION_ERROR');

    const missingSystem = await replaceProfile(app, { shoeSize: '10.5' }).expect(400);
    expect(missingSystem.body.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'shoeSizeSystem' }),
      ]),
    );
  });

  it('creates a private profile, normalizes sizes, and never exposes owner identifiers', async () => {
    const app = buildApp();
    const response = await replaceProfile(app, {
      heightCm: 182.5,
      chestCm: 104,
      waistCm: 86,
      bodyShape: 'rectangle',
      skinTone: 'deep',
      fitPreference: 'relaxed',
      usualTopSize: '  Large   Tall ',
      shoeSize: ' 10.5 ',
      shoeSizeSystem: 'US_MENS',
    }).expect(200);

    expect(response.body.data).toMatchObject({
      heightCm: 182.5,
      chestCm: 104,
      waistCm: 86,
      bodyShape: 'rectangle',
      skinTone: 'deep',
      fitPreference: 'relaxed',
      usualTopSize: 'Large Tall',
      shoeSize: '10.5',
      shoeSizeSystem: 'US_MENS',
    });
    expect(response.body.data.userId).toBeUndefined();
    expect(response.body.data.id).toBeUndefined();
  });

  it('uses PUT as a full replacement so stale profile facts are intentionally cleared', async () => {
    const app = buildApp();
    await replaceProfile(app, {
      heightCm: 182,
      chestCm: 104,
      waistCm: 86,
      bodyShape: 'rectangle',
      usualTopSize: 'L',
    }).expect(200);

    const replaced = await replaceProfile(app, { heightCm: 183 }).expect(200);
    expect(replaced.body.data).toMatchObject({
      heightCm: 183,
      chestCm: null,
      waistCm: null,
      bodyShape: null,
      usualTopSize: null,
      shoeSize: null,
      shoeSizeSystem: null,
    });
  });

  it('keeps profiles isolated by authenticated account', async () => {
    const app = buildApp();
    await replaceProfile(app, { heightCm: 180 }, SESSION_A, CSRF_A).expect(200);
    await replaceProfile(app, { heightCm: 165 }, SESSION_B, CSRF_B).expect(200);

    const userA = await asUser(request(app).get('/api/v1/physical-profile'), SESSION_A).expect(200);
    const userB = await asUser(request(app).get('/api/v1/physical-profile'), SESSION_B).expect(200);

    expect(userA.body.data.heightCm).toBe(180);
    expect(userB.body.data.heightCm).toBe(165);
  });

  it('resets idempotently and returns null afterwards', async () => {
    const app = buildApp();
    await replaceProfile(app, { fitPreference: 'regular' }).expect(200);

    const firstReset = await asUser(
      request(app).delete('/api/v1/physical-profile'),
      SESSION_A,
      CSRF_A,
    ).expect(200);
    expect(firstReset.body.data).toEqual({ reset: true });

    await asUser(
      request(app).delete('/api/v1/physical-profile'),
      SESSION_A,
      CSRF_A,
    ).expect(200);

    const empty = await asUser(request(app).get('/api/v1/physical-profile')).expect(200);
    expect(empty.body.data).toBeNull();
  });

  it('rejects untrusted browser origins before profile authentication', async () => {
    const response = await request(buildApp())
      .get('/api/v1/physical-profile')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', `wardrope_session=${SESSION_A}`)
      .expect(403);

    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});
