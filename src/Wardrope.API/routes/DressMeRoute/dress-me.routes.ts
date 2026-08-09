import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IDressMeService } from '../../../Wardrope.Core/services/ServicesInterface/DressMe/dress-me.service.interface';
import { DressMeController } from '../../controllers/DressMeController/dress-me.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';

export function createDressMeRoutes(
  dressMeService: IDressMeService,
  authService: IAuthService,
): Router {
  const router = Router();
  const controller = new DressMeController(dressMeService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);
  const recommendationLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(authenticate);
  router.post('/recommend', requireCsrf, recommendationLimiter, controller.recommend);
  return router;
}
