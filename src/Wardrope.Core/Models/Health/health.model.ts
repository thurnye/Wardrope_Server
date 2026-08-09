import type { DatabaseHealthStatus } from '../../../Wardrope.DB/repositories/RepositoryInterface/Health/health.repository.interface';

export interface HealthResponseDto {
  service: 'wardrope-server';
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  database: DatabaseHealthStatus;
}

export interface ReadinessResponseDto {
  ready: boolean;
  database: DatabaseHealthStatus;
  timestamp: string;
}
