import { Router } from 'express';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type { IPhysicalProfileService } from '../../Wardrope.Core/services/ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import type { IPreferencesService } from '../../Wardrope.Core/services/ServicesInterface/Preferences/preferences.service.interface';
import type { IProductImportService } from '../../Wardrope.Core/services/ServicesInterface/ProductImport/product-import.service.interface';
import type { IWardrobeService } from '../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWardrobeImageService } from '../../Wardrope.Core/services/ServicesInterface/WardrobeImage/wardrobe-image.service.interface';
import { createAuthRoutes } from './AuthRoute/auth.routes';
import { createHealthRoutes } from './HealthRoute/health.routes';
import { createPhysicalProfileRoutes } from './PhysicalProfileRoute/physical-profile.routes';
import { createPreferencesRoutes } from './PreferencesRoute/preferences.routes';
import { createProductImportRoutes } from './ProductImportRoute/product-import.routes';
import { createWardrobeRoutes } from './WardrobeRoute/wardrobe.routes';
import { createWardrobeImageRoutes } from './WardrobeImageRoute/wardrobe-image.routes';

export function createApiRouter(
  healthService: IHealthService,
  authService: IAuthService,
  wardrobeService: IWardrobeService,
  wardrobeImageService?: IWardrobeImageService,
  physicalProfileService?: IPhysicalProfileService,
  productImportService?: IProductImportService,
  preferencesService?: IPreferencesService,
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

  const router = Router();
  router.use('/health', createHealthRoutes(healthService));
  router.use('/auth', createAuthRoutes(authService));
  router.use('/wardrobe', createWardrobeRoutes(wardrobeService, authService));

  if (physicalProfileService) {
    router.use('/physical-profile', createPhysicalProfileRoutes(physicalProfileService, authService));
  }

  if (wardrobeImageService) {
    router.use('/wardrobe', createWardrobeImageRoutes(wardrobeImageService, wardrobeService, authService));
  }

  if (productImportService) {
    router.use('/wardrobe', createProductImportRoutes(productImportService, authService));
  }

  if (preferencesService) {
    router.use('/preferences', createPreferencesRoutes(preferencesService, authService));
  }

  return router;
}
