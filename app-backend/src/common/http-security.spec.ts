import { INestApplication, UnauthorizedException, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { RefreshRaceException } from '../auth/refresh-race.exception';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { LocalStrategy } from '../auth/strategies/local.strategy';
import { ClusterController } from '../cluster/cluster.controller';
import { ClusterService } from '../cluster/cluster.service';
import { TenantController } from '../tenant/tenant.controller';
import { TenantService } from '../tenant/tenant.service';
import { UserController } from '../user/user.controller';
import { UserService } from '../user/user.service';
import { configureApp } from '../app.setup';
import {
  ACCESS_SECRET,
  REFRESH_SECRET,
  bearer,
  personas,
  signAccessToken,
} from '../test-utils/fakes';

const mocks = () => ({
  cluster: {
    create: jest.fn().mockResolvedValue({ cluster_id: 'C-new' }),
    findAll: jest.fn().mockResolvedValue([]),
    findAllByTenant: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ cluster_id: 'C1' }),
    update: jest.fn().mockResolvedValue({ cluster_id: 'C1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  tenant: {
    create: jest.fn().mockResolvedValue({ tenant_id: 'T-new' }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ tenant_id: 'T1' }),
    update: jest.fn(),
    remove: jest.fn(),
  },
  user: {
    create: jest.fn().mockResolvedValue({ user_id: 'u-new' }),
    findAll: jest.fn().mockResolvedValue([]),
    findAllGlobal: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ user_id: 'u1' }),
    update: jest.fn().mockResolvedValue({ user_id: 'u1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  auth: {
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn(),
  },
});

async function buildApp(m = mocks()) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ JWT_SECRET: ACCESS_SECRET })],
      }),
      PassportModule,
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    ],
    controllers: [AuthController, ClusterController, TenantController, UserController],
    providers: [
      JwtStrategy,
      LocalStrategy,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: AuthService, useValue: m.auth },
      { provide: ClusterService, useValue: m.cluster },
      { provide: TenantService, useValue: m.tenant },
      { provide: UserService, useValue: m.user },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app); // the exact pipeline main.ts uses: helmet, cookies, filter, validation, /api/v1 prefix
  await app.init();
  return { app, m };
}

// supertest client that targets the real, prefixed routes
const PREFIX = '/api/v1';
const http = (app: INestApplication) => {
  const s = request(app.getHttpServer());
  return {
    get: (p: string) => s.get(PREFIX + p),
    post: (p: string) => s.post(PREFIX + p),
    patch: (p: string) => s.patch(PREFIX + p),
    delete: (p: string) => s.delete(PREFIX + p),
  };
};

describe('HTTP security', () => {
  describe('authentication (JWT)', () => {
    let app: INestApplication;
    beforeAll(async () => {
      ({ app } = await buildApp());
    });
    afterAll(() => app.close());

    const get = (headers: Record<string, string> = {}) => http(app).get('/clusters/C1').set(headers);

    it('401 without a token', async () => {
      await get().expect(401);
    });

    it.each(['', 'Bearer', 'Bearer ', 'Bearer not.a.jwt', 'Basic abc', 'Bearer null'])(
      '401 for malformed Authorization header %p',
      async (h) => {
        await get({ Authorization: h }).expect(401);
      },
    );

    it('401 for a token signed with a different secret', async () => {
      const forged = new JwtService({ secret: 'attacker-secret-attacker-secret-attacker' }).sign({
        sub: 'x', tenant_id: 'T1', user_role: 'admin', user_level: 0,
      });
      await get(bearer(forged)).expect(401);
    });

    it('401 for an expired token', async () => {
      await get(bearer(signAccessToken({}, { expiresIn: '-10s' }))).expect(401);
    });

    it('401 for an unsigned (alg=none) token claiming to be a global admin', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'x', tenant_id: 'T1', user_role: 'admin', user_level: 0 })}.`;
      await get(bearer(none)).expect(401);
    });

    it('401 for a refresh-secret token presented as an access token', async () => {
      const t = new JwtService({ secret: REFRESH_SECRET }).sign({ sub: 'x', tenant_id: 'T1', user_role: 'admin', user_level: 0 });
      await get(bearer(t)).expect(401);
    });

    it('401 for a token whose payload was tampered after signing', async () => {
      const [h, , s] = personas.agronomT1().split('.');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'inv1', tenant_id: 'T1', user_role: 'admin', user_level: 0, exp: 9999999999 }),
      ).toString('base64url');
      await get(bearer(`${h}.${payload}.${s}`)).expect(401);
    });

    it('200 for a valid token', async () => {
      await get(bearer(personas.tenantAdminT1())).expect(200);
    });
  });

  describe('role enforcement (RBAC)', () => {
    let app: INestApplication;
    let m: ReturnType<typeof mocks>;
    beforeEach(async () => {
      ({ app, m } = await buildApp());
    });
    afterEach(() => app.close());

    const srv = () => http(app);

    describe.each(['agronomT1', 'operatorT1'] as const)('read-only persona %s', (who) => {
      it.each([
        ['POST', '/clusters', { site_id: 'S1', cluster_name: 'x' }],
        ['PATCH', '/clusters/C1', { cluster_name: 'x' }],
        ['DELETE', '/clusters/C1', undefined],
        ['POST', '/users', undefined],
        ['PATCH', '/users/u1', { user_name: 'x' }],
        ['DELETE', '/users/u1', undefined],
        ['PATCH', '/tenants/T1', { tenant_name: 'x' }],
        ['DELETE', '/tenants/T1', undefined],
        ['POST', '/tenants', undefined],
      ])('%s %s -> 403', async (method, path, body) => {
        const req = (srv() as any)[method.toLowerCase()](path).set(bearer(personas[who]()));
        await (body ? req.send(body) : req).expect(403);
        expect(m.cluster.create).not.toHaveBeenCalled();
        expect(m.cluster.update).not.toHaveBeenCalled();
        expect(m.cluster.remove).not.toHaveBeenCalled();
        expect(m.user.create).not.toHaveBeenCalled();
        expect(m.user.remove).not.toHaveBeenCalled();
        expect(m.tenant.create).not.toHaveBeenCalled();
      });

      it('can still read their own tenant', async () => {
        await srv().get('/clusters').set(bearer(personas[who]())).expect(200);
      });
    });

    it('a look-alike role such as "tenant_admin_x" cannot write', async () => {
      const t = signAccessToken({ user_role: 'tenant_admin_x', user_level: 2 });
      await srv().patch('/clusters/C1').set(bearer(t)).send({ cluster_name: 'x' }).expect(403);
      expect(m.cluster.update).not.toHaveBeenCalled();
    });

    it('tenant admin may write clusters', async () => {
      await srv().patch('/clusters/C1').set(bearer(personas.tenantAdminT1())).send({ cluster_name: 'x' }).expect(200);
      await srv().delete('/clusters/C1').set(bearer(personas.tenantAdminT1())).expect(200);
    });

    it('GET /users lists the caller tenant; only a global admin without X-Tenant-Id gets the global list', async () => {
      await srv().get('/users').set(bearer(personas.tenantAdminT1())).expect(200);
      expect(m.user.findAll).toHaveBeenCalledWith('T1');
      expect(m.user.findAllGlobal).not.toHaveBeenCalled();

      await srv().get('/users').set(bearer(personas.globalAdmin())).expect(200);
      expect(m.user.findAllGlobal).toHaveBeenCalledTimes(1);

      await srv().get('/users').set({ ...bearer(personas.globalAdmin()), 'x-tenant-id': 'T2' }).expect(200);
      expect(m.user.findAll).toHaveBeenLastCalledWith('T2');
    });

    it('GET /tenants (all tenants) is admin-only', async () => {
      await srv().get('/tenants').set(bearer(personas.tenantAdminT1())).expect(403);
      await srv().get('/tenants').set(bearer(personas.globalAdmin())).expect(200);
    });

    describe.each([
      ['role admin at level 2', { user_role: 'admin', user_level: 2 }],
      ['role admin at level 1', { user_role: 'admin', user_level: 1 }],
      ['level 0 with a non-admin role', { user_role: 'operator', user_level: 0 }],
    ])('half-admin: %s', (_n, claims) => {
      const token = () => signAccessToken({ tenant_id: 'T1', ...claims });

      it('gets no global-admin endpoints', async () => {
        await srv().get('/users').set({ ...bearer(token()), 'x-tenant-id': 'T2' }).expect(200);
        expect(m.user.findAllGlobal).not.toHaveBeenCalled();
        await srv().get('/tenants').set(bearer(token())).expect(403);
        await srv().post('/tenants').set(bearer(token())).send({ tenant_name: 'x' }).expect(403);
      });

      it('stays confined to its own tenant', async () => {
        await srv().get('/clusters').set({ ...bearer(token()), 'x-tenant-id': 'T2' }).expect(200);
        expect(m.cluster.findAllByTenant).toHaveBeenLastCalledWith('T1');
        await srv().get('/tenants/T2').set(bearer(token())).expect(403);
        await srv().get('/clusters/C9').set(bearer(token())).expect(200);
        expect(m.cluster.findOne).toHaveBeenCalledWith('C9', undefined, 'T1'); // scoped, not unrestricted
      });
    });
  });

  describe('tenant isolation at the HTTP layer', () => {
    let app: INestApplication;
    let m: ReturnType<typeof mocks>;
    beforeEach(async () => {
      ({ app, m } = await buildApp());
    });
    afterEach(() => app.close());
    const srv = () => http(app);

    it.each([
      ['GET', '/clusters'],
      ['GET', '/sites/S2/clusters'],
      ['POST', '/clusters'],
      ['GET', '/users'],
      ['POST', '/users'],
    ])('tenant admin of T1: %s %s ignores X-Tenant-Id and the legacy tenant path', async (method, path) => {
      const body = { site_id: 'S1', cluster_name: 'x', user_name: 'n', user_email: 'n@x.io', user_pass: 'a-long-enough-pass', user_role: 'operator' };
      await (srv() as any)[method.toLowerCase()](path)
        .set({ ...bearer(personas.tenantAdminT1()), 'x-tenant-id': 'T2' })
        .send(body);
      for (const fn of [m.cluster.findAllByTenant, m.user.findAll]) {
        for (const call of fn.mock.calls) expect(call[0]).toBe('T1');
      }
      for (const call of m.cluster.create.mock.calls) expect(call[0]).toBe('T1');
      for (const call of m.user.create.mock.calls) expect(call[1]).toBe('T1');
    });

    it('tenant paths no longer exist', async () => {
      await srv().get('/tenants/T2/clusters').set(bearer(personas.tenantAdminT1())).expect(404);
      await srv().get('/tenants/T2/users').set(bearer(personas.globalAdmin())).expect(404);
    });

    describe('global admin tenant selection', () => {
      it('honors X-Tenant-Id', async () => {
        await srv().get('/clusters').set({ ...bearer(personas.globalAdmin()), 'x-tenant-id': 'T2' }).expect(200);
        expect(m.cluster.findAllByTenant).toHaveBeenCalledWith('T2');
      });

      it.each(['T2;DROP', 'a b', 'x'.repeat(40)])('400 for malformed X-Tenant-Id %p', async (h) => {
        await srv().get('/clusters').set({ ...bearer(personas.globalAdmin()), 'x-tenant-id': h }).expect(400);
      });

      it("falls back to the admin's own tenant without the header", async () => {
        await srv().get('/clusters').set(bearer(personas.globalAdmin())).expect(200);
        expect(m.cluster.findAllByTenant).toHaveBeenCalledWith(expect.any(String));
      });
    });

    it('GET /tenants/:id is limited to the caller’s own tenant', async () => {
      await srv().get('/tenants/T2').set(bearer(personas.tenantAdminT1())).expect(403);
      await srv().get('/tenants/T1').set(bearer(personas.tenantAdminT1())).expect(200);
      await srv().get('/tenants/T2').set(bearer(personas.globalAdmin())).expect(200);
      expect(m.tenant.findOne).toHaveBeenCalledTimes(2);
    });

    describe('routes without :tenantId rely on the scope taken from the JWT', () => {
      it('passes the caller’s tenant to the service', async () => {
        await srv().get('/clusters/C2').set(bearer(personas.tenantAdminT1())).expect(200);
        expect(m.cluster.findOne).toHaveBeenCalledWith('C2', undefined, 'T1');
      });

      it('passes undefined for a global admin (unrestricted)', async () => {
        await srv().get('/clusters/C2').set(bearer(personas.globalAdmin())).expect(200);
        expect(m.cluster.findOne).toHaveBeenCalledWith('C2', undefined, undefined);
      });

      it('cannot be overridden with query, body or header values', async () => {
        await srv()
          .patch('/clusters/C2?tenant_id=T2&scope=T2')
          .set({ ...bearer(personas.tenantAdminT1()), 'x-tenant-id': 'T2' })
          .send({ cluster_name: 'x' })
          .expect(200);
        expect(m.cluster.update).toHaveBeenCalledWith('C2', { cluster_name: 'x' }, 'T1');

        await srv()
          .patch('/clusters/C2')
          .set(bearer(personas.tenantAdminT1()))
          .send({ cluster_name: 'x', tenant_id: 'T2' })
          .expect(400); // forbidNonWhitelisted: tenant_id is not an accepted field
      });

      it('delete is scoped too', async () => {
        await srv().delete('/clusters/C2').set(bearer(personas.tenantAdminT2())).expect(200);
        expect(m.cluster.remove).toHaveBeenCalledWith('C2', 'T2');
      });
    });
  });

  describe('tenant & user creation', () => {
    let app: INestApplication;
    let m: ReturnType<typeof mocks>;
    beforeEach(async () => {
      ({ app, m } = await buildApp());
    });
    afterEach(() => app.close());
    const srv = () => http(app);

    it('POST /tenants requires authentication', async () => {
      await srv().post('/tenants').send({ tenant_name: 'Evil Co' }).expect(401);
      expect(m.tenant.create).not.toHaveBeenCalled();
    });

    it('POST /tenants/upload-logo requires authentication', async () => {
      await srv().post('/tenants/upload-logo').expect(401);
    });

    it('POST /tenants is global-admin only', async () => {
      await srv().post('/tenants').set(bearer(personas.tenantAdminT1())).send({ tenant_name: 'x' }).expect(403);
      await srv().post('/tenants').set(bearer(personas.globalAdmin())).send({ tenant_name: 'Acme' }).expect(201);
      expect(m.tenant.create).toHaveBeenCalledTimes(1);
    });

    const validUser = { user_name: 'Nu', user_email: 'nu@x.io', user_pass: 'a-long-enough-pass', user_role: 'operator' };
    const post = (body: object, token = personas.tenantAdminT1()) =>
      srv().post('/users').set(bearer(token)).send(body);

    it('creates a valid user and hands the JWT identity to the service as caller', async () => {
      await post(validUser).expect(201);
      const [caller, tenantId, dto] = m.user.create.mock.calls[0];
      expect(caller).toMatchObject({ user_id: 'ta1', tenant_id: 'T1', user_role: 'tenant_admin', user_level: 1 });
      expect(tenantId).toBe('T1');
      expect(dto).toMatchObject(validUser);
    });

    it.each([
      ['unknown role', { user_role: 'superadmin' }],
      ['role with different case', { user_role: 'ADMIN' }],
      ['level above range', { user_level: 5 }],
      ['negative level', { user_level: -1 }],
      ['fractional level', { user_level: 1.5 }],
      ['password under 10 chars', { user_pass: 'short-pw9' }],
      ['password over 72 chars', { user_pass: 'x'.repeat(73) }],
      ['bad email', { user_email: 'not-an-email' }],
      ['unknown field', { is_superuser: true }],
      ['smuggled tenant_id', { tenant_id: 'T2' }],
    ])('400 for %s', async (_n, patch) => {
      await post({ ...validUser, ...patch }).expect(400);
      expect(m.user.create).not.toHaveBeenCalled();
    });

    it('passes user_level 0 to the service (which, not the DTO, decides who may grant it)', async () => {
      await post({ ...validUser, user_level: 0 }).expect(201);
      expect(m.user.create.mock.calls[0][2].user_level).toBe(0);
    });

    it('update DTO enforces the same password and role rules', async () => {
      const patch = (body: object) =>
        srv().patch('/users/u1').set(bearer(personas.tenantAdminT1())).send(body);
      await patch({ user_pass: 'short' }).expect(400);
      await patch({ user_role: 'root' }).expect(400);
      await patch({ user_pass: 'a-long-enough-pass' }).expect(200);
    });
  });

  describe('auth endpoints: refresh cookie and rate limiting', () => {
    const user = { user_id: 'u1', user_email: 'u@x.io', tenant_id: 'T1' };
    const setCookie = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const refreshCookie = (res: request.Response) => setCookie(res).find((c) => c.startsWith('refresh_token='));

    let app: INestApplication;
    let m: ReturnType<typeof mocks>;
    beforeEach(async () => {
      ({ app, m } = await buildApp());
    });
    afterEach(() => app.close());
    const srv = () => http(app);

    it('login: refresh token goes into an httpOnly, SameSite=Strict cookie and never into the body', async () => {
      m.auth.validateUser.mockResolvedValue(user);
      m.auth.login.mockResolvedValue({ accessToken: 'ACCESS', refreshToken: 'REFRESH-SECRET-VALUE', user });

      const res = await srv().post('/auth/login').send({ email: 'u@x.io', password: 'pw' }).expect(200);

      expect(res.body).toEqual({ accessToken: 'ACCESS', user });
      expect(JSON.stringify(res.body)).not.toContain('REFRESH-SECRET-VALUE');
      const cookie = refreshCookie(res)!;
      expect(cookie).toContain('refresh_token=REFRESH-SECRET-VALUE');
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('login: bad credentials -> 401 and no cookie', async () => {
      m.auth.validateUser.mockResolvedValue(null);
      const res = await srv().post('/auth/login').send({ email: 'u@x.io', password: 'bad' }).expect(401);
      expect(refreshCookie(res)).toBeUndefined();
      expect(m.auth.login).not.toHaveBeenCalled();
    });

    it('login: missing credentials are rejected (401) without touching the user store', async () => {
      // passport-local runs before the ValidationPipe and refuses empty fields itself
      await srv().post('/auth/login').send({ email: 'u@x.io', password: '' }).expect(401);
      await srv().post('/auth/login').send({}).expect(401);
      expect(m.auth.validateUser).not.toHaveBeenCalled();
    });

    it('refresh: reads the cookie, rotates it, and returns only the access token', async () => {
      m.auth.refreshToken.mockResolvedValue({ accessToken: 'NEW-ACCESS', refreshToken: 'NEW-REFRESH' });

      const res = await srv().post('/auth/refresh').set('Cookie', 'refresh_token=OLD-REFRESH').expect(200);

      expect(m.auth.refreshToken).toHaveBeenCalledWith('OLD-REFRESH');
      expect(res.body).toEqual({ accessToken: 'NEW-ACCESS' });
      expect(refreshCookie(res)).toContain('refresh_token=NEW-REFRESH');
    });

    it('refresh: ignores a token supplied in the body or Authorization header', async () => {
      m.auth.refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));
      await srv()
        .post('/auth/refresh')
        .set('Authorization', 'Bearer SOMETHING')
        .send({ refreshToken: 'BODY-TOKEN' })
        .expect(401);
      expect(m.auth.refreshToken).toHaveBeenCalledWith(undefined);
    });

    it('refresh: a rejected token -> 401 and the cookie is cleared', async () => {
      m.auth.refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));
      const res = await srv().post('/auth/refresh').set('Cookie', 'refresh_token=STOLEN').expect(401);
      const cleared = refreshCookie(res)!;
      expect(cleared).toMatch(/refresh_token=;/);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('refresh: a transient server error does not clear the cookie (no accidental logout)', async () => {
      m.auth.refreshToken.mockRejectedValue(new InternalServerErrorException());
      const res = await srv().post('/auth/refresh').set('Cookie', 'refresh_token=VALID').expect(500);
      expect(refreshCookie(res)).toBeUndefined();
    });

    it('refresh: a benign race is a 401 that leaves the (freshly rotated) cookie alone', async () => {
      m.auth.refreshToken.mockRejectedValue(new RefreshRaceException());
      const res = await srv().post('/auth/refresh').set('Cookie', 'refresh_token=JUST-ROTATED').expect(401);
      expect(refreshCookie(res)).toBeUndefined();
    });

    it('logout: revokes the cookie’s token server-side and clears the cookie', async () => {
      const res = await srv().post('/auth/logout').set('Cookie', 'refresh_token=MINE').expect(200);
      expect(m.auth.logout).toHaveBeenCalledWith('MINE');
      expect(refreshCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('login is rate limited: the 6th attempt within a minute is rejected with 429', async () => {
      m.auth.validateUser.mockResolvedValue(null);
      const attempt = () => srv().post('/auth/login').send({ email: 'u@x.io', password: 'guess' });
      for (let i = 0; i < 5; i++) await attempt().expect(401);
      await attempt().expect(429);
      expect(m.auth.validateUser).toHaveBeenCalledTimes(5);
    });

    it('refresh is rate limited too (10/min)', async () => {
      m.auth.refreshToken.mockRejectedValue(new UnauthorizedException());
      for (let i = 0; i < 10; i++) await srv().post('/auth/refresh').expect(401);
      await srv().post('/auth/refresh').expect(429);
    });
  });

  describe('error hygiene', () => {
    const env = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = env;
    });

    it.each(['production', 'development'])('does not leak internal error details (%s)', async (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;
      const m = mocks();
      m.cluster.findOne.mockRejectedValue(
        Object.assign(new Error("Table 'agro_db.tm_cluster' doesn't exist (SELECT secret FROM x)"), { code: 'ER_NO_SUCH_TABLE' }),
      );
      const { app } = await buildApp(m);
      const res = await http(app).get('/clusters/C1').set(bearer(personas.tenantAdminT1())).expect(500);
      expect(JSON.stringify(res.body)).not.toMatch(/agro_db|tm_cluster|SELECT|ER_NO_SUCH_TABLE/);
      expect(res.body).toEqual({ code: 'INTERNAL_ERROR', message: expect.any(String) });
      await app.close();
    });
  });

  describe('uniform error format {code, message, fields}', () => {
    let app: INestApplication;
    let m: ReturnType<typeof mocks>;
    beforeEach(async () => {
      ({ app, m } = await buildApp());
    });
    afterEach(() => app.close());
    const srv = () => http(app);

    it('401 -> UNAUTHENTICATED', async () => {
      const res = await srv().get('/clusters').expect(401);
      expect(res.body).toEqual({ code: 'UNAUTHENTICATED', message: expect.any(String) });
    });

    it('403 -> FORBIDDEN', async () => {
      const res = await srv().patch('/clusters/C1').set(bearer(personas.agronomT1())).send({ cluster_name: 'x' }).expect(403);
      expect(res.body).toEqual({ code: 'FORBIDDEN', message: expect.any(String) });
    });

    it('404 -> NOT_FOUND, without echoing the service message', async () => {
      m.cluster.findOne.mockRejectedValue(new NotFoundException('Cluster with ID C9 not found in secret-table'));
      const res = await srv().get('/clusters/C9').set(bearer(personas.tenantAdminT1())).expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.message).not.toMatch(/secret-table/);
    });

    it('409 -> CONFLICT keeps the service message', async () => {
      m.user.create.mockRejectedValue(new ConflictException('Email sudah terdaftar'));
      const res = await srv()
        .post('/users')
        .set(bearer(personas.tenantAdminT1()))
        .send({ user_name: 'N', user_email: 'n@x.io', user_pass: 'a-long-enough-pass', user_role: 'operator' })
        .expect(409);
      expect(res.body).toEqual({ code: 'CONFLICT', message: 'Email sudah terdaftar' });
    });

    it('400 from a business rule -> BUSINESS_RULE', async () => {
      m.user.update.mockRejectedValue(new BadRequestException('Status tidak bisa dikembalikan'));
      const res = await srv().patch('/users/u1').set(bearer(personas.tenantAdminT1())).send({ user_name: 'x' }).expect(400);
      expect(res.body).toEqual({ code: 'BUSINESS_RULE', message: 'Status tidak bisa dikembalikan' });
    });

    it('validation -> VALIDATION_ERROR with per-field Indonesian messages', async () => {
      const res = await srv()
        .post('/users')
        .set(bearer(personas.tenantAdminT1()))
        .send({ user_name: 'N', user_email: 'bukan-email', user_pass: 'short', user_role: 'operator', hacker: 1 })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.fields.user_email).toEqual(['format email tidak valid']);
      expect(res.body.fields.user_pass).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(res.body.fields.hacker).toEqual(['tidak dikenali']);
    });

    it('429 -> TOO_MANY_REQUESTS', async () => {
      m.auth.validateUser.mockResolvedValue(null);
      let last: any;
      for (let i = 0; i < 6; i++) last = await srv().post('/auth/login').send({ email: 'a@b.io', password: 'x' });
      expect(last.status).toBe(429);
      expect(last.body.code).toBe('TOO_MANY_REQUESTS');
    });
  });
});
