import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { isGlobalAdmin } from '../constants/roles';
import { requestedTenant } from '../utils/resolve-tenant';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantIdFromParams = request.params.tenantId;

    // Global admin can access all tenants (optionally narrowed by X-Tenant-Id)
    if (isGlobalAdmin(user)) {
      request.tenantId = requestedTenant(user, request.headers) ?? tenantIdFromParams ?? user.tenant_id;
      return true;
    }

    // Legacy path param (still used by routes not yet migrated): must match the JWT tenant
    if (tenantIdFromParams && user.tenant_id !== tenantIdFromParams) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    // Tenant always comes from the JWT; X-Tenant-Id is ignored for non-admins
    request.tenantId = user.tenant_id;
    return true;
  }
}
