import type { Response } from 'express';
import type { ApiResponse } from '../../models/api-response';

export abstract class BaseApiController {
  protected okResponse<T>(res: Response, data: T, statusCode = 200): Response<ApiResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      data,
      meta: {
        requestId: String(res.locals.requestId || 'unknown'),
      },
    });
  }

  protected errorResponse<T = never>(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    data?: T,
  ): Response<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: false,
      error: { code, message },
      meta: {
        requestId: String(res.locals.requestId || 'unknown'),
      },
      ...(data === undefined ? {} : { data }),
    };

    return res.status(statusCode).json(response);
  }
}
