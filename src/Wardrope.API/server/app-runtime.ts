import { assertRuntimeConfiguration, env } from '../../config/env';
import { AuthService } from '../../Wardrope.Core/services/ServicesImplementation/Auth/auth.service';
import { HealthService } from '../../Wardrope.Core/services/ServicesImplementation/Health/health.service';
import { WardrobeService } from '../../Wardrope.Core/services/ServicesImplementation/Wardrobe/wardrobe.service';
import { MongoDatabaseConnection } from '../../Wardrope.DB/connection/mongo-database.connection';
import { AuthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Auth/auth.repository';
import { HealthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Health/health.repository';
import { WardrobeRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Wardrobe/wardrobe.repository';
import { ScryptPasswordHasher } from '../../Wardrope.Infra/services/Security/scrypt-password-hasher.service';
import { SecurityTokenService } from '../../Wardrope.Infra/services/Security/security-token.service';
import { createApiRouter } from '../routes';

export interface ApplicationRuntime {
  apiRouter: ReturnType<typeof createApiRouter>;
  shutdown(): Promise<void>;
}

export async function createApplicationRuntime(): Promise<ApplicationRuntime> {
  assertRuntimeConfiguration();

  if (!env.mongoUri) {
    throw new Error('MongoDB configuration is required to create the application runtime.');
  }

  const database = new MongoDatabaseConnection(env.mongoUri, env.mongoDbName);
  await database.connect();

  const healthRepository = new HealthRepository(database);
  const authRepository = new AuthRepository(database);
  const wardrobeRepository = new WardrobeRepository(database);
  await Promise.all([
    authRepository.ensureIndexes(),
    wardrobeRepository.ensureIndexes(),
  ]);

  const passwordHasher = new ScryptPasswordHasher();
  const tokenService = new SecurityTokenService();
  const healthService = new HealthService(healthRepository);
  const authService = new AuthService(
    authRepository,
    passwordHasher,
    tokenService,
    env.authSessionTtlMs,
  );
  const wardrobeService = new WardrobeService(wardrobeRepository);

  return {
    apiRouter: createApiRouter(healthService, authService, wardrobeService),
    async shutdown() {
      await database.disconnect();
    },
  };
}
