export const USER_ROLES = [
  'admin',
  'tenant_admin',
  'farmer',
  'investor',
  'viewer',
  'operator',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const GLOBAL_ADMIN_LEVEL = 0;
export const GLOBAL_ADMIN_ROLE: UserRole = 'admin';

export const BCRYPT_COST = 12;

/**
 * The single definition of "global admin": level 0 AND role admin.
 * Either alone grants nothing, so a malformed account (role=admin at level 2,
 * or level 0 with another role) can never be mistaken for one.
 */
export const isGlobalAdmin = (u?: { user_level?: number; user_role?: string } | null): boolean =>
  u?.user_level === GLOBAL_ADMIN_LEVEL && u?.user_role === GLOBAL_ADMIN_ROLE;
