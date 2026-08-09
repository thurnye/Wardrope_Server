import type { Request, Response } from 'express';
import { env } from '../../config/env';

const DEVELOPMENT_COOKIE_NAME = 'wardrope_session';
const PRODUCTION_COOKIE_NAME = '__Host-wardrope_session';

export function getSessionCookieName(): string {
  return env.nodeEnv === 'production' ? PRODUCTION_COOKIE_NAME : DEVELOPMENT_COOKIE_NAME;
}

export function readSessionCookie(req: Request): string | undefined {
  const cookieHeader = req.header('cookie');

  if (!cookieHeader) {
    return undefined;
  }

  const cookieName = getSessionCookieName();

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

export function clearSessionCookie(res: Response): void {
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
