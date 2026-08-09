import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequestContext } from '../../Wardrope.Core/Models/Auth/auth.model';
import type { IAuthService } from '../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import type { ApiResponse } from '../models/api-response';
import { clearAuthCookies, readSessionCookie } from '../utils/auth-cookie';

export const AUTH_CONTEXT_LOCAL_KEY = 'authContext';

function unauthorized(res: Response): Response<ApiResponse<never>> {
  return res.status(401).json({
    success: false,
    error: {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required.',
    },
    meta: {
      requestId: String(res.locals.requestId || 'unknown'),
    },
  });
}

export function createAuthenticationMiddleware(authService: IAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionToken = readSessionCookie(req);
    const context = await authService.authenticate(sessionToken);

    if (!context) {
      if (sessionToken) {
        clearAuthCookies(res);
      }
      return unauthorized(res);
    }

    res.locals[AUTH_CONTEXT_LOCAL_KEY] = context;
    next();
  };
}

export function createCsrfMiddleware(authService: IAuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = res.locals[AUTH_CONTEXT_LOCAL_KEY] as AuthenticatedRequestContext | undefined;
    const csrfToken = req.header('x-csrf-token');

    if (!context || !authService.verifyCsrf(context, csrfToken)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'The request could not be verified.',
        },
        meta: {
          requestId: String(res.locals.requestId || 'unknown'),
        },
      } satisfies ApiResponse<never>);
    }

    next();
  };
}

export function getAuthenticatedContext(res: Response): AuthenticatedRequestContext {
  const context = res.locals[AUTH_CONTEXT_LOCAL_KEY] as AuthenticatedRequestContext | undefined;

  if (!context) {
    throw new Error('Authenticated request context was not initialized.');
  }

  return context;
}
