import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IProductImportService } from '../../../Wardrope.Core/services/ServicesInterface/ProductImport/product-import.service.interface';
import { ProductImportController } from '../../controllers/ProductImportController/product-import.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';

export function createProductImportRoutes(
  productImportService: IProductImportService,
  authService: IAuthService,
): Router {
  const router = Router({ mergeParams: true });
  const controller = new ProductImportController(productImportService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);
  const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(authenticate);
  router.post('/import-preview', requireCsrf, importLimiter, controller.preview);
  router.post('/:itemId/image/import-source', requireCsrf, importLimiter, controller.importImage);

  return router;
}
