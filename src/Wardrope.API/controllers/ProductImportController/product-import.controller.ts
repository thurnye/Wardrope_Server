import type { Request, Response } from 'express';
import type { IProductImportService } from '../../../Wardrope.Core/services/ServicesInterface/ProductImport/product-import.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import {
  importProductImageBodySchema,
  productImportPreviewBodySchema,
  wardrobeItemIdParamsSchema,
} from '../../validation/wardrobe.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

export class ProductImportController extends BaseApiController {
  constructor(private readonly productImportService: IProductImportService) {
    super();
  }

  preview = async (req: Request, res: Response) => {
    const parsed = productImportPreviewBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Enter a valid HTTPS product link.',
        {
          fields: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const result = await this.productImportService.preview(
      parsed.data.sourceUrl,
    );
    if (result.ok) return this.okResponse(res, result.preview);

    switch (result.reason) {
      case 'SOURCE_URL_NOT_ALLOWED':
        return this.errorResponse(
          res,
          400,
          'PRODUCT_SOURCE_URL_NOT_ALLOWED',
          'That product link cannot be imported.',
        );
      case 'SOURCE_TOO_LARGE':
        return this.errorResponse(
          res,
          413,
          'PRODUCT_SOURCE_TOO_LARGE',
          'The product page is too large to import safely.',
        );
      case 'UNSUPPORTED_SOURCE':
        return this.errorResponse(
          res,
          422,
          'PRODUCT_SOURCE_UNSUPPORTED',
          'The link did not return a supported product page.',
        );
      case 'PRODUCT_NOT_RECOGNIZED':
        return this.errorResponse(
          res,
          422,
          'PRODUCT_NOT_RECOGNIZED',
          'Wardrope could not recognize product details from that page.',
        );
      case 'SOURCE_UNAVAILABLE':
      default:
        return this.errorResponse(
          res,
          502,
          'PRODUCT_SOURCE_UNAVAILABLE',
          'The product page could not be reached right now.',
        );
    }
  };

  importImage = async (req: Request, res: Response) => {
    const params = wardrobeItemIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'The wardrobe item identifier is invalid.',
      );
    }

    const body = importProductImageBodySchema.safeParse(req.body);
    if (!body.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'The selected source image is invalid.',
      );
    }

    const { user } = getAuthenticatedContext(res);
    const selectedImageUrls = body.data.imageUrls ??
      (body.data.imageUrl ? [body.data.imageUrl] : undefined);
    const result = selectedImageUrls
      ? await this.productImportService.importImage(user.id, params.data.itemId, selectedImageUrls)
      : await this.productImportService.importImage(user.id, params.data.itemId);
    if (result.ok) return this.okResponse(res, result.item);

    switch (result.reason) {
      case 'NOT_FOUND':
        return this.errorResponse(
          res,
          404,
          'WARDROBE_ITEM_NOT_FOUND',
          'Wardrobe item was not found.',
        );
      case 'SOURCE_URL_MISSING':
        return this.errorResponse(
          res,
          409,
          'PRODUCT_SOURCE_URL_MISSING',
          'This wardrobe item does not have a saved product link.',
        );
      case 'SOURCE_URL_NOT_ALLOWED':
        return this.errorResponse(
          res,
          400,
          'PRODUCT_SOURCE_URL_NOT_ALLOWED',
          'The saved product link cannot be imported.',
        );
      case 'SOURCE_TOO_LARGE':
        return this.errorResponse(
          res,
          413,
          'PRODUCT_SOURCE_TOO_LARGE',
          'The remote product image is too large to import safely.',
        );
      case 'SOURCE_IMAGE_MISSING':
        return this.errorResponse(
          res,
          422,
          'PRODUCT_SOURCE_IMAGE_MISSING',
          'The product page does not expose an importable primary image.',
        );
      case 'INVALID_IMAGE':
        return this.errorResponse(
          res,
          422,
          'WARDROBE_IMAGE_INVALID',
          'The remote product image is not a supported wardrobe image.',
        );
      case 'CONFLICT':
        return this.errorResponse(
          res,
          409,
          'WARDROBE_IMAGE_CONFLICT',
          'The wardrobe image changed while the product image was importing. Try again.',
        );
      case 'SOURCE_UNAVAILABLE':
        return this.errorResponse(
          res,
          502,
          'PRODUCT_SOURCE_UNAVAILABLE',
          'The product page or image could not be reached right now.',
        );
      case 'STORAGE_UNAVAILABLE':
      default:
        return this.errorResponse(
          res,
          503,
          'WARDROBE_STORAGE_UNAVAILABLE',
          'The product image could not be saved right now.',
        );
    }
  };
}
