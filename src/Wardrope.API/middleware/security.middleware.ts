import { randomUUID } from 'node:crypto';
import cors from 'cors';
import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../../config/env';
import { requireTrustedBrowserOrigin } from './origin.middleware';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function configureSecurityMiddleware(app: Express): void {
  app.disable('x-powered-by');

  if (env.trustProxyHops > 0) {
    app.set('trust proxy', env.trustProxyHops);
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingRequestId = req.header('x-request-id');
    const requestId = incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  const allowedOrigins = new Set(env.corsOrigins);
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token'],
      exposedHeaders: ['X-Request-Id', 'RateLimit'],
      maxAge: 600,
    }),
  );

  app.use(requireTrustedBrowserOrigin);

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1_000,
      limit: env.nodeEnv === 'test' ? 10_000 : 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => req.path.startsWith('/api/v1/health'),
    }),
  );

  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '256kb', parameterLimit: 100 }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}
