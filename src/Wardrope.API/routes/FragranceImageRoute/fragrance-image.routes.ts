import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IFragranceService } from '../../../Wardrope.Core/services/ServicesInterface/Fragrance/fragrance.service.interface';
import type { IFragranceImageService } from '../../../Wardrope.Core/services/ServicesInterface/FragranceImage/fragrance-image.service.interface';
import { FragranceImageController } from '../../controllers/FragranceImageController/fragrance-image.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
  getAuthenticatedContext,
} from '../../middleware/authentication.middleware';
import { fragranceIdParamsSchema } from '../../validation/fragrance.validation';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
});

function uploadSingleImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        success: false,
        error: {
          code: tooLarge ? 'FRAGRANCE_IMAGE_TOO_LARGE' : 'FRAGRANCE_IMAGE_UPLOAD_INVALID',
          message: tooLarge ? 'Fragrance images must be 10 MB or smaller.' : 'The fragrance image upload is invalid.',
        },
        meta: { requestId: String(res.locals.requestId || 'unknown') },
      });
      return;
    }
    next(error);
  });
}

function createOwnershipPreflight(service: IFragranceService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const parsed = fragranceIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'The fragrance identifier is invalid.' },
        meta: { requestId: String(res.locals.requestId || 'unknown') },
      });
      return;
    }
    const { user } = getAuthenticatedContext(res);
    if (!await service.getById(user.id, parsed.data.fragranceId)) {
      res.status(404).json({
        success: false,
        error: { code: 'FRAGRANCE_NOT_FOUND', message: 'Fragrance was not found.' },
        meta: { requestId: String(res.locals.requestId || 'unknown') },
      });
      return;
    }
    next();
  };
}

export function createFragranceImageRoutes(
  imageService: IFragranceImageService,
  fragranceService: IFragranceService,
  authService: IAuthService,
): Router {
  const router = Router({ mergeParams: true });
  const controller = new FragranceImageController(imageService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);
  const ownershipPreflight = createOwnershipPreflight(fragranceService);
  const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(authenticate);
  router.get('/:fragranceId/image', controller.read);
  router.put('/:fragranceId/image', requireCsrf, mutationLimiter, ownershipPreflight, uploadSingleImage, controller.replace);
  router.delete('/:fragranceId/image', requireCsrf, mutationLimiter, ownershipPreflight, controller.remove);
  return router;
}
