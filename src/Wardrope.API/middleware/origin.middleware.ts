import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import type { ApiResponse } from '../models/api-response';

const trustedOrigins = new Set(env.corsOrigins);

export function requireTrustedBrowserOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.header('origin');

  if (!origin || trustedOrigins.has(origin)) {
    next();
    return;
  }

  return res.status(403).json({
    success: false,
    error: {
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'The request origin is not allowed.',
    },
    meta: {
      requestId: String(res.locals.requestId || 'unknown'),
    },
  } satisfies ApiResponse<never>);
}
