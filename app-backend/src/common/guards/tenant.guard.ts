import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { isGlobalAdmin } from '../constants/roles';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantIdFromParams = request.params.tenantId;

    // Global admin can access all tenants
    if (isGlobalAdmin(user)) {
      return true;
    }

    // For other users, check if tenant_id matches
    if (tenantIdFromParams && user.tenant_id !== tenantIdFromParams) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    // Add tenant_id to request for filtering queries
    request.tenantId = user.tenant_id;
    return true;
  }
}
