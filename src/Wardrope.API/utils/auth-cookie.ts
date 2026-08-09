import type { Request, Response } from 'express';
import { env } from '../../config/env';

const DEVELOPMENT_SESSION_COOKIE = 'wardrope_session';
const PRODUCTION_SESSION_COOKIE = '__Host-wardrope_session';
const DEVELOPMENT_CSRF_COOKIE = 'wardrope_csrf';
const PRODUCTION_CSRF_COOKIE = '__Host-wardrope_csrf';

export function getSessionCookieName(): string {
  return env.nodeEnv === 'production' ? PRODUCTION_SESSION_COOKIE : DEVELOPMENT_SESSION_COOKIE;
}

export function getCsrfCookieName(): string {
  return env.nodeEnv === 'production' ? PRODUCTION_CSRF_COOKIE : DEVELOPMENT_CSRF_COOKIE;
}

function readNamedCookie(req: Request, cookieName: string): string | undefined {
  const cookieHeader = req.header('cookie');

  if (!cookieHeader) {
    return undefined;
  }

  for (const segment of cookieHeader.split(';')) {
    const separatorIndex = segment.indexOf('=');

    if (separatorIndex < 1) {
      continue;
    }

    const name = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();

    if (name !== cookieName || !value) {
      continue;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function readSessionCookie(req: Request): string | undefined {
  return readNamedCookie(req, getSessionCookieName());
}

export function readCsrfCookie(req: Request): string | undefined {
  return readNamedCookie(req, getCsrfCookieName());
}

export function setSessionCookie(
  res: Response,
  sessionToken: string,
  expiresAt: Date,
): void {
  res.cookie(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function setCsrfCookie(
  res: Response,
  csrfToken: string,
  expiresAt: Date,
): void {
  res.cookie(getCsrfCookieName(), csrfToken, {
    httpOnly: false,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearAuthCookies(res: Response): void {
  const commonOptions = {
    secure: env.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  res.clearCookie(getSessionCookieName(), {
    ...commonOptions,
    httpOnly: true,
  });
  res.clearCookie(getCsrfCookieName(), {
    ...commonOptions,
    httpOnly: false,
  });
}
