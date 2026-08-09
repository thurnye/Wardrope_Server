import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type {
  IOutfitService,
  IWearHistoryService,
  OutfitMutationResult,
  WearHistoryMutationResult,
} from '../../../Wardrope.Core/services/ServicesInterface/Outfit/outfit.service.interface';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';
import {
  createOutfitBodySchema,
  createWearHistoryBodySchema,
  outfitIdParamsSchema,
  outfitListQuerySchema,
  recordOutfitWearBodySchema,
  updateOutfitBodySchema,
  updateWearHistoryBodySchema,
  wearHistoryIdParamsSchema,
  wearHistoryListQuerySchema,
} from '../../validation/outfit.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return { fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) };
}

function outfitMutationError(controller: BaseApiController, res: Response, result: Exclude<OutfitMutationResult, { ok: true }>) {
  switch (result.reason) {
    case 'NOT_FOUND': return controller.errorResponse(res, 404, 'OUTFIT_NOT_FOUND', 'Outfit was not found.');
    case 'WARDROBE_ITEM_NOT_FOUND': return controller.errorResponse(res, 400, 'OUTFIT_WARDROBE_ITEM_NOT_FOUND', 'One or more wardrobe items are unavailable for this outfit.');
    case 'FRAGRANCE_NOT_FOUND': return controller.errorResponse(res, 400, 'OUTFIT_FRAGRANCE_NOT_FOUND', 'The selected fragrance is unavailable.');
  }
}

function wearMutationError(controller: BaseApiController, res: Response, result: Exclude<WearHistoryMutationResult, { ok: true }>) {
  switch (result.reason) {
    case 'NOT_FOUND': return controller.errorResponse(res, 404, 'WEAR_HISTORY_NOT_FOUND', 'Wear history entry was not found.');
    case 'WARDROBE_ITEM_NOT_FOUND': return controller.errorResponse(res, 400, 'WEAR_HISTORY_WARDROBE_ITEM_NOT_FOUND', 'One or more wardrobe items are unavailable.');
    case 'FRAGRANCE_NOT_FOUND': return controller.errorResponse(res, 400, 'WEAR_HISTORY_FRAGRANCE_NOT_FOUND', 'The selected fragrance is unavailable.');
    case 'OUTFIT_NOT_FOUND': return controller.errorResponse(res, 404, 'OUTFIT_NOT_FOUND', 'Outfit was not found.');
  }
}

export class OutfitController extends BaseApiController {
  constructor(private readonly service: IOutfitService) { super(); }

  list = async (req: Request, res: Response) => {
    const parsed = outfitListQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The outfit filters are invalid.', validationFields(parsed.error));
    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.service.list(user.id, parsed.data));
  };

  create = async (req: Request, res: Response) => {
    const parsed = createOutfitBodySchema.safeParse(req.body);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'Please correct the outfit details.', validationFields(parsed.error));
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.create(user.id, parsed.data);
    return result.ok ? this.okResponse(res, result.outfit, 201) : outfitMutationError(this, res, result);
  };

  getById = async (req: Request, res: Response) => {
    const parsed = outfitIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The outfit identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    const outfit = await this.service.getById(user.id, parsed.data.outfitId);
    return outfit ? this.okResponse(res, outfit) : this.errorResponse(res, 404, 'OUTFIT_NOT_FOUND', 'Outfit was not found.');
  };

  update = async (req: Request, res: Response) => {
    const params = outfitIdParamsSchema.safeParse(req.params);
    const body = updateOutfitBodySchema.safeParse(req.body);
    if (!params.success || !body.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'Please correct the outfit update.', body.success ? undefined : validationFields(body.error));
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.update(user.id, params.data.outfitId, body.data);
    return result.ok ? this.okResponse(res, result.outfit) : outfitMutationError(this, res, result);
  };

  delete = async (req: Request, res: Response) => {
    const parsed = outfitIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The outfit identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    return await this.service.delete(user.id, parsed.data.outfitId)
      ? this.okResponse(res, { deleted: true as const })
      : this.errorResponse(res, 404, 'OUTFIT_NOT_FOUND', 'Outfit was not found.');
  };
}

export class WearHistoryController extends BaseApiController {
  constructor(private readonly service: IWearHistoryService) { super(); }

  list = async (req: Request, res: Response) => {
    const parsed = wearHistoryListQuerySchema.safeParse(req.query);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wear history filters are invalid.', validationFields(parsed.error));
    const { user } = getAuthenticatedContext(res);
    return this.okResponse(res, await this.service.list(user.id, parsed.data));
  };

  create = async (req: Request, res: Response) => {
    const parsed = createWearHistoryBodySchema.safeParse(req.body);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'Please correct the wear history details.', validationFields(parsed.error));
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.create(user.id, parsed.data);
    return result.ok ? this.okResponse(res, result.entry, 201) : wearMutationError(this, res, result);
  };

  recordOutfitWear = async (req: Request, res: Response) => {
    const params = outfitIdParamsSchema.safeParse(req.params);
    const body = recordOutfitWearBodySchema.safeParse(req.body);
    if (!params.success || !body.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please provide a valid outfit and wear time.',
        body.success ? undefined : validationFields(body.error),
      );
    }
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.recordOutfitWear(user.id, params.data.outfitId, body.data.wornAt);
    return result.ok ? this.okResponse(res, result.entry, 201) : wearMutationError(this, res, result);
  };

  getById = async (req: Request, res: Response) => {
    const parsed = wearHistoryIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wear history identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    const entry = await this.service.getById(user.id, parsed.data.historyId);
    return entry ? this.okResponse(res, entry) : this.errorResponse(res, 404, 'WEAR_HISTORY_NOT_FOUND', 'Wear history entry was not found.');
  };

  update = async (req: Request, res: Response) => {
    const params = wearHistoryIdParamsSchema.safeParse(req.params);
    const body = updateWearHistoryBodySchema.safeParse(req.body);
    if (!params.success || !body.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'Please correct the wear history update.', body.success ? undefined : validationFields(body.error));
    const { user } = getAuthenticatedContext(res);
    const result = await this.service.update(user.id, params.data.historyId, body.data);
    return result.ok ? this.okResponse(res, result.entry) : wearMutationError(this, res, result);
  };

  delete = async (req: Request, res: Response) => {
    const parsed = wearHistoryIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return this.errorResponse(res, 400, 'VALIDATION_ERROR', 'The wear history identifier is invalid.');
    const { user } = getAuthenticatedContext(res);
    return await this.service.delete(user.id, parsed.data.historyId)
      ? this.okResponse(res, { deleted: true as const })
      : this.errorResponse(res, 404, 'WEAR_HISTORY_NOT_FOUND', 'Wear history entry was not found.');
  };
}
