import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GLOBAL_ADMIN_ROLE, isGlobalAdmin } from '../constants/roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (isGlobalAdmin(user)) {
      return true;
    }

    // The 'admin' role only counts together with level 0 (handled above).
    if (user.user_role === GLOBAL_ADMIN_ROLE) {
      return false;
    }

    return requiredRoles.includes(user.user_role);
  }
}
