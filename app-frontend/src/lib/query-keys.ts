/**
 * Single source of truth for React Query keys. Pages and the dialogs that mutate the same data
 * must use these helpers so invalidation can never drift (a mutation that invalidates a key the
 * list does not read leaves the list stale).
 *
 * Tip: after changing an entity, invalidate every list/detail that shows it, e.g. creating a
 * cluster must invalidate `queryKeys.sites(tenantId)` because the Sites page lists clusters.
 */
type Id = string | null | undefined

export const queryKeys = {
  tenants: ['tenants'] as const,
  users: (tenantId: Id) => ['users', tenantId] as const,
  sites: (tenantId: Id) => ['sites', tenantId] as const,
  site: (siteId: Id) => ['site', siteId] as const,
  clusters: (tenantId: Id) => ['clusters', tenantId] as const,
  devices: (tenantId: Id) => ['devices', tenantId] as const,
  device: (deviceId: Id) => ['device', deviceId] as const,
  sensors: (tenantId: Id) => ['sensors', tenantId] as const,
  plants: (tenantId: Id) => ['plants', tenantId] as const,
  schedules: (tenantId: Id) => ['schedules', tenantId] as const,
  activities: (tenantId: Id) => ['activities', tenantId] as const,
  observations: (tenantId: Id) => ['observations', tenantId] as const,
  /** Global reference data (not tenant scoped). */
  ref: (resource: string, ...filters: Id[]) => ['ref', resource, ...filters] as const,
}
