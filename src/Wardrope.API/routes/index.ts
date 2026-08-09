import { Router } from 'express';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import { createAuthRoutes } from './AuthRoute/auth.routes';
import { createHealthRoutes } from './HealthRoute/health.routes';

export function createApiRouter(
  healthService: IHealthService,
  authService: IAuthService,
): Router {
  const router = Router();

  router.use('/health', createHealthRoutes(healthService));
  router.use('/auth', createAuthRoutes(authService));

  return router;
}
