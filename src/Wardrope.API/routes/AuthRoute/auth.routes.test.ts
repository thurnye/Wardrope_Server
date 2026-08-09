import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../../Wardrope.Core/services/ServicesImplementation/Auth/auth.service';
import type { IPasswordHasher } from '../../../Wardrope.Core/services/ServicesInterface/Security/password-hasher.service.interface';
import type { IHealthService } from '../../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type {
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthSessionInput,
  CreateAuthUserInput,
  IAuthRepository,
} from '../../../Wardrope.DB/repositories/RepositoryInterface/Auth/auth.repository.interface';
import { SecurityTokenService } from '../../../Wardrope.Infra/services/Security/security-token.service';
import { createApp } from '../../server/app';
import { createApiRouter } from '..';

class FakeAuthRepository implements IAuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, AuthSessionRecord>();
  private userSequence = 0;
  private sessionSequence = 0;

  async findUserByNormalizedEmail(emailNormalized: string) {
    return [...this.users.values()].find((user) => user.emailNormalized === emailNormalized) ?? null;
  }

  async findUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async createUser(input: CreateAuthUserInput) {
    if (await this.findUserByNormalizedEmail(input.emailNormalized)) {
      return null;
    }

    const now = new Date();
    const user: AuthUserRecord = {
      id: `user-${++this.userSequence}`,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async createSession(input: CreateAuthSessionInput) {
    const session: AuthSessionRecord = {
      id: `session-${++this.sessionSequence}`,
      ...input,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string) {
    return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash) ?? null;
  }

  async rotateCsrfToken(sessionId: string, csrfTokenHash: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.csrfTokenHash = csrfTokenHash;
    return true;
  }

  async deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  async ensureIndexes() {
    return undefined;
  }
}

const passwordHasher: IPasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  verify: async (password, encodedHash) => Boolean(encodedHash && encodedHash === `hashed:${password}`),
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

function buildAuthApp() {
  const authRepository = new FakeAuthRepository();
  const authService = new AuthService(
    authRepository,
    passwordHasher,
    new SecurityTokenService(),
    60 * 60 * 1_000,
  );

  return createApp(createApiRouter(healthService, authService));
}

function asHeaderList(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

const validAccount = {
  email: 'daniel@example.com',
  password: 'a-secure-passphrase-2026',
  displayName: 'Daniel',
};

describe('Wardrope authentication API', () => {
  it('registers a valid account without returning password material', async () => {
    const response = await request(buildAuthApp())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(validAccount)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(validAccount.email);
    expect(response.body.data.user.displayName).toBe(validAccount.displayName);
    expect(JSON.stringify(response.body)).not.toMatch(/password|hashed:/i);
  });

  it('validates registration input before touching the account service', async () => {
    const response = await request(buildAuthApp())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'not-an-email',
        password: 'short',
        displayName: '',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' }),
        expect.objectContaining({ field: 'displayName' }),
      ]),
    );
  });

  it('uses a generic duplicate-account response', async () => {
    const app = buildAuthApp();

    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(validAccount)
      .expect(201);

    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({ ...validAccount, email: 'DANIEL@example.com' })
      .expect(409);

    expect(duplicate.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
    expect(duplicate.body.error.message).not.toMatch(/already exists|registered|email exists/i);
  });

  it('rejects auth browser requests from an untrusted origin', async () => {
    const response = await request(buildAuthApp())
      .post('/api/v1/auth/register')
      .set('Origin', 'https://attacker.example')
      .send(validAccount)
      .expect(403);

    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('returns the same login failure for missing users and wrong passwords', async () => {
    const app = buildAuthApp();

    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(validAccount)
      .expect(201);

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: validAccount.email, password: 'wrong-password' })
      .expect(401);

    const missingUser = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'missing@example.com', password: 'wrong-password' })
      .expect(401);

    expect(wrongPassword.body.error).toEqual(missingUser.body.error);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('creates a secure session, keeps CSRF stable across bootstrap, and invalidates it on logout', async () => {
    const app = buildAuthApp();
    const agent = request.agent(app);

    await agent
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(validAccount)
      .expect(201);

    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: validAccount.email, password: validAccount.password })
      .expect(200);

    const cookies = asHeaderList(login.headers['set-cookie']);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith('wardrope_session=')) ?? '';
    const csrfCookie = cookies.find((cookie) => cookie.startsWith('wardrope_csrf=')) ?? '';
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(csrfCookie).toContain('SameSite=Lax');
    expect(csrfCookie).not.toContain('HttpOnly');
    expect(JSON.stringify(login.body)).not.toMatch(/sessionToken|tokenHash|passwordHash/i);
    expect(login.body.data.csrfToken).toBeTruthy();

    const bootstrap = await agent
      .get('/api/v1/auth/session')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(bootstrap.body.data.authenticated).toBe(true);
    expect(bootstrap.body.data.user.email).toBe(validAccount.email);
    expect(bootstrap.body.data.csrfToken).toBe(login.body.data.csrfToken);

    const wrongCsrf = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', 'not-the-csrf-token')
      .expect(403);
    expect(wrongCsrf.body.error.code).toBe('CSRF_VALIDATION_FAILED');

    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
      .expect(200);
    expect(logout.body.data.loggedOut).toBe(true);
    const clearedCookies = asHeaderList(logout.headers['set-cookie']);
    expect(clearedCookies.some((cookie) => /wardrope_session=;/.test(cookie))).toBe(true);
    expect(clearedCookies.some((cookie) => /wardrope_csrf=;/.test(cookie))).toBe(true);

    const afterLogout = await agent
      .get('/api/v1/auth/session')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(afterLogout.body.data).toEqual({ authenticated: false });
  });

  it('requires CSRF for authenticated logout', async () => {
    const app = buildAuthApp();
    const agent = request.agent(app);

    await agent
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(validAccount)
      .expect(201);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: validAccount.email, password: validAccount.password })
      .expect(200);

    const response = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('blocks session bootstrap from an untrusted browser origin', async () => {
    const response = await request(buildAuthApp())
      .get('/api/v1/auth/session')
      .set('Origin', 'https://attacker.example')
      .expect(403);

    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('clears invalid auth cookies during session bootstrap', async () => {
    const response = await request(buildAuthApp())
      .get('/api/v1/auth/session')
      .set('Cookie', 'wardrope_session=invalid-token; wardrope_csrf=invalid-csrf')
      .expect(200);

    expect(response.body.data).toEqual({ authenticated: false });
    const clearedCookies = asHeaderList(response.headers['set-cookie']);
    expect(clearedCookies.some((cookie) => /wardrope_session=;/.test(cookie))).toBe(true);
    expect(clearedCookies.some((cookie) => /wardrope_csrf=;/.test(cookie))).toBe(true);
  });
});
