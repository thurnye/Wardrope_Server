import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { IPreferencesService } from '../../../Wardrope.Core/services/ServicesInterface/Preferences/preferences.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import { replacePreferencesBodySchema } from '../../validation/preferences.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return {
    fields: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export class PreferencesController extends BaseApiController {
  constructor(private readonly preferencesService: IPreferencesService) {
    super();
  }

  get = async (_req: Request, res: Response) => {
    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.preferencesService.get(user.id));
  };

  replace = async (req: Request, res: Response) => {
    const parsed = replacePreferencesBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please correct your style preferences.',
        validationFields(parsed.error),
      );
    }

    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.preferencesService.replace(user.id, parsed.data));
  };

  reset = async (_req: Request, res: Response) => {
    const { user } = getAuthenticatedContext(res);
    await this.preferencesService.reset(user.id);
    return this.okResponse(res, { reset: true as const });
  };
}
