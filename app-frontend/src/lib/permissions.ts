/**
 * Permission helper functions
 * Mengatur akses CRUD berdasarkan user role
 */

export type UserRole = 'admin' | 'tenant_admin' | 'operator' | 'owner' | 'viewer'

export interface User {
  user_role: string
  user_level?: number
}

/**
 * Check if user can create/update/delete in Environment modules
 * Operator: hanya view (read-only)
 * Admin & Tenant Admin: full access
 */
export function canModifyEnvironment(user: User | null): boolean {
  if (!user) return false
  
  const role = user.user_role
  
  // Admin dan Tenant Admin bisa modify
  if (role === 'admin' || role === 'tenant_admin') {
    return true
  }
  
  // Operator hanya view (tidak bisa modify)
  if (role === 'operator') {
    return false
  }
  
  return false
}

/**
 * Check if user can view Environment modules
 */
export function canViewEnvironment(user: User | null): boolean {
  if (!user) return false
  
  const role = user.user_role
  
  // Admin, Tenant Admin, dan Operator bisa view
  return role === 'admin' || role === 'tenant_admin' || role === 'operator'
}

/**
 * Check if user has access to specific menu
 */
export function hasMenuAccess(user: User | null, allowedRoles: string[]): boolean {
  if (!user) return false
  return allowedRoles.includes(user.user_role)
}
