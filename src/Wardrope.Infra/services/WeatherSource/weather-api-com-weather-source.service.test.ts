import { describe, expect, it, vi } from 'vitest';
import { WeatherApiComWeatherSourceService } from './weather-api-com-weather-source.service';

const providerPayload = {
  location: {
    name: 'Toronto',
    region: 'Ontario',
    country: 'Canada',
    lat: 43.65,
    lon: -79.38,
    tz_id: 'America/Toronto',
  },
  current: {
    last_updated_epoch: 1786287600,
    temp_c: 25,
    feelslike_c: 27,
    is_day: 1,
    condition: { text: 'Partly cloudy', icon: '//example', code: 1003 },
    wind_kph: 12,
    gust_kph: 18,
    precip_mm: 0,
    humidity: 60,
    cloud: 45,
    uv: 5,
  },
  forecast: {
    forecastday: [
      {
        date: '2026-08-09',
        day: {
          maxtemp_c: 27,
          mintemp_c: 18,
          totalprecip_mm: 0.4,
          maxwind_kph: 22,
          daily_chance_of_rain: 20,
          daily_chance_of_snow: 0,
        },
        hour: [
          {
            time_epoch: 1786287600,
            temp_c: 25,
            feelslike_c: 27,
            condition: { text: 'Partly cloudy', code: 1003 },
            is_day: 1,
            humidity: 60,
            cloud: 45,
            wind_kph: 12,
            gust_kph: 18,
            precip_mm: 0,
            chance_of_rain: 10,
            chance_of_snow: 0,
            uv: 5,
          },
        ],
      },
      {
        date: '2026-08-10',
        day: {
          maxtemp_c: 26,
          mintemp_c: 17,
          totalprecip_mm: 2,
          maxwind_kph: 25,
          daily_chance_of_rain: 50,
          daily_chance_of_snow: 0,
        },
        hour: [],
      },
    ],
  },
};

function response(body = providerPayload) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('WeatherApiComWeatherSourceService', () => {
  it('calls the fixed HTTPS provider endpoint and maps only normalized weather context', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response());
    const service = new WeatherApiComWeatherSourceService('server-secret-key', fetchFn as typeof fetch);

    const result = await service.getContext({ latitude: 43.65, longitude: -79.38 });

    const requested = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(requested.origin).toBe('https://api.weatherapi.com');
    expect(requested.pathname).toBe('/v1/forecast.json');
    expect(requested.searchParams.get('q')).toBe('43.65,-79.38');
    expect(requested.searchParams.get('days')).toBe('2');
    expect(requested.searchParams.get('key')).toBe('server-secret-key');
    expect(result.location).toEqual({
      name: 'Toronto',
      region: 'Ontario',
      country: 'Canada',
      timezone: 'America/Toronto',
    });
    expect(result).not.toHaveProperty('latitude');
    expect(result).not.toHaveProperty('longitude');
    expect(JSON.stringify(result)).not.toContain('server-secret-key');
    expect(result.nextHours).toHaveLength(1);
    expect(result.nextHours[0]).toMatchObject({
      chanceOfRainPercent: 10,
      temperatureC: 25,
      condition: 'Partly cloudy',
    });
  });

  it('rejects non-JSON or malformed provider responses', async () => {
    const wrongType = vi.fn().mockResolvedValue(new Response('<html />', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));
    await expect(new WeatherApiComWeatherSourceService('key', wrongType as typeof fetch)
      .getContext({ latitude: 43.65, longitude: -79.38 }))
      .rejects.toThrow(/content type/i);

    const malformed = vi.fn().mockResolvedValue(response({ unexpected: true } as never));
    await expect(new WeatherApiComWeatherSourceService('key', malformed as typeof fetch)
      .getContext({ latitude: 43.65, longitude: -79.38 }))
      .rejects.toThrow();
  });

  it('does not follow provider redirects', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response());
    const service = new WeatherApiComWeatherSourceService('key', fetchFn as typeof fetch);
    await service.getContext({ latitude: 43.65, longitude: -79.38 });
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
  });
});
