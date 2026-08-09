import { Router } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IFragranceService } from '../../../Wardrope.Core/services/ServicesInterface/Fragrance/fragrance.service.interface';
import { FragranceController } from '../../controllers/FragranceController/fragrance.controller';
import { createAuthenticationMiddleware, createCsrfMiddleware } from '../../middleware/authentication.middleware';

export function createFragranceRoutes(service: IFragranceService, authService: IAuthService): Router {
  const router = Router();
  const controller = new FragranceController(service);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.use(authenticate);
  router.get('/', controller.list);
  router.post('/', requireCsrf, controller.create);
  router.get('/:fragranceId', controller.getById);
  router.patch('/:fragranceId', requireCsrf, controller.update);
  router.delete('/:fragranceId', requireCsrf, controller.delete);
  return router;
}
