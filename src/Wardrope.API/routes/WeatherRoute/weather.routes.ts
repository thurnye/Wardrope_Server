import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IWeatherService } from '../../../Wardrope.Core/services/ServicesInterface/Weather/weather.service.interface';
import { WeatherController } from '../../controllers/WeatherController/weather.controller';
import { createAuthenticationMiddleware } from '../../middleware/authentication.middleware';

export function createWeatherRoutes(
  weatherService: IWeatherService,
  authService: IAuthService,
): Router {
  const router = Router();
  const controller = new WeatherController(weatherService);
  const authenticate = createAuthenticationMiddleware(authService);
  const weatherLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(authenticate);
  router.get('/context', weatherLimiter, controller.context);
  return router;
}
