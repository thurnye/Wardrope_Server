import type { IHealthRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Health/health.repository.interface';
import type {
  HealthResponseDto,
  ReadinessResponseDto,
} from '../../../Models/Health/health.model';
import type { IHealthService } from '../../ServicesInterface/Health/health.service.interface';

export class HealthService implements IHealthService {
  constructor(private readonly healthRepository: IHealthRepository) {}

  getStatus(): HealthResponseDto {
    return {
      service: 'wardrope-server',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
      database: this.healthRepository.getDatabaseStatus(),
    };
  }

  getReadiness(): ReadinessResponseDto {
    const database = this.healthRepository.getDatabaseStatus();

    return {
      ready: database === 'connected',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
