import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import { HealthService } from '../../../Wardrope.Core/services/ServicesImplementation/Health/health.service';
import type {
  DatabaseHealthStatus,
  IHealthRepository,
} from '../../../Wardrope.DB/repositories/RepositoryInterface/Health/health.repository.interface';
import { noopWardrobeService } from '../../../test/noop-services';
import { createApp } from '../../server/app';
import { createApiRouter } from '..';

const noopAuthService: IAuthService = {
  register: async () => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' }),
  login: async () => ({ ok: false, reason: 'INVALID_CREDENTIALS' }),
  getSession: async () => ({ authenticated: false }),
  authenticate: async () => null,
  verifyCsrf: () => false,
  logout: async () => undefined,
};

function buildTestApp(databaseStatus: DatabaseHealthStatus) {
  const healthRepository: IHealthRepository = {
    getDatabaseStatus: () => databaseStatus,
  };
  const healthService = new HealthService(healthRepository);
  return createApp(createApiRouter(healthService, noopAuthService, noopWardrobeService));
}

describe('Wardrope health API', () => {
  it('returns liveness with request metadata and security headers', async () => {
    const response = await request(buildTestApp('disconnected'))
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('wardrope-server');
    expect(response.body.data.database).toBe('disconnected');
    expect(response.body.meta.requestId).toBeTruthy();
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('preserves only safe client request IDs', async () => {
    const accepted = await request(buildTestApp('connected'))
      .get('/api/v1/health')
      .set('X-Request-Id', 'wardrope.test-123')
      .expect(200);

    expect(accepted.headers['x-request-id']).toBe('wardrope.test-123');

    const rejected = await request(buildTestApp('connected'))
      .get('/api/v1/health')
      .set('X-Request-Id', 'unsafe request id')
      .expect(200);

    expect(rejected.headers['x-request-id']).not.toBe('unsafe request id');
    expect(rejected.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('returns 503 when dependencies are not ready', async () => {
    const response = await request(buildTestApp('disconnected'))
      .get('/api/v1/health/readiness')
      .expect(503);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SERVICE_NOT_READY');
    expect(response.body.data.ready).toBe(false);
    expect(response.body.data.database).toBe('disconnected');
  });

  it('returns 200 readiness when MongoDB is reported connected', async () => {
    const response = await request(buildTestApp('connected'))
      .get('/api/v1/health/readiness')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.ready).toBe(true);
    expect(response.body.data.database).toBe('connected');
  });

  it('rejects browser API access from an unapproved origin', async () => {
    const response = await request(buildTestApp('connected'))
      .get('/api/v1/health')
      .set('Origin', 'https://attacker.example')
      .expect(403);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects oversized JSON before it reaches a route', async () => {
    const response = await request(buildTestApp('connected'))
      .post('/api/v1/does-not-exist')
      .set('Content-Type', 'application/json')
      .send({ payload: 'x'.repeat(1_100_000) })
      .expect(413);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.error.message).toBe('The request payload is too large.');
    expect(JSON.stringify(response.body)).not.toMatch(/stack|payload:|x{50}/i);
  });

  it('returns a sanitized 404 response for unknown endpoints', async () => {
    const response = await request(buildTestApp('connected'))
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.meta.requestId).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
  });
});
