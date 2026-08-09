import { assertRuntimeConfiguration, env } from '../../config/env';
import { getImageStorageConfig } from '../../config/image-storage.env';
import { AuthService } from '../../Wardrope.Core/services/ServicesImplementation/Auth/auth.service';
import { HealthService } from '../../Wardrope.Core/services/ServicesImplementation/Health/health.service';
import { PhysicalProfileService } from '../../Wardrope.Core/services/ServicesImplementation/PhysicalProfile/physical-profile.service';
import { PreferencesService } from '../../Wardrope.Core/services/ServicesImplementation/Preferences/preferences.service';
import { ProductImportService } from '../../Wardrope.Core/services/ServicesImplementation/ProductImport/product-import.service';
import { WardrobeService } from '../../Wardrope.Core/services/ServicesImplementation/Wardrobe/wardrobe.service';
import { WardrobeImageService } from '../../Wardrope.Core/services/ServicesImplementation/WardrobeImage/wardrobe-image.service';
import { WeatherService } from '../../Wardrope.Core/services/ServicesImplementation/Weather/weather.service';
import { MongoDatabaseConnection } from '../../Wardrope.DB/connection/mongo-database.connection';
import { AuthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Auth/auth.repository';
import { HealthRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Health/health.repository';
import { PhysicalProfileRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/PhysicalProfile/physical-profile.repository';
import { PreferencesRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Preferences/preferences.repository';
import { WardrobeRepository } from '../../Wardrope.DB/repositories/RepositoryImplementation/Wardrobe/wardrobe.repository';
import { SharpImageProcessingService } from '../../Wardrope.Infra/services/ImageProcessing/sharp-image-processing.service';
import { ConsoleApplicationLogger } from '../../Wardrope.Infra/services/Logging/console-application-logger.service';
import { HttpProductSourceService } from '../../Wardrope.Infra/services/ProductSource/http-product-source.service';
import { ScryptPasswordHasher } from '../../Wardrope.Infra/services/Security/scrypt-password-hasher.service';
import { SecurityTokenService } from '../../Wardrope.Infra/services/Security/security-token.service';
import { S3FileStorageService } from '../../Wardrope.Infra/services/Storage/s3-file-storage.service';
import { WeatherApiComWeatherSourceService } from '../../Wardrope.Infra/services/WeatherSource/weather-api-com-weather-source.service';
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
  if (!env.weatherApiKey) {
    throw new Error('Weather provider configuration is required to create the application runtime.');
  }

  const imageStorage = getImageStorageConfig();
  const database = new MongoDatabaseConnection(env.mongoUri, env.mongoDbName);
  await database.connect();

  const healthRepository = new HealthRepository(database);
  const authRepository = new AuthRepository(database);
  const wardrobeRepository = new WardrobeRepository(database);
  const physicalProfileRepository = new PhysicalProfileRepository(database);
  const preferencesRepository = new PreferencesRepository(database);
  await Promise.all([
    authRepository.ensureIndexes(),
    wardrobeRepository.ensureIndexes(),
    physicalProfileRepository.ensureIndexes(),
    preferencesRepository.ensureIndexes(),
  ]);

  const logger = new ConsoleApplicationLogger();
  const fileStorage = new S3FileStorageService(imageStorage);
  const imageProcessing = new SharpImageProcessingService();
  const productSourceService = new HttpProductSourceService();
  const weatherSourceService = new WeatherApiComWeatherSourceService(env.weatherApiKey);
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
  const preferencesService = new PreferencesService(preferencesRepository);
  const weatherService = new WeatherService(weatherSourceService, logger);
  const wardrobeImageService = new WardrobeImageService(
    wardrobeRepository,
    wardrobeRepository,
    imageProcessing,
    fileStorage,
    logger,
  );
  const productImportService = new ProductImportService(
    wardrobeRepository,
    wardrobeImageService,
    productSourceService,
  );

  return {
    apiRouter: createApiRouter(
      healthService,
      authService,
      wardrobeService,
      wardrobeImageService,
      physicalProfileService,
      productImportService,
      preferencesService,
      weatherService,
    ),
    async shutdown() {
      fileStorage.shutdown();
      await database.disconnect();
    },
  };
}
