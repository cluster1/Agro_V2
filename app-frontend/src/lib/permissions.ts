/**
 * Permission helper functions
 * Mengatur akses CRUD berdasarkan user role
 */

export type UserRole = 'admin' | 'tenant_admin' | 'operator' | 'agronom'

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
  
  // Admin dan Tenant Admin (operator tidak melihat menu Environment, BRD-03)
  return role === 'admin' || role === 'tenant_admin'
}

/**
 * Check if user has access to specific menu
 */
export function hasMenuAccess(user: User | null, allowedRoles: string[]): boolean {
  if (!user) return false
  return allowedRoles.includes(user.user_role)
}

/**
 * Check if user can mark alerts as seen/resolved (PATCH /alerts/:id).
 * Admin, Tenant Admin dan Operator bisa; Agronom hanya melihat.
 */
export function canHandleAlerts(user: User | null): boolean {
  if (!user) return false
  return ['admin', 'tenant_admin', 'operator'].includes(user.user_role)
}

/**
 * Check if user can create/edit/close plants (Budidaya > Tanaman).
 * Admin dan Tenant Admin penuh; Operator dan Agronom hanya lihat (BRD matriks menu).
 */
export function canManagePlants(user: User | null): boolean {
  if (!user) return false
  return user.user_role === 'admin' || user.user_role === 'tenant_admin'
}

/**
 * Check if user can create/edit/cancel/delete schedules (Budidaya > Jadwal).
 * Admin, Tenant Admin dan Agronom penuh; Operator hanya lihat (BRD matriks menu).
 */
export function canManageSchedules(user: User | null): boolean {
  if (!user) return false
  return ['admin', 'tenant_admin', 'agronom'].includes(user.user_role)
}

/**
 * Check if user can record/edit/delete activities and upload field photos (Budidaya > Kegiatan).
 * Admin, Tenant Admin dan Operator; Agronom hanya lihat (BRD matriks menu).
 */
export function canRecordActivities(user: User | null): boolean {
  if (!user) return false
  return ['admin', 'tenant_admin', 'operator'].includes(user.user_role)
}

/**
 * Check if user can verify or reject saved observations (Budidaya > Observasi).
 * Agronom memverifikasi; Admin dan Tenant Admin penuh; Operator hanya input (BRD matriks menu).
 */
export function canVerifyObservations(user: User | null): boolean {
  if (!user) return false
  return ['admin', 'tenant_admin', 'agronom'].includes(user.user_role)
}
