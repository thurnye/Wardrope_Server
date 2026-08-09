import type { Request, Response } from 'express';
import type { IHealthService } from '../../../Wardrope.Core/services/ServicesInterface/Health/health.service.interface';
import { BaseApiController } from '../BaseApiController/base.api-controller';

export class HealthController extends BaseApiController {
  constructor(private readonly healthService: IHealthService) {
    super();
  }

  getStatus = (_req: Request, res: Response) => {
    return this.okResponse(res, this.healthService.getStatus());
  };

  getReadiness = (_req: Request, res: Response) => {
    const readiness = this.healthService.getReadiness();

    if (!readiness.ready) {
      return this.errorResponse(
        res,
        503,
        'SERVICE_NOT_READY',
        'Wardrope dependencies are not ready.',
        readiness,
      );
    }

    return this.okResponse(res, readiness);
  };
}
