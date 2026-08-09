import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import type { ApiResponse } from '../models/api-response';

type HttpLikeError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

export function notFoundMiddleware(req: Request, res: Response): Response<ApiResponse<never>> {
  return res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No Wardrope endpoint exists for ${req.method} ${req.path}.`,
    },
    meta: {
      requestId: String(res.locals.requestId || 'unknown'),
    },
  });
}

export function errorMiddleware(
  error: HttpLikeError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response<ApiResponse<never>> {
  const candidateStatus = error.statusCode ?? error.status ?? 500;
  const statusCode = candidateStatus >= 400 && candidateStatus < 600 ? candidateStatus : 500;
  const requestId = String(res.locals.requestId || 'unknown');

  const diagnostic = {
    level: 'error',
    requestId,
    name: error.name,
    statusCode,
    ...(env.nodeEnv === 'development' ? { message: error.message } : {}),
  };
  console.error(JSON.stringify(diagnostic));

  const isPayloadTooLarge = statusCode === 413 || error.type === 'entity.too.large';
  const isClientError = statusCode >= 400 && statusCode < 500;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: isPayloadTooLarge
        ? 'PAYLOAD_TOO_LARGE'
        : isClientError
          ? 'INVALID_REQUEST'
          : 'INTERNAL_SERVER_ERROR',
      message: isPayloadTooLarge
        ? 'The request payload is too large.'
        : isClientError
          ? 'The request could not be processed.'
          : 'An unexpected server error occurred.',
    },
    meta: { requestId },
  });
}
