import { describe, expect, it, vi } from 'vitest';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IWeatherSourceService } from '../../ServicesInterface/WeatherSource/weather-source.service.interface';
import { WeatherService } from './weather.service';

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

function harness() {
  const weatherSource: IWeatherSourceService = {
    getContext: vi.fn().mockResolvedValue(context),
  };
  const logger: IApplicationLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return { weatherSource, logger, service: new WeatherService(weatherSource, logger) };
}

describe('WeatherService', () => {
  it('reduces precise coordinates before provider access', async () => {
    const h = harness();
    const result = await h.service.getContext({ latitude: 43.653226, longitude: -79.3831843 });

    expect(result).toEqual({ ok: true, context });
    expect(h.weatherSource.getContext).toHaveBeenCalledWith({
      latitude: 43.65,
      longitude: -79.38,
    });
  });

  it('sanitizes provider failures without logging location data', async () => {
    const h = harness();
    vi.mocked(h.weatherSource.getContext).mockRejectedValueOnce(new Error('provider secret failure'));

    await expect(h.service.getContext({ latitude: 43.65, longitude: -79.38 })).resolves.toEqual({
      ok: false,
      reason: 'PROVIDER_UNAVAILABLE',
    });
    expect(h.logger.error).toHaveBeenCalledWith('weather_context_provider_failed');
  });
});
