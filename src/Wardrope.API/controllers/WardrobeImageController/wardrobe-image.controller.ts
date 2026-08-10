import type { Request, Response } from 'express';
import type { IWardrobeImageService } from '../../../Wardrope.Core/services/ServicesInterface/WardrobeImage/wardrobe-image.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import { wardrobeItemIdParamsSchema } from '../../validation/wardrobe.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

export class WardrobeImageController extends BaseApiController {
  constructor(private readonly wardrobeImageService: IWardrobeImageService) {
    super();
  }

  replace = async (req: Request, res: Response) => {
    const parsed = wardrobeItemIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wardrobe item identifier is invalid.');
    }

    if (!req.file) {
      return this.errorResponse(res, 400, 'WARDROBE_IMAGE_REQUIRED', 'Choose an image to upload.');
    }

    const { user } = getAuthenticatedContext(res);
    const result = await this.wardrobeImageService.replace(user.id, parsed.data.itemId, {
      bytes: req.file.buffer,
      declaredContentType: req.file.mimetype || null,
    });

    if (result.ok) {
      return this.okResponse(res, result.item);
    }

    switch (result.reason) {
      case 'NOT_FOUND':
        return this.errorResponse(res, 404, 'WARDROBE_ITEM_NOT_FOUND', 'Wardrobe item was not found.');
      case 'CONFLICT':
        return this.errorResponse(
          res,
          409,
          'WARDROBE_IMAGE_CONFLICT',
          'The wardrobe image changed while this upload was being saved. Refresh and try again.',
        );
      case 'INVALID_IMAGE':
        return this.errorResponse(
          res,
          400,
          result.validationReason ?? 'INVALID_IMAGE',
          'The uploaded file is not a supported wardrobe image.',
        );
      case 'STORAGE_UNAVAILABLE':
        return this.errorResponse(
          res,
          503,
          'WARDROBE_IMAGE_STORAGE_UNAVAILABLE',
          'Wardrobe image storage is temporarily unavailable.',
        );
    }
  };

  read = async (req: Request, res: Response) => {
    const parsed = wardrobeItemIdParamsSchema.safeParse({
      itemId: req.params.itemId,
    });
    if (!parsed.success) {
      return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wardrobe item identifier is invalid.');
    }

    const { user } = getAuthenticatedContext(res);
    const rawImageIndex = req.params.imageIndex;
    const imageIndex = rawImageIndex === undefined ? 0 : Number(rawImageIndex);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex > 7) {
      return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wardrobe image index is invalid.');
    }
    const result = await this.wardrobeImageService.read(user.id, parsed.data.itemId, imageIndex);

    if (!result.ok) {
      if (result.reason === 'NOT_FOUND') {
        return this.errorResponse(res, 404, 'WARDROBE_IMAGE_NOT_FOUND', 'Wardrobe image was not found.');
      }

      return this.errorResponse(
        res,
        503,
        'WARDROBE_IMAGE_STORAGE_UNAVAILABLE',
        'Wardrobe image storage is temporarily unavailable.',
      );
    }

    const { image } = result;
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', String(image.contentLength));

    if (image.etag) {
      res.setHeader('ETag', image.etag);
      if (req.header('if-none-match') === image.etag) {
        return res.status(304).end();
      }
    }

    if (image.lastModified) {
      res.setHeader('Last-Modified', image.lastModified.toUTCString());
    }

    return res.status(200).send(Buffer.from(image.body));
  };

  remove = async (req: Request, res: Response) => {
    const parsed = wardrobeItemIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wardrobe item identifier is invalid.');
    }

    const { user } = getAuthenticatedContext(res);
    const result = await this.wardrobeImageService.remove(user.id, parsed.data.itemId);

    if (result.ok) {
      return this.okResponse(res, result.item);
    }

    switch (result.reason) {
      case 'NOT_FOUND':
        return this.errorResponse(res, 404, 'WARDROBE_ITEM_NOT_FOUND', 'Wardrobe item was not found.');
      case 'CONFLICT':
        return this.errorResponse(
          res,
          409,
          'WARDROBE_IMAGE_CONFLICT',
          'The wardrobe image changed while it was being removed. Refresh and try again.',
        );
      case 'INVALID_IMAGE':
        return this.errorResponse(res, 400, 'INVALID_IMAGE', 'The wardrobe image is invalid.');
      case 'STORAGE_UNAVAILABLE':
        return this.errorResponse(
          res,
          503,
          'WARDROBE_IMAGE_STORAGE_UNAVAILABLE',
          'Wardrobe image storage is temporarily unavailable.',
        );
    }
  };
}
