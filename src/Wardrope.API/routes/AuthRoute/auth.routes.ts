import { Router } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import { AuthController } from '../../controllers/AuthController/auth.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';
import {
  loginRateLimiter,
  registerRateLimiter,
} from '../../middleware/auth-rate-limit.middleware';
import { requireTrustedBrowserOrigin } from '../../middleware/origin.middleware';

export function createAuthRoutes(authService: IAuthService): Router {
  const router = Router();
  const controller = new AuthController(authService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.post(
    '/register',
    requireTrustedBrowserOrigin,
    registerRateLimiter,
    controller.register,
  );
  router.post(
    '/login',
    requireTrustedBrowserOrigin,
    loginRateLimiter,
    controller.login,
  );
  router.get('/session', controller.getSession);
  router.post(
    '/logout',
    requireTrustedBrowserOrigin,
    authenticate,
    requireCsrf,
    controller.logout,
  );

  return router;
}
