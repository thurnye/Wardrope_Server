import type {
  WeatherContextResult,
  WeatherLocationInput,
} from '../../../Models/Weather/weather.model';

export interface IWeatherService {
  getContext(location: WeatherLocationInput): Promise<WeatherContextResult>;
}
