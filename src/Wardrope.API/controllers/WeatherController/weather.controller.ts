import type { Request, Response } from 'express';
import type { ZodError } from 'zod';
import type { IWeatherService } from '../../../Wardrope.Core/services/ServicesInterface/Weather/weather.service.interface';
import { weatherContextQuerySchema } from '../../validation/weather.validation';
import { BaseApiController } from '../BaseApiController/base.api-controller';

function validationFields(error: ZodError) {
  return {
    fields: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export class WeatherController extends BaseApiController {
  constructor(private readonly weatherService: IWeatherService) {
    super();
  }

  context = async (req: Request, res: Response) => {
    const parsed = weatherContextQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please provide a valid location for weather context.',
        validationFields(parsed.error),
      );
    }

    const result = await this.weatherService.getContext(parsed.data);
    if (!result.ok) {
      return this.errorResponse(
        res,
        503,
        'WEATHER_UNAVAILABLE',
        'Weather context is temporarily unavailable. Please try again.',
      );
    }

    return this.okResponse(res, result.context);
  };
}
