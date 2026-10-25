import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { isGlobalAdmin } from '../constants/roles';

/**
 * Resolves the tenant a request must be confined to, taken from the verified
 * JWT (never from path/body). Returns undefined for global admins, meaning
 * "no tenant restriction". Services add `tenant_id: scope` to queries when set.
 */
export const TenantScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const user = ctx.switchToHttp().getRequest().user;
    return isGlobalAdmin(user) ? undefined : user.tenant_id;
  },
);
