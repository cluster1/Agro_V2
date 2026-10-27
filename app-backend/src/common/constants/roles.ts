export const USER_ROLES = ['admin', 'tenant_admin', 'operator', 'agronom'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const GLOBAL_ADMIN_LEVEL = 0;
export const GLOBAL_ADMIN_ROLE: UserRole = 'admin';

/** Roles a tenant_admin may never mint or grant (FSD F-USER-01). */
export const TENANT_ADMIN_FORBIDDEN_ROLES: readonly string[] = ['admin', 'tenant_admin', 'agronom'];

export const BCRYPT_COST = 12;

/**
 * The single definition of "global admin": level 0 AND role admin.
 * Either alone grants nothing, so a malformed account (role=admin at level 2,
 * or level 0 with another role) can never be mistaken for one.
 */
export const isGlobalAdmin = (u?: { user_level?: number; user_role?: string } | null): boolean =>
  u?.user_level === GLOBAL_ADMIN_LEVEL && u?.user_role === GLOBAL_ADMIN_ROLE;
