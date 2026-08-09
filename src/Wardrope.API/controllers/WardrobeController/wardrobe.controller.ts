import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { IWardrobeService } from '../../../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import {
  createWardrobeItemBodySchema,
  updateWardrobeItemBodySchema,
  wardrobeItemIdParamsSchema,
  wardrobeListQuerySchema,
} from '../../validation/wardrobe.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return {
    fields: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export class WardrobeController extends BaseApiController {
  constructor(private readonly wardrobeService: IWardrobeService) {
    super();
  }

  list = async (req: Request, res: Response) => {
    const parsed = wardrobeListQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'The wardrobe filters are invalid.',
        validationFields(parsed.error),
      );
    }

    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.wardrobeService.list(user.id, parsed.data));
  };

  create = async (req: Request, res: Response) => {
    const parsed = createWardrobeItemBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please correct the wardrobe item details.',
        validationFields(parsed.error),
      );
    }

    const { user } = getAuthenticatedContext(res);
    const item = await this.wardrobeService.create(user.id, parsed.data);
    return this.okResponse(res, item, 201);
  };

  getById = async (req: Request, res: Response) => {
    const parsed = wardrobeItemIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'The wardrobe item identifier is invalid.',
      );
    }

    const { user } = getAuthenticatedContext(res);
    const item = await this.wardrobeService.getById(user.id, parsed.data.itemId);

    if (!item) {
      return this.errorResponse(
        res,
        404,
        'WARDROBE_ITEM_NOT_FOUND',
        'Wardrobe item was not found.',
      );
    }

    return this.okResponse(res, item);
  };

  update = async (req: Request, res: Response) => {
    const parsedParams = wardrobeItemIdParamsSchema.safeParse(req.params);
    const parsedBody = updateWardrobeItemBodySchema.safeParse(req.body);

    if (!parsedParams.success || !parsedBody.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please correct the wardrobe item update.',
        parsedBody.success ? undefined : validationFields(parsedBody.error),
      );
    }

    const { user } = getAuthenticatedContext(res);
    const item = await this.wardrobeService.update(
      user.id,
      parsedParams.data.itemId,
      parsedBody.data,
    );

    if (!item) {
      return this.errorResponse(
        res,
        404,
        'WARDROBE_ITEM_NOT_FOUND',
        'Wardrobe item was not found.',
      );
    }

    return this.okResponse(res, item);
  };

  delete = async (req: Request, res: Response) => {
    const parsed = wardrobeItemIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'The wardrobe item identifier is invalid.',
      );
    }

    const { user } = getAuthenticatedContext(res);
    const deleted = await this.wardrobeService.delete(user.id, parsed.data.itemId);

    if (!deleted) {
      return this.errorResponse(
        res,
        404,
        'WARDROBE_ITEM_NOT_FOUND',
        'Wardrobe item was not found.',
      );
    }

    return this.okResponse(res, { deleted: true as const });
  };
}
