import type {
  HealthResponseDto,
  ReadinessResponseDto,
} from '../../../Models/Health/health.model';

export interface IHealthService {
  getStatus(): HealthResponseDto;
  getReadiness(): ReadinessResponseDto;
}
