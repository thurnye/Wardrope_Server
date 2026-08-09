import { Router } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type {
  IOutfitService,
  IWearHistoryService,
} from '../../../Wardrope.Core/services/ServicesInterface/Outfit/outfit.service.interface';
import {
  OutfitController,
  WearHistoryController,
} from '../../controllers/OutfitController/outfit.controller';
import {
  createAuthenticationMiddleware,
  createCsrfMiddleware,
} from '../../middleware/authentication.middleware';

export function createOutfitRoutes(
  outfitService: IOutfitService,
  wearHistoryService: IWearHistoryService,
  authService: IAuthService,
): Router {
  const router = Router();
  const outfits = new OutfitController(outfitService);
  const history = new WearHistoryController(wearHistoryService);
  const authenticate = createAuthenticationMiddleware(authService);
  const requireCsrf = createCsrfMiddleware(authService);

  router.use(authenticate);

  router.get('/', outfits.list);
  router.post('/', requireCsrf, outfits.create);
  router.get('/wear-history', history.list);
  router.post('/wear-history', requireCsrf, history.create);
  router.get('/wear-history/:historyId', history.getById);
  router.patch('/wear-history/:historyId', requireCsrf, history.update);
  router.delete('/wear-history/:historyId', requireCsrf, history.delete);
  router.get('/:outfitId', outfits.getById);
  router.patch('/:outfitId', requireCsrf, outfits.update);
  router.delete('/:outfitId', requireCsrf, outfits.delete);

  return router;
}
