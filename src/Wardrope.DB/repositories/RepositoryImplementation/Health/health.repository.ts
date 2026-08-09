import type { MongoDatabaseConnection } from '@/Wardrope.DB/connection/mongo-database.connection';
import type {
  DatabaseHealthStatus,
  IHealthRepository,
} from '@/Wardrope.DB/repositories/RepositoryInterface/Health/health.repository.interface';

export class HealthRepository implements IHealthRepository {
  constructor(private readonly database: MongoDatabaseConnection | null) {}

  getDatabaseStatus(): DatabaseHealthStatus {
    return this.database?.isConnected() ? 'connected' : 'disconnected';
  }
}
