import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readdirSync } from 'fs';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../auth/guards/local-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ROLES_KEY } from './decorators/roles.decorator';

/**
 * Safety net for future changes: discovers EVERY controller under src/ and checks
 * that no route is exposed by accident. A new controller or handler that forgets a
 * guard fails here instead of shipping open.
 */

type Ctor = new (...args: any[]) => any;

function loadControllers(): Ctor[] {
  const srcDir = join(__dirname, '..');
  const found: Ctor[] = [];
  for (const dir of readdirSync(srcDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of readdirSync(join(srcDir, dir.name))) {
      if (!file.endsWith('.controller.ts')) continue;
      const mod = require(join(srcDir, dir.name, file));
      for (const exported of Object.values(mod)) {
        if (typeof exported === 'function' && Reflect.hasMetadata(PATH_METADATA, exported)) {
          found.push(exported as Ctor);
        }
      }
    }
  }
  return found;
}

const controllers = loadControllers();

interface Route {
  id: string;
  ctrl: Ctor;
  handler: Function;
  method: RequestMethod;
}

const routes: Route[] = controllers.flatMap((ctrl) =>
  Object.getOwnPropertyNames(ctrl.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: ctrl.prototype[name] as Function }))
    .filter(({ handler }) => typeof handler === 'function' && Reflect.hasMetadata(METHOD_METADATA, handler))
    .map(({ name, handler }) => ({
      id: `${ctrl.name}.${name}`,
      ctrl,
      handler,
      method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
    })),
);

const guardsOf = (r: Route): Function[] => [
  ...(Reflect.getMetadata(GUARDS_METADATA, r.ctrl) ?? []),
  ...(Reflect.getMetadata(GUARDS_METADATA, r.handler) ?? []),
];

const WRITE = [RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE];

// Routes that are intentionally reachable without a JWT (credential exchange).
const PUBLIC_ROUTES = new Set(['AuthController.login', 'AuthController.refresh', 'AuthController.logout']);

// Authenticated routes that are writes but intentionally open to every signed-in user.
const SELF_SERVICE_WRITES = new Set(['AuthController.changePassword']);

// Roles that may legitimately write where the BRD menu matrix says so; everyone else stays read-only.
const OPERATOR_WRITES = new Set([
  'AlertController.acknowledge', // field handling of alerts
  'MediaController.create', // field photos
  'ActivityController.create',
  'ActivityController.update',
  'ActivityController.remove',
  'ObservationController.create',
  'ObservationController.update',
  'ObservationController.remove',
  'HarvestController.create',
  'HarvestController.update',
  'HarvestController.remove',
]);
const AGRONOM_WRITES = new Set([
  'ScheduleController.create',
  'ScheduleController.update',
  'ScheduleController.remove',
  'ObservationController.verify', // agronom verifies observations
  'ObservationController.reject',
  // agronom edits Komoditas and Ambang; the service narrows this per resource
  'RefController.create',
  'RefController.update',
  'RefController.remove',
]);

describe('route protection (auto-discovered)', () => {
  it('discovers the application controllers', () => {
    // Guards against the discovery silently finding nothing and every test below passing vacuously.
    expect(controllers.length).toBeGreaterThanOrEqual(14);
    expect(routes.length).toBeGreaterThanOrEqual(60);
  });

  describe('authentication', () => {
    it.each(routes.filter((r) => !PUBLIC_ROUTES.has(r.id)).map((r) => [r.id, r] as const))(
      '%s requires a valid JWT',
      (_id, route) => {
        expect(guardsOf(route)).toContain(JwtAuthGuard);
      },
    );

    it('only the credential-exchange routes are public', () => {
      const publicRoutes = routes.filter((r) => !guardsOf(r).includes(JwtAuthGuard)).map((r) => r.id);
      expect(publicRoutes.sort()).toEqual([...PUBLIC_ROUTES].sort());
    });

    it('login is protected by the local (password) strategy', () => {
      const login = routes.find((r) => r.id === 'AuthController.login')!;
      expect(guardsOf(login)).toContain(LocalAuthGuard);
    });
  });

  describe('authorization of writes', () => {
    const writes = routes.filter((r) => WRITE.includes(r.method) && !PUBLIC_ROUTES.has(r.id) && !SELF_SERVICE_WRITES.has(r.id));

    it('discovers write routes', () => {
      expect(writes.length).toBeGreaterThanOrEqual(24);
    });

    it.each(writes.map((r) => [r.id, r] as const))('%s is role-guarded', (_id, route) => {
      expect(guardsOf(route)).toContain(RolesGuard);
      const roles: string[] | undefined =
        Reflect.getMetadata(ROLES_KEY, route.handler) ?? Reflect.getMetadata(ROLES_KEY, route.ctrl);
      expect(roles && roles.length).toBeGreaterThan(0);
    });

    it('no write route allows a read-only role', () => {
      for (const route of writes) {
        const roles: string[] = Reflect.getMetadata(ROLES_KEY, route.handler) ?? Reflect.getMetadata(ROLES_KEY, route.ctrl);
        const readOnlyRoles = ['agronom', 'operator'].filter(
          (r) => !(r === 'operator' && OPERATOR_WRITES.has(route.id)) && !(r === 'agronom' && AGRONOM_WRITES.has(route.id)),
        );
        for (const readOnly of readOnlyRoles) {
          expect({ route: route.id, allows: roles.includes(readOnly) }).toEqual({ route: route.id, allows: false });
        }
      }
    });
  });

  describe('tenant confinement', () => {
    // Tenant now comes from the JWT (X-Tenant-Id for global admins), never the path. Every route that
    // reads tenant data must therefore sit behind TenantGuard; only these are tenant-agnostic.
    const TENANT_AGNOSTIC = new Set(['AuthController', 'TenantController', 'UnitController', 'WeatherController', 'RefController']);
    const GLOBAL_ONLY = new Set(['ReportController.getGlobalDashboard']);
    const tenantRoutes = routes.filter((r) => !TENANT_AGNOSTIC.has(r.ctrl.name) && !GLOBAL_ONLY.has(r.id));

    it('discovers tenant-scoped routes', () => {
      expect(tenantRoutes.length).toBeGreaterThanOrEqual(40);
    });

    it('no route takes :tenantId from the path', () => {
      const withPath = routes.filter((r) => {
        const ctrlPath = String(Reflect.getMetadata(PATH_METADATA, r.ctrl) ?? '');
        const handlerPath = String(Reflect.getMetadata(PATH_METADATA, r.handler) ?? '');
        return `${ctrlPath}/${handlerPath}`.includes(':tenantId');
      });
      expect(withPath.map((r) => r.id)).toEqual([]);
    });

    it.each(tenantRoutes.map((r) => [r.id, r] as const))('%s is behind TenantGuard', (_id, route) => {
      const names = guardsOf(route).map((g) => g.name);
      expect(names).toContain('TenantGuard');
    });

    it('global-only routes are admin-guarded', () => {
      for (const r of routes.filter((x) => GLOBAL_ONLY.has(x.id))) {
        expect(guardsOf(r)).toContain(RolesGuard);
      }
    });
  });
});
