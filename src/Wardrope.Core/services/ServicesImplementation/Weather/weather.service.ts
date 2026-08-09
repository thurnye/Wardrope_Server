import type {
  WeatherContextResult,
  WeatherLocationInput,
} from '../../../Models/Weather/weather.model';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IWeatherSourceService } from '../../ServicesInterface/WeatherSource/weather-source.service.interface';
import type { IWeatherService } from '../../ServicesInterface/Weather/weather.service.interface';

function reduceCoordinatePrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

export class WeatherService implements IWeatherService {
  constructor(
    private readonly weatherSource: IWeatherSourceService,
    private readonly logger: IApplicationLogger,
  ) {}

  async getContext(location: WeatherLocationInput): Promise<WeatherContextResult> {
    const approximateLocation: WeatherLocationInput = {
      latitude: reduceCoordinatePrecision(location.latitude),
      longitude: reduceCoordinatePrecision(location.longitude),
    };

    try {
      return {
        ok: true,
        context: await this.weatherSource.getContext(approximateLocation),
      };
    } catch {
      this.logger.error('weather_context_provider_failed');
      return { ok: false, reason: 'PROVIDER_UNAVAILABLE' };
    }
  }
}
