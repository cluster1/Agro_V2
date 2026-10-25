import { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

const UNITS: Record<string, number> = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };

/** "7d" / "15m" / "3600" (seconds) -> milliseconds. */
export function durationToMs(value: string | undefined, fallbackMs = 7 * UNITS.d): number {
  const m = /^(\d+)\s*([smhd])?$/.exec((value ?? '').trim());
  if (!m) return fallbackMs;
  return Number(m[1]) * (m[2] ? UNITS[m[2]] : 1000);
}

const SAME_SITE_VALUES = ['strict', 'lax', 'none'] as const;

function resolveSameSite(): (typeof SAME_SITE_VALUES)[number] {
  const raw = (process.env.COOKIE_SAMESITE || 'strict').toLowerCase();
  return (SAME_SITE_VALUES as readonly string[]).includes(raw) ? (raw as (typeof SAME_SITE_VALUES)[number]) : 'strict';
}

function cookieOptions(maxAgeMs: number): CookieOptions {
  const sameSite = resolveSameSite();
  return {
    httpOnly: true,
    // SameSite=None is rejected by browsers unless Secure, so force it on in that case.
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    // Only sent to the auth endpoints, never with ordinary API calls.
    path: `/${process.env.API_PREFIX || 'api/v1'}/auth`,
    maxAge: maxAgeMs,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  const ms = durationToMs(process.env.JWT_REFRESH_EXPIRATION);
  res.cookie(REFRESH_COOKIE, token, cookieOptions(ms));
}

export function clearRefreshCookie(res: Response): void {
  const { maxAge, ...opts } = cookieOptions(0);
  res.clearCookie(REFRESH_COOKIE, opts);
}
