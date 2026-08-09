import { z } from 'zod';
import type {
  WeatherContextDto,
  WeatherLocationInput,
  WeatherMomentDto,
} from '../../../Wardrope.Core/Models/Weather/weather.model';
import type { IWeatherSourceService } from '../../../Wardrope.Core/services/ServicesInterface/WeatherSource/weather-source.service.interface';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1/';

const conditionSchema = z.object({
  text: z.string().max(120),
  code: z.number().int(),
}).passthrough();

const hourSchema = z.object({
  time_epoch: z.number().int(),
  temp_c: z.number(),
  feelslike_c: z.number(),
  condition: conditionSchema,
  is_day: z.number().int(),
  humidity: z.number(),
  cloud: z.number(),
  wind_kph: z.number(),
  gust_kph: z.number(),
  precip_mm: z.number(),
  chance_of_rain: z.number(),
  chance_of_snow: z.number(),
  uv: z.number(),
}).passthrough();

const daySchema = z.object({
  maxtemp_c: z.number(),
  mintemp_c: z.number(),
  totalprecip_mm: z.number(),
  maxwind_kph: z.number(),
  daily_chance_of_rain: z.number(),
  daily_chance_of_snow: z.number(),
}).passthrough();

const forecastDaySchema = z.object({
  date: z.string(),
  day: daySchema,
  hour: z.array(hourSchema),
}).passthrough();

const responseSchema = z.object({
  location: z.object({
    name: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    tz_id: z.string().optional(),
  }).passthrough(),
  current: z.object({
    last_updated_epoch: z.number().int(),
    temp_c: z.number(),
    feelslike_c: z.number(),
    condition: conditionSchema,
    is_day: z.number().int(),
    humidity: z.number(),
    cloud: z.number(),
    wind_kph: z.number(),
    gust_kph: z.number(),
    precip_mm: z.number(),
    uv: z.number(),
  }).passthrough(),
  forecast: z.object({
    forecastday: z.array(forecastDaySchema).min(1),
  }).passthrough(),
}).passthrough();

function safeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function momentFromHour(hour: z.infer<typeof hourSchema>): WeatherMomentDto {
  return {
    at: new Date(hour.time_epoch * 1_000).toISOString(),
    temperatureC: hour.temp_c,
    feelsLikeC: hour.feelslike_c,
    condition: hour.condition.text.trim().slice(0, 120),
    conditionCode: hour.condition.code,
    isDay: hour.is_day === 1,
    humidityPercent: hour.humidity,
    cloudPercent: hour.cloud,
    windKph: hour.wind_kph,
    gustKph: hour.gust_kph,
    precipitationMm: hour.precip_mm,
    chanceOfRainPercent: hour.chance_of_rain,
    chanceOfSnowPercent: hour.chance_of_snow,
    uvIndex: hour.uv,
  };
}

export class WeatherApiComWeatherSourceService implements IWeatherSourceService {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error('Weather API key is required.');
  }

  async getContext(location: WeatherLocationInput): Promise<WeatherContextDto> {
    const url = new URL('forecast.json', WEATHER_API_BASE_URL);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('q', `${location.latitude},${location.longitude}`);
    url.searchParams.set('days', '2');
    url.searchParams.set('aqi', 'no');
    url.searchParams.set('alerts', 'no');

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error('Weather provider request failed.');
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('Weather provider returned an unexpected content type.');
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error('Weather provider response exceeded the allowed size.');
    }

    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('Weather provider response exceeded the allowed size.');
    }

    const parsed = responseSchema.parse(JSON.parse(text) as unknown);
    const today = parsed.forecast.forecastday[0];
    if (!today) throw new Error('Weather provider response did not include today.');

    const allHours = parsed.forecast.forecastday.flatMap((forecastDay) => forecastDay.hour);
    const currentEpoch = parsed.current.last_updated_epoch;
    const nextHours = allHours
      .filter((hour) => hour.time_epoch >= currentEpoch)
      .slice(0, 24)
      .map(momentFromHour);

    return {
      location: {
        name: safeOptionalText(parsed.location.name),
        region: safeOptionalText(parsed.location.region),
        country: safeOptionalText(parsed.location.country),
        timezone: safeOptionalText(parsed.location.tz_id),
      },
      current: {
        at: new Date(parsed.current.last_updated_epoch * 1_000).toISOString(),
        temperatureC: parsed.current.temp_c,
        feelsLikeC: parsed.current.feelslike_c,
        condition: parsed.current.condition.text.trim().slice(0, 120),
        conditionCode: parsed.current.condition.code,
        isDay: parsed.current.is_day === 1,
        humidityPercent: parsed.current.humidity,
        cloudPercent: parsed.current.cloud,
        windKph: parsed.current.wind_kph,
        gustKph: parsed.current.gust_kph,
        precipitationMm: parsed.current.precip_mm,
        chanceOfRainPercent: null,
        chanceOfSnowPercent: null,
        uvIndex: parsed.current.uv,
      },
      today: {
        date: today.date,
        minTemperatureC: today.day.mintemp_c,
        maxTemperatureC: today.day.maxtemp_c,
        totalPrecipitationMm: today.day.totalprecip_mm,
        maxWindKph: today.day.maxwind_kph,
        chanceOfRainPercent: today.day.daily_chance_of_rain,
        chanceOfSnowPercent: today.day.daily_chance_of_snow,
      },
      nextHours,
      fetchedAt: new Date().toISOString(),
    };
  }
}
