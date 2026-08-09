import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer, { MulterError } from 'multer';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IWardrobeService } from '../../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWardrobeImageService } from '../../../Wardrope.Core/services/ServicesInterface/WardrobeImage/wardrobe-image.service.interface';
import { WardrobeImageController } from '../../controllers/WardrobeImageController/wardrobe-image.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
  getAuthenticatedContext,
} from '../../middleware/authentication.middleware';
import { wardrobeItemIdParamsSchema } from '../../validation/wardrobe.validation';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },
});

function uploadSingleImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        success: false,
        error: {
          code: tooLarge ? 'WARDROBE_IMAGE_TOO_LARGE' : 'WARDROBE_IMAGE_UPLOAD_INVALID',
          message: tooLarge
            ? 'Wardrobe images must be 10 MB or smaller.'
            : 'The wardrobe image upload is invalid.',
        },
        meta: {
          requestId: String(res.locals.requestId || 'unknown'),
        },
      });
      return;
    }

    next(error);
  });
}

function createOwnershipPreflight(wardrobeService: IWardrobeService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const parsed = wardrobeItemIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The wardrobe item identifier is invalid.',
        },
        meta: { requestId: String(res.locals.requestId || 'unknown') },
      });
      return;
    }

    const { user } = getAuthenticatedContext(res);
    const item = await wardrobeService.getById(user.id, parsed.data.itemId);

    if (!item) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WARDROBE_ITEM_NOT_FOUND',
          message: 'Wardrobe item was not found.',
        },
        meta: { requestId: String(res.locals.requestId || 'unknown') },
      });
      return;
    }

    next();
  };
}

export function createWardrobeImageRoutes(
  wardrobeImageService: IWardrobeImageService,
  wardrobeService: IWardrobeService,
  authService: IAuthService,
): Router {
  const router = Router({ mergeParams: true });
  const controller = new WardrobeImageController(wardrobeImageService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);
  const ownershipPreflight = createOwnershipPreflight(wardrobeService);
  const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(authenticate);
  router.get('/:itemId/image', controller.read);
  router.put(
    '/:itemId/image',
    requireCsrf,
    mutationLimiter,
    ownershipPreflight,
    uploadSingleImage,
    controller.replace,
  );
  router.delete(
    '/:itemId/image',
    requireCsrf,
    mutationLimiter,
    ownershipPreflight,
    controller.remove,
  );

  return router;
}
