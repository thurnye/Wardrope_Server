import { Router } from 'express';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IFragranceService } from '../../Wardrope.Core/services/ServicesInterface/Fragrance/fragrance.service.interface';
import type { IFragranceImageService } from '../../Wardrope.Core/services/ServicesInterface/FragranceImage/fragrance-image.service.interface';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type {
  IOutfitService,
  IWearHistoryService,
} from '../../Wardrope.Core/services/ServicesInterface/Outfit/outfit.service.interface';
import type { IPhysicalProfileService } from '../../Wardrope.Core/services/ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import type { IPreferencesService } from '../../Wardrope.Core/services/ServicesInterface/Preferences/preferences.service.interface';
import type { IProductImportService } from '../../Wardrope.Core/services/ServicesInterface/ProductImport/product-import.service.interface';
import type { IWardropeService } from '../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWardropeImageService } from '../../Wardrope.Core/services/ServicesInterface/WardrobeImage/wardrobe-image.service.interface';
import type { IWeatherService } from '../../Wardrope.Core/services/ServicesInterface/Weather/weather.service.interface';
import { createAuthRoutes } from './AuthRoute/auth.routes';
import { createFragranceRoutes } from './FragranceRoute/fragrance.routes';
import { createFragranceImageRoutes } from './FragranceImageRoute/fragrance-image.routes';
import { createHealthRoutes } from './HealthRoute/health.routes';
import { createOutfitRoutes } from './OutfitRoute/outfit.routes';
import { createPhysicalProfileRoutes } from './PhysicalProfileRoute/physical-profile.routes';
import { createPreferencesRoutes } from './PreferencesRoute/preferences.routes';
import { createProductImportRoutes } from './ProductImportRoute/product-import.routes';
import { createWardrobeRoutes } from './WardrobeRoute/wardrobe.routes';
import { createWardrobeImageRoutes } from './WardrobeImageRoute/wardrobe-image.routes';
import { createWeatherRoutes } from './WeatherRoute/weather.routes';

export function createApiRouter(
  healthService: IHealthService,
  authService: IAuthService,
  wardrobeService: IWardropeService,
  wardrobeImageService?: IWardropeImageService,
  physicalProfileService?: IPhysicalProfileService,
  productImportService?: IProductImportService,
  preferencesService?: IPreferencesService,
  weatherService?: IWeatherService,
  fragranceService?: IFragranceService,
  fragranceImageService?: IFragranceImageService,
  outfitService?: IOutfitService,
  wearHistoryService?: IWearHistoryService,
): Router {
  if (!physicalProfileService && process.env.NODE_ENV !== 'test') {
    throw new Error('Physical Profile service is required to create the Wardrope API router.');
  }
  if (!productImportService && process.env.NODE_ENV !== 'test') {
    throw new Error('Product Import service is required to create the Wardrope API router.');
  }
  if (!preferencesService && process.env.NODE_ENV !== 'test') {
    throw new Error('Preferences service is required to create the Wardrope API router.');
  }
  if (!weatherService && process.env.NODE_ENV !== 'test') {
    throw new Error('Weather service is required to create the Wardrope API router.');
  }
  if ((!fragranceService || !fragranceImageService) && process.env.NODE_ENV !== 'test') {
    throw new Error('Fragrance services are required to create the Wardrope API router.');
  }
  if ((!outfitService || !wearHistoryService) && process.env.NODE_ENV !== 'test') {
    throw new Error('Outfit and Wear History services are required to create the Wardrope API router.');
  }

  const router = Router();
  router.use('/health', createHealthRoutes(healthService));
  router.use('/auth', createAuthRoutes(authService));
  router.use('/wardrobe', createWardrobeRoutes(wardrobeService, authService));

  if (physicalProfileService) router.use('/physical-profile', createPhysicalProfileRoutes(physicalProfileService, authService));
  if (wardrobeImageService) router.use('/wardrobe', createWardrobeImageRoutes(wardrobeImageService, wardrobeService, authService));
  if (productImportService) router.use('/wardrobe', createProductImportRoutes(productImportService, authService));
  if (preferencesService) router.use('/preferences', createPreferencesRoutes(preferencesService, authService));
  if (weatherService) router.use('/weather', createWeatherRoutes(weatherService, authService));
  if (fragranceService) router.use('/fragrances', createFragranceRoutes(fragranceService, authService));
  if (fragranceService && fragranceImageService) {
    router.use('/fragrances', createFragranceImageRoutes(fragranceImageService, fragranceService, authService));
  }
  if (outfitService && wearHistoryService) {
    router.use('/outfits', createOutfitRoutes(outfitService, wearHistoryService, authService));
  }

  return router;
}
