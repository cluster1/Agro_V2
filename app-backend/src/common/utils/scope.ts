/**
 * Confines a TypeORM `where` object to the caller's tenant. `scope` comes from
 * @TenantScope(): a tenant id for regular users, undefined for global admins.
 * Scope is applied last so a tenant_id already present in `where` cannot widen it.
 */
export const scoped = <T extends object>(where: T, scope: string | undefined): T & { tenant_id?: string } =>
  scope ? { ...where, tenant_id: scope } : where;
