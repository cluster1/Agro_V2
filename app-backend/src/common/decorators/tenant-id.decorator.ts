import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { isGlobalAdmin } from '../constants/roles';
import { requestedTenant } from '../utils/resolve-tenant';

/** Tenant id for the request: the caller's own, or X-Tenant-Id for a global admin. */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return requestedTenant(req.user, req.headers) ?? req.user.tenant_id;
});

/** Tenant a global admin explicitly selected via X-Tenant-Id; undefined for no header or any other role. */
export const SelectedTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return isGlobalAdmin(req.user) ? requestedTenant(req.user, req.headers) : undefined;
});
