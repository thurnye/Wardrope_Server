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
import type { IWeatherService } from '../../../Wardrope.Core/services/ServicesInterface/Weather/weather.service.interface';
import { createApp } from '../../server/app';
import { createWeatherRoutes } from './weather.routes';

const USER_ID = '64b000000000000000000001';
const SESSION = 'session-a';

function authContext(): AuthenticatedRequestContext {
  return {
    sessionId: 'record-a',
    csrfTokenHash: 'csrf-a',
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
  register: async (_request: RegisterRequestDto) => ({ ok: false, reason: 'EMAIL_UNAVAILABLE' }),
  login: async (_request: LoginRequestDto) => ({ ok: false, reason: 'INVALID_CREDENTIALS' }),
  getSession: async (): Promise<SessionStatusDto> => ({ authenticated: false }),
  authenticate: async (sessionToken) => sessionToken === SESSION ? authContext() : null,
  verifyCsrf: () => false,
  logout: async () => undefined,
};

const context = {
  location: { name: 'Toronto', region: 'Ontario', country: 'Canada', timezone: 'America/Toronto' },
  current: {
    at: '2026-08-09T15:00:00.000Z',
    temperatureC: 25,
    feelsLikeC: 27,
    condition: 'Partly cloudy',
    conditionCode: 1003,
    isDay: true,
    humidityPercent: 60,
    cloudPercent: 45,
    windKph: 12,
    gustKph: 18,
    precipitationMm: 0,
    chanceOfRainPercent: null,
    chanceOfSnowPercent: null,
    uvIndex: 5,
  },
  today: {
    date: '2026-08-09',
    minTemperatureC: 18,
    maxTemperatureC: 27,
    totalPrecipitationMm: 0.4,
    maxWindKph: 22,
    chanceOfRainPercent: 20,
    chanceOfSnowPercent: 0,
  },
  nextHours: [],
  fetchedAt: '2026-08-09T15:00:00.000Z',
};

function buildApp(weatherService: IWeatherService) {
  const api = Router();
  api.use('/weather', createWeatherRoutes(weatherService, authService));
  return createApp(api);
}

function asUser(req: request.Test) {
  return req
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', `wardrope_session=${SESSION}`);
}

describe('Weather context API', () => {
  it('requires authentication', async () => {
    const service: IWeatherService = { getContext: vi.fn() };
    await request(buildApp(service))
      .get('/api/v1/weather/context?latitude=43.65&longitude=-79.38')
      .set('Origin', 'http://localhost:5173')
      .expect(401);
  });

  it('strictly validates coordinates and rejects extra query fields', async () => {
    const service: IWeatherService = { getContext: vi.fn() };
    const app = buildApp(service);

    await asUser(request(app).get('/api/v1/weather/context?latitude=91&longitude=-79.38')).expect(400);
    await asUser(request(app).get('/api/v1/weather/context?latitude=43.65&longitude=-79.38&userId=other')).expect(400);
    expect(service.getContext).not.toHaveBeenCalled();
  });

  it('returns normalized weather context without coordinates or provider secrets', async () => {
    const service: IWeatherService = {
      getContext: vi.fn().mockResolvedValue({ ok: true, context }),
    };
    const response = await asUser(
      request(buildApp(service)).get('/api/v1/weather/context?latitude=43.653226&longitude=-79.3831843'),
    ).expect(200);

    expect(service.getContext).toHaveBeenCalledWith({
      latitude: 43.653226,
      longitude: -79.3831843,
    });
    expect(response.body.data.location.name).toBe('Toronto');
    expect(response.body.data.current.feelsLikeC).toBe(27);
    expect(JSON.stringify(response.body.data)).not.toMatch(/latitude|longitude|api.?key/i);
  });

  it('sanitizes provider outages as a temporary service failure', async () => {
    const service: IWeatherService = {
      getContext: vi.fn().mockResolvedValue({ ok: false, reason: 'PROVIDER_UNAVAILABLE' }),
    };
    const response = await asUser(
      request(buildApp(service)).get('/api/v1/weather/context?latitude=43.65&longitude=-79.38'),
    ).expect(503);

    expect(response.body.error.code).toBe('WEATHER_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('WeatherAPI');
  });

  it('rejects untrusted browser origins before provider work', async () => {
    const service: IWeatherService = { getContext: vi.fn() };
    await request(buildApp(service))
      .get('/api/v1/weather/context?latitude=43.65&longitude=-79.38')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', `wardrope_session=${SESSION}`)
      .expect(403);
    expect(service.getContext).not.toHaveBeenCalled();
  });
});
