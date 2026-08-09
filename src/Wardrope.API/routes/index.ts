import { Router } from 'express';
import type { IHealthService } from '../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import { createHealthRoutes } from './HealthRoute/health.routes';

export function createApiRouter(healthService: IHealthService): Router {
  const router = Router();

  router.use('/health', createHealthRoutes(healthService));

  return router;
}
