import { Router } from 'express';
import type { IHealthService } from '../../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import { HealthController } from '../../controllers/HealthController/health.controller';

export function createHealthRoutes(healthService: IHealthService): Router {
  const router = Router();
  const controller = new HealthController(healthService);

  router.get('/', controller.getStatus);
  router.get('/readiness', controller.getReadiness);

  return router;
}
