import { Router } from 'express';
import { z } from 'zod';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { IFragranceImportService } from '../../../Wardrope.Core/services/ServicesInterface/FragranceImport/fragrance-import.service.interface';
import { createAuthenticationMiddleware, createCsrfMiddleware, getAuthenticatedContext } from '../../middleware/authentication.middleware';
import { fragranceIdParamsSchema } from '../../validation/fragrance.validation';

const previewSchema = z.object({ sourceUrl: z.string().trim().url().refine((v) => new URL(v).protocol === 'https:') }).strict();
const imageSchema = z.object({ imageUrl: z.string().trim().url().optional() }).strict();

export function createFragranceImportRoutes(service: IFragranceImportService, auth: IAuthService): Router {
  const router = Router();
  router.use(createAuthenticationMiddleware(auth));
  router.post('/import-preview', createCsrfMiddleware(auth), async (req, res) => {
    const body = previewSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter a valid HTTPS fragrance product link.' } });
    const result = await service.preview(body.data.sourceUrl);
    return result.ok
      ? res.json({ success: true, data: result.value })
      : res.status(502).json({ success: false, error: { code: result.reason, message: 'The fragrance product page could not be imported.' } });
  });
  router.post('/:fragranceId/image/import-source', createCsrfMiddleware(auth), async (req, res) => {
    const params = fragranceIdParamsSchema.safeParse(req.params);
    const body = imageSchema.safeParse(req.body);
    if (!params.success || !body.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'The selected fragrance image is invalid.' } });
    const { user } = getAuthenticatedContext(res);
    const result = await service.importImage(user.id, params.data.fragranceId, body.data.imageUrl);
    return result.ok
      ? res.json({ success: true, data: result.value })
      : res.status(result.reason === 'NOT_FOUND' ? 404 : 422).json({ success: false, error: { code: result.reason, message: 'The fragrance product image could not be archived.' } });
  });
  return router;
}
