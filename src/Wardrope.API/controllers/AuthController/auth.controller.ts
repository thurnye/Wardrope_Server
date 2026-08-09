import type { Request, Response } from 'express';
import type { IAuthService } from '../../../Wardrope.Core/services/ServicesInterface/Auth/auth.service.interface';
import { BaseApiController } from '../BaseApiController/base.api-controller';
import { loginBodySchema, registerBodySchema } from '../../validation/auth.validation';
import {
  clearAuthCookies,
  readCsrfCookie,
  readSessionCookie,
  setCsrfCookie,
  setSessionCookie,
} from '../../utils/auth-cookie';
import { getAuthenticatedContext } from '../../middleware/authentication.middleware';

export class AuthController extends BaseApiController {
  constructor(private readonly authService: IAuthService) {
    super();
  }

  register = async (req: Request, res: Response) => {
    const parsed = registerBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please correct the highlighted account details.',
        {
          fields: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    await this.authService.register(parsed.data);

    return this.okResponse(
      res,
      {
        accepted: true as const,
        message: 'If these account details are eligible, you can continue by signing in.',
      },
      201,
    );
  };

  login = async (req: Request, res: Response) => {
    const parsed = loginBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return this.errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        'Please check your email and password.',
      );
    }

    const result = await this.authService.login(parsed.data);

    if (!result.ok) {
      return this.errorResponse(
        res,
        401,
        'INVALID_CREDENTIALS',
        'Email or password is incorrect.',
      );
    }

    setSessionCookie(res, result.value.sessionToken, result.value.expiresAt);
    setCsrfCookie(res, result.value.csrfToken, result.value.expiresAt);

    return this.okResponse(res, {
      authenticated: true as const,
      user: result.value.user,
      csrfToken: result.value.csrfToken,
      expiresAt: result.value.expiresAt.toISOString(),
    });
  };

  getSession = async (req: Request, res: Response) => {
    const sessionToken = readSessionCookie(req);
    const csrfCookie = readCsrfCookie(req);
    const session = await this.authService.getSession(sessionToken, csrfCookie);

    if (!session.authenticated) {
      if (sessionToken || csrfCookie) {
        clearAuthCookies(res);
      }
      return this.okResponse(res, session);
    }

    if (csrfCookie !== session.csrfToken) {
      setCsrfCookie(res, session.csrfToken, new Date(session.expiresAt));
    }

    return this.okResponse(res, session);
  };

  logout = async (_req: Request, res: Response) => {
    const context = getAuthenticatedContext(res);
    await this.authService.logout(context.sessionId);
    clearAuthCookies(res);

    return this.okResponse(res, { loggedOut: true as const });
  };
}
