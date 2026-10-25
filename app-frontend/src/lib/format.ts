import { format as formatDate } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

/** Indonesian number formatting (1.234,56). Returns '-' for null/undefined/NaN. */
export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, ...options }).format(value)
}

/** Indonesian date/time, e.g. "24 Okt 2026 20.15". Returns '-' for missing or invalid input. */
export function formatDateTime(value: string | number | Date | null | undefined, pattern = 'dd MMM yyyy HH:mm'): string {
  if (value === null || value === undefined || value === '') return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return formatDate(date, pattern, { locale: idLocale })
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator Global',
  tenant_admin: 'Admin Tenant',
  operator: 'Operator',
  farmer: 'Petani',
  investor: 'Investor',
  viewer: 'Pengamat',
}

/** Human label for a user_role value (falls back to the raw value). */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return '-'
  return ROLE_LABELS[role] ?? role
}
