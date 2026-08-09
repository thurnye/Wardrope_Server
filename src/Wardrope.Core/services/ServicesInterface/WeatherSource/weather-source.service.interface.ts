import type {
  WeatherContextDto,
  WeatherLocationInput,
} from '../../../Models/Weather/weather.model';

export interface IWeatherSourceService {
  getContext(location: WeatherLocationInput): Promise<WeatherContextDto>;
}
