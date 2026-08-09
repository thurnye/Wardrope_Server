import express, { type Router } from 'express';
import { errorMiddleware, notFoundMiddleware } from '../middleware/error.middleware';
import { configureSecurityMiddleware } from '../middleware/security.middleware';

export function createApp(apiRouter: Router) {
  const app = express();

  configureSecurityMiddleware(app);
  app.use('/api/v1', apiRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
