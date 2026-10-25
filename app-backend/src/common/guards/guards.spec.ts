import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { TenantGuard } from './tenant.guard';
import { Roles } from '../decorators/roles.decorator';

function ctx(user: any, params: Record<string, string> = {}, handler: Function = () => {}, cls: Function = class {}) {
  const request: any = { user, params };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext,
  };
}

function handlerRequiring(...roles: string[]) {
  class C {
    @Roles(...roles)
    method() {}
  }
  return { handler: C.prototype.method, cls: C };
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows when no @Roles metadata is present', () => {
    const { context } = ctx({ user_role: 'viewer', user_level: 2 });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows an exact role match', () => {
    const { handler, cls } = handlerRequiring('admin', 'tenant_admin');
    expect(guard.canActivate(ctx({ user_role: 'tenant_admin', user_level: 1 }, {}, handler, cls).context)).toBe(true);
  });

  it.each(['investor', 'viewer', 'operator', 'farmer'])('denies read-only role %s on a write route', (role) => {
    const { handler, cls } = handlerRequiring('admin', 'tenant_admin');
    expect(guard.canActivate(ctx({ user_role: role, user_level: 2 }, {}, handler, cls).context)).toBe(false);
  });

  it.each(['superadmin', 'not_admin', 'admin2', 'ADMIN', 'tenant_admin_x'])(
    'does not accept look-alike role "%s" (no substring matching)',
    (role) => {
      const { handler, cls } = handlerRequiring('admin');
      expect(guard.canActivate(ctx({ user_role: role, user_level: 2 }, {}, handler, cls).context)).toBe(false);
    },
  );

  it('denies when the user has no role at all', () => {
    const { handler, cls } = handlerRequiring('admin');
    expect(guard.canActivate(ctx({ user_level: 2 }, {}, handler, cls).context)).toBe(false);
  });

  it('lets a global admin (role admin AND level 0) through every role requirement', () => {
    const { handler, cls } = handlerRequiring('tenant_admin');
    expect(guard.canActivate(ctx({ user_role: 'admin', user_level: 0 }, {}, handler, cls).context)).toBe(true);
  });

  it('level 0 alone is not enough (no role admin)', () => {
    const { handler, cls } = handlerRequiring('tenant_admin');
    expect(guard.canActivate(ctx({ user_role: 'farmer', user_level: 0 }, {}, handler, cls).context)).toBe(false);
  });

  it('role admin alone is not enough: it does not satisfy @Roles("admin") below level 0', () => {
    const { handler, cls } = handlerRequiring('admin');
    expect(guard.canActivate(ctx({ user_role: 'admin', user_level: 2 }, {}, handler, cls).context)).toBe(false);
    expect(guard.canActivate(ctx({ user_role: 'admin', user_level: 1 }, {}, handler, cls).context)).toBe(false);
  });

  it('role admin without a level is not a global admin either', () => {
    const { handler, cls } = handlerRequiring('admin');
    expect(guard.canActivate(ctx({ user_role: 'admin' }, {}, handler, cls).context)).toBe(false);
  });
});

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  it('allows a user whose tenant matches the path', () => {
    const { context, request } = ctx({ tenant_id: 'T1', user_level: 1 }, { tenantId: 'T1' });
    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenantId).toBe('T1');
  });

  it('forbids a different tenant in the path', () => {
    const { context } = ctx({ tenant_id: 'T1', user_level: 1 }, { tenantId: 'T2' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lets a global admin access any tenant', () => {
    const { context } = ctx({ tenant_id: 'T0', user_role: 'admin', user_level: 0 }, { tenantId: 'T2' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('does not let level 0 without role admin cross tenants', () => {
    const { context } = ctx({ tenant_id: 'T0', user_role: 'farmer', user_level: 0 }, { tenantId: 'T2' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('does not let role admin below level 0 cross tenants', () => {
    const { context } = ctx({ tenant_id: 'T1', user_role: 'admin', user_level: 2 }, { tenantId: 'T2' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('passes routes without :tenantId (those rely on @TenantScope in the service)', () => {
    const { context } = ctx({ tenant_id: 'T1', user_level: 1 }, {});
    expect(guard.canActivate(context)).toBe(true);
  });
});
