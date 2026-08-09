import { assertRuntimeConfiguration, env } from '../../config/env';
import { getImageStorageConfig } from '../../config/image-storage.env';
import { AuthService } from '../../Wardrope.Core/services/ServicesImplementation/Auth/auth.service';
import { HealthService } from '../../Wardrope.Core/services/ServicesImplementation/Health/health.service';
import { PhysicalProfileService } from '../../Wardrope.Core/services/ServicesImplementation/PhysicalProfile/physical-profile.service';
import { WardrobeService } from '../../Wardrope.Core/services/ServicesImplementation/Wardrobe/wardrobe.service';
import { WardrobeImageService } from '../../Wardrope.Core/services/ServicesImplementation/WardrobeImage/wardrobe-image.service';
import { MongoDatabaseConnection } from '../../Wardrope.DB/connection/mongo-database.connection';
import { AuthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Auth/auth.repository';
import { HealthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Health/health.repository';
import { PhysicalProfileRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/PhysicalProfile/physical-profile.repository';
import { WardrobeRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Wardrobe/wardrobe.repository';
import { SharpImageProcessingService } from '../../Wardrope.Infra/services/ImageProcessing/sharp-image-processing.service';
import { ConsoleApplicationLogger } from '../../Wardrope.Infra/services/Logging/console-application-logger.service';
import { ScryptPasswordHasher } from '../../Wardrope.Infra/services/Security/scrypt-password-hasher.service';
import { SecurityTokenService } from '../../Wardrope.Infra/services/Security/security-token.service';
import { S3FileStorageService } from '../../Wardrope.Infra/services/Storage/s3-file-storage.service';
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

  const imageStorage = getImageStorageConfig();
  const database = new MongoDatabaseConnection(env.mongoUri, env.mongoDbName);
  await database.connect();

  const healthRepository = new HealthRepository(database);
  const authRepository = new AuthRepository(database);
  const wardrobeRepository = new WardrobeRepository(database);
  const physicalProfileRepository = new PhysicalProfileRepository(database);
  await Promise.all([
    authRepository.ensureIndexes(),
    wardrobeRepository.ensureIndexes(),
    physicalProfileRepository.ensureIndexes(),
  ]);

  const logger = new ConsoleApplicationLogger();
  const fileStorage = new S3FileStorageService(imageStorage);
  const imageProcessing = new SharpImageProcessingService();
  const passwordHasher = new ScryptPasswordHasher();
  const tokenService = new SecurityTokenService();
  const healthService = new HealthService(healthRepository);
  const authService = new AuthService(
    authRepository,
    passwordHasher,
    tokenService,
    env.authSessionTtlMs,
  );
  const wardrobeService = new WardrobeService(wardrobeRepository, {
    repository: wardrobeRepository,
    fileStorage,
    logger,
  });
  const physicalProfileService = new PhysicalProfileService(physicalProfileRepository);
  const wardrobeImageService = new WardrobeImageService(
    wardrobeRepository,
    wardrobeRepository,
    imageProcessing,
    fileStorage,
    logger,
  );

  return {
    apiRouter: createApiRouter(
      healthService,
      authService,
      wardrobeService,
      physicalProfileService,
      wardrobeImageService,
    ),
    async shutdown() {
      fileStorage.shutdown();
      await database.disconnect();
    },
  };
}
