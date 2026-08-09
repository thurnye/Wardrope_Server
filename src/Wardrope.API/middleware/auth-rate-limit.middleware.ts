import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import type { ApiResponse } from '../models/api-response';

function rateLimitHandler(_req: Request, res: Response): Response<ApiResponse<never>> {
  return res.status(429).json({
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Please try again later.',
    },
    meta: {
      requestId: String(res.locals.requestId || 'unknown'),
    },
  });
}

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: env.nodeEnv === 'test' ? 10_000 : 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: env.nodeEnv === 'test' ? 10_000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler,
});
