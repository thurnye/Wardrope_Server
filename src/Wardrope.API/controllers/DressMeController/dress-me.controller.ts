import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { IDressMeService } from '../../../Wardrope.Core/services/ServicesInterface/DressMe/dress-me.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import { dressMeRequestBodySchema } from '../../validation/dress-me.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return {
    fields: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export class DressMeController extends BaseApiController {
  constructor(private readonly service: IDressMeService) {
    super();
  }

  recommend = async (req: Request, res: Response) => {
    const parsed = dressMeRequestBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please correct the Dress Me request.',
        validationFields(parsed.error),
      );
    }

    const { user } = getAuthenticatedContext(res);
    const result = await this.service.recommend(user.id, parsed.data);
    if (result.ok) return this.okResponse(res, result.response);

    switch (result.reason) {
      case 'WARDROBE_EMPTY':
        return this.errorResponse(
          res,
          409,
          'DRESS_ME_WARDROBE_EMPTY',
          'Add wardrobe items before asking Wardrope to dress you.',
        );
      case 'NO_RECOMMENDATION':
        return this.errorResponse(
          res,
          422,
          'DRESS_ME_NO_RECOMMENDATION',
          'Wardrope could not build a usable outfit from the current collection.',
        );
      case 'PROVIDER_UNAVAILABLE':
        return this.errorResponse(
          res,
          503,
          'DRESS_ME_UNAVAILABLE',
          'Dress Me is temporarily unavailable. Please try again.',
        );
    }
  };
}
