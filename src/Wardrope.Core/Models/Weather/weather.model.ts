export interface WeatherLocationInput {
  latitude: number;
  longitude: number;
}

export interface WeatherResolvedLocationDto {
  name: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
}

export interface WeatherMomentDto {
  at: string;
  temperatureC: number;
  feelsLikeC: number;
  condition: string;
  conditionCode: number;
  isDay: boolean;
  humidityPercent: number;
  cloudPercent: number;
  windKph: number;
  gustKph: number;
  precipitationMm: number;
  chanceOfRainPercent: number | null;
  chanceOfSnowPercent: number | null;
  uvIndex: number;
}

export interface WeatherDayDto {
  date: string;
  minTemperatureC: number;
  maxTemperatureC: number;
  totalPrecipitationMm: number;
  maxWindKph: number;
  chanceOfRainPercent: number;
  chanceOfSnowPercent: number;
}

export interface WeatherContextDto {
  location: WeatherResolvedLocationDto;
  current: WeatherMomentDto;
  today: WeatherDayDto;
  nextHours: WeatherMomentDto[];
  fetchedAt: string;
}

export type WeatherContextResult =
  | { ok: true; context: WeatherContextDto }
  | { ok: false; reason: 'PROVIDER_UNAVAILABLE' };
