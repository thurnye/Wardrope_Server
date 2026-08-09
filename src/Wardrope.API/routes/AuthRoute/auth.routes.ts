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

export function createAuthRoutes(authService: IAuthService): Router {
  const router = Router();
  const controller = new AuthController(authService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.post('/register', registerRateLimiter, controller.register);
  router.post('/login', loginRateLimiter, controller.login);
  router.get('/session', controller.getSession);
  router.post('/logout', authenticate, requireCsrf, controller.logout);

  return router;
}
