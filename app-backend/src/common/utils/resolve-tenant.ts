import { BadRequestException } from '@nestjs/common';
import { isGlobalAdmin } from '../constants/roles';

export const TENANT_HEADER = 'x-tenant-id';
const TENANT_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Tenant a request is confined to. Taken from the verified JWT; only a global
 * admin may pick another tenant through the X-Tenant-Id header (everyone else's
 * header is ignored). Returns undefined for an admin who sent no header.
 */
export function requestedTenant(
  user: { tenant_id?: string; user_level?: number; user_role?: string } | undefined,
  headers: Record<string, unknown> | undefined,
): string | undefined {
  if (!isGlobalAdmin(user)) return user?.tenant_id;
  const raw = headers?.[TENANT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !TENANT_ID_RE.test(value)) {
    throw new BadRequestException('X-Tenant-Id is not a valid tenant id');
  }
  return value;
}
