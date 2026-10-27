import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { isGlobalAdmin } from '../constants/roles';
import { requestedTenant } from '../utils/resolve-tenant';

/**
 * Resolves the tenant a request must be confined to, taken from the verified
 * JWT (never from path/body). A global admin is unrestricted (undefined) unless
 * they selected a tenant with X-Tenant-Id. Services add `tenant_id: scope` to
 * queries when set.
 */
export const TenantScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return isGlobalAdmin(req.user) ? requestedTenant(req.user, req.headers) : req.user.tenant_id;
  },
);
