import type { Request, Response } from 'express';
import type { IFragranceImageService } from '../../../Wardrope.Core/services/ServicesInterface/FragranceImage/fragrance-image.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import { fragranceIdParamsSchema } from '../../validation/fragrance.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

export class FragranceImageController extends BaseApiController {
  constructor(private readonly service: IFragranceImageService) { super(); }

  replace = async (req: Request, res: Response) => {
    const parsed = fragranceIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The fragrance identifier is invalid.');
    if (!req.file) return this.errorResponse(res, 400, 'FRAGRANCE_IMAGE_REQUIRED', 'Choose an image to upload.');

    const { user } = getAuthenticatedContext(res);
    const result = await this.service.replace(user.id, parsed.data.fragranceId, {
      bytes: req.file.buffer,
      declaredContentType: req.file.mimetype || null,
    });
    if (result.ok) return this.okResponse(res, result.fragrance);

    switch (result.reason) {
      case 'NOT_FOUND': return this.errorResponse(res, 404, 'FRAGRANCE_NOT_FOUND', 'Fragrance was not found.');
      case 'CONFLICT': return this.errorResponse(res, 409, 'FRAGRANCE_IMAGE_CONFLICT', 'The fragrance image changed while this upload was being saved. Refresh and try again.');
      case 'INVALID_IMAGE': return this.errorResponse(res, 400, result.validationReason, 'The uploaded file is not a supported fragrance image.');
      case 'STORAGE_UNAVAILABLE': return this.errorResponse(res, 503, 'FRAGRANCE_IMAGE_STORAGE_UNAVAILABLE', 'Fragrance image storage is temporarily unavailable.');
    }
  };

  read = async (req: Request, res: Response) => {
    const parsed = fragranceIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The fragrance identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.read(user.id, parsed.data.fragranceId);
    if (!result.ok) {
      return result.reason === 'NOT_FOUND'
        ? this.errorResponse(res, 404, 'FRAGRANCE_IMAGE_NOT_FOUND', 'Fragrance image was not found.')
        : this.errorResponse(res, 503, 'FRAGRANCE_IMAGE_STORAGE_UNAVAILABLE', 'Fragrance image storage is temporarily unavailable.');
    }

    const { image } = result;
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', String(image.contentLength));
    if (image.etag) {
      res.setHeader('ETag', image.etag);
      if (req.header('if-none-match') === image.etag) return res.status(304).end();
    }
    if (image.lastModified) res.setHeader('Last-Modified', image.lastModified.toUTCString());
    return res.status(200).send(Buffer.from(image.body));
  };

  remove = async (req: Request, res: Response) => {
    const parsed = fragranceIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The fragrance identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.remove(user.id, parsed.data.fragranceId);
    if (result.ok) return this.okResponse(res, result.fragrance);
    switch (result.reason) {
      case 'NOT_FOUND': return this.errorResponse(res, 404, 'FRAGRANCE_NOT_FOUND', 'Fragrance was not found.');
      case 'CONFLICT': return this.errorResponse(res, 409, 'FRAGRANCE_IMAGE_CONFLICT', 'The fragrance image changed while it was being removed. Refresh and try again.');
      case 'INVALID_IMAGE': return this.errorResponse(res, 400, 'INVALID_IMAGE', 'The fragrance image is invalid.');
      case 'STORAGE_UNAVAILABLE': return this.errorResponse(res, 503, 'FRAGRANCE_IMAGE_STORAGE_UNAVAILABLE', 'Fragrance image storage is temporarily unavailable.');
    }
  };
}
