import { Router } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IPreferencesService } from '../../../Wardrope.Core/services/ServicesInterface/Preferences/preferences.service.interface';
import { PreferencesController } from '../../controllers/PreferencesController/preferences.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';

export function createPreferencesRoutes(
  preferencesService: IPreferencesService,
  authService: IAuthService,
): Router {
  const router = Router();
  const controller = new PreferencesController(preferencesService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.use(authenticate);
  router.get('/', controller.get);
  router.put('/', requireCsrf, controller.replace);
  router.delete('/', requireCsrf, controller.reset);

  return router;
}
