import { assertRuntimeConfiguration, env } from '../../config/env';
import { HealthService } from '../../Wardrope.Core/services/ServicesImplementation/Health/health.service';
import { MongoDatabaseConnection } from '../../Wardrope.DB/connection/mongo-database.connection';
import { HealthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Health/health.repository';
import { createApiRouter } from '../routes';

export interface ApplicationRuntime {
  apiRouter: ReturnType<typeof createApiRouter>;
  shutdown(): Promise<void>;
}

export async function createApplicationRuntime(): Promise<ApplicationRuntime> {
  assertRuntimeConfiguration();

  let database: MongoDatabaseConnection | null = null;

  if (env.mongoUri) {
    database = new MongoDatabaseConnection(env.mongoUri, env.mongoDbName);
    await database.connect();
  }

  const healthRepository = new HealthRepository(database);
  const healthService = new HealthService(healthRepository);

  return {
    apiRouter: createApiRouter(healthService),
    async shutdown() {
      await database?.disconnect();
    },
  };
}
