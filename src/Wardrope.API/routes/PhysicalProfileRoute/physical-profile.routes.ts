import { Router } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IPhysicalProfileService } from '../../../Wardrope.Core/services/ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import { PhysicalProfileController } from '../../controllers/PhysicalProfileController/physical-profile.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';

export function createPhysicalProfileRoutes(
  physicalProfileService: IPhysicalProfileService,
  authService: IAuthService,
): Router {
  const router = Router();
  const controller = new PhysicalProfileController(physicalProfileService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.use(authenticate);
  router.get('/', controller.get);
  router.put('/', requireCsrf, controller.replace);
  router.delete('/', requireCsrf, controller.reset);

  return router;
}
