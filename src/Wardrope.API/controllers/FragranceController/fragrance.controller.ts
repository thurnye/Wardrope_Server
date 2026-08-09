import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { IFragranceService } from '../../../Wardrope.Core/services/ServicesInterface/Fragrance/fragrance.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import {
  createFragranceBodySchema,
  fragranceIdParamsSchema,
  fragranceListQuerySchema,
  updateFragranceBodySchema,
} from '../../validation/fragrance.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return { fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) };
}

export class FragranceController extends BaseApiController {
  constructor(private readonly service: IFragranceService) { super(); }

  list = async (req: Request, res: Response) => {
    const parsed = fragranceListQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The fragrance filters are invalid.', validationFields(parsed.error));
    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.service.list(user.id, parsed.data));
  };

  create = async (req: Request, res: Response) => {
    const parsed = createFragranceBodySchema.safeParse(req.body);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'Please correct the fragrance details.', validationFields(parsed.error));
    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.service.create(user.id, parsed.data), 201);
  };

  getById = async (req: Request, res: Response) => {
    const parsed = fragranceIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The fragrance identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    const fragrance = await this.service.getById(user.id, parsed.data.fragranceId);
    return fragrance
      ? this.okResponse(res, fragrance)
      : this.errorResponse(res, 404, 'FRAGRANCE_NOT_FOUND', 'Fragrance was not found.');
  };

  update = async (req: Request, res: Response) => {
    const params = fragranceIdParamsSchema.safeParse(req.params);
    const body = updateFragranceBodySchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'Please correct the fragrance update.', body.success ? undefined : validationFields(body.error));
    }
    const { user } = getAuthenticatedContext(res);
    const fragrance = await this.service.update(user.id, params.data.fragranceId, body.data);
    return fragrance
      ? this.okResponse(res, fragrance)
      : this.errorResponse(res, 404, 'FRAGRANCE_NOT_FOUND', 'Fragrance was not found.');
  };

  delete = async (req: Request, res: Response) => {
    const parsed = fragranceIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The fragrance identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    const deleted = await this.service.delete(user.id, parsed.data.fragranceId);
    return deleted
      ? this.okResponse(res, { deleted: true as const })
      : this.errorResponse(res, 404, 'FRAGRANCE_NOT_FOUND', 'Fragrance was not found.');
  };
}
