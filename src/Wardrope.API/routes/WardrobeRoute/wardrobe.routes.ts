import { Router } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IWardrobeService } from '../../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import { WardrobeController } from '../../controllers/WardrobeController/wardrobe.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';

export function createWardrobeRoutes(
  wardrobeService: IWardrobeService,
  authService: IAuthService,
): Router {
  const router = Router();
  const controller = new WardrobeController(wardrobeService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.use(authenticate);

  router.get('/', controller.list);
  router.post('/', requireCsrf, controller.create);
  router.get('/:itemId', controller.getById);
  router.patch('/:itemId', requireCsrf, controller.update);
  router.delete('/:itemId', requireCsrf, controller.delete);

  return router;
}
