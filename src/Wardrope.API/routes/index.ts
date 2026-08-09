import { Router } from 'express';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import type { IWardrobeService } from '../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import { createAuthRoutes } from './AuthRoute/auth.routes';
import { createHealthRoutes } from './HealthRoute/health.routes';
import { createWardrobeRoutes } from './WardrobeRoute/wardrobe.routes';

export function createApiRouter(
  healthService: IHealthService,
  authService: IAuthService,
  wardrobeService: IWardrobeService,
): Router {
  const router = Router();

  router.use('/health', createHealthRoutes(healthService));
  router.use('/auth', createAuthRoutes(authService));
  router.use('/wardrobe', createWardrobeRoutes(wardrobeService, authService));

  return router;
}
