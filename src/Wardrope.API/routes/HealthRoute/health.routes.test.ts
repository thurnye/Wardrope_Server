import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HealthService } from '../../../Wardrope.Core/services/ServicesImplementation/Health/health.service';
import type {
  DatabaseHealthStatus,
  IHealthRepository,
} from '../../../Wardrope.DB/repositories/RepositoryInterface/Health/health.repository.interface';
import { createApp } from '../../server/app';
import { createApiRouter } from '..';

function buildTestApp(databaseStatus: DatabaseHealthStatus) {
  const healthRepository: IHealthRepository = {
    getDatabaseStatus: () => databaseStatus,
  };
  const healthService = new HealthService(healthRepository);
  return createApp(createApiRouter(healthService));
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
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['cache-control']).toBe('no-store');
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

  it('does not grant browser CORS access to an unapproved origin', async () => {
    const response = await request(buildTestApp('connected'))
      .get('/api/v1/health')
      .set('Origin', 'https://attacker.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
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
