import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { IPhysicalProfileService } from '../../../Wardrope.Core/services/ServicesInterface/PhysicalProfile/physical-profile.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import { replacePhysicalProfileBodySchema } from '../../validation/physical-profile.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return {
    fields: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export class PhysicalProfileController extends BaseApiController {
  constructor(private readonly physicalProfileService: IPhysicalProfileService) {
    super();
  }

  get = async (_req: Request, res: Response) => {
    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.physicalProfileService.get(user.id));
  };

  replace = async (req: Request, res: Response) => {
    const parsed = replacePhysicalProfileBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please correct the physical profile details.',
        validationFields(parsed.error),
      );
    }

    const { user } = getAuthenticatedContext(res);
    return this.okResponse(
      res,
      await this.physicalProfileService.replace(user.id, parsed.data),
    );
  };

  reset = async (_req: Request, res: Response) => {
    const { user } = getAuthenticatedContext(res);
    await this.physicalProfileService.reset(user.id);
    return this.okResponse(res, { reset: true as const });
  };
}
