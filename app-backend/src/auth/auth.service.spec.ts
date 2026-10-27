import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RefreshRaceException } from './refresh-race.exception';
import { ACCESS_SECRET, FakeRepo, REFRESH_SECRET } from '../test-utils/fakes';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

// Moves a token's revocation far enough into the past to fall outside the race grace window.
function ageRevocation(tokens: FakeRepo<any>, rawToken: string, ms: number) {
  const row = tokens.rows.find((r) => r.token_hash === sha256(rawToken));
  row.revoked_at = new Date(Date.now() - ms);
}

function makeUser(overrides: Record<string, any> = {}) {
  return {
    user_id: 'u1',
    user_email: 'u1@test.local',
    user_name: 'User One',
    user_pass: bcrypt.hashSync('correct-horse-battery', 4),
    tenant_id: 'T1',
    user_role: 'tenant_admin',
    user_level: 1,
    user_sts: 'active',
    tenant: { tenant_id: 'T1', tenant_sts: 1 },
    ...overrides,
  };
}

function setup(user: any = makeUser(), refreshExpiration = '7d') {
  const users = { findOne: jest.fn().mockResolvedValue(user), save: jest.fn() };
  const tokens = new FakeRepo<any>('rt_id');
  const jwt = new JwtService({ secret: ACCESS_SECRET });
  const config = {
    get: (k: string) =>
      ({ JWT_REFRESH_SECRET: REFRESH_SECRET, JWT_REFRESH_EXPIRATION: refreshExpiration })[k],
  };
  const service = new AuthService(users as any, tokens as any, jwt, config as any);
  return { service, users, tokens, jwt };
}

describe('AuthService', () => {
  describe('validateUser', () => {
    it('accepts correct credentials and strips the password hash', async () => {
      const { service } = setup();
      const result = await service.validateUser('u1@test.local', 'correct-horse-battery');
      expect(result).toMatchObject({ user_id: 'u1' });
      expect(result.user_pass).toBeUndefined();
    });

    it('rejects a wrong password', async () => {
      const { service } = setup();
      expect(await service.validateUser('u1@test.local', 'nope')).toBeNull();
    });

    it('rejects unknown email', async () => {
      const { service, users } = setup();
      users.findOne.mockResolvedValue(null);
      expect(await service.validateUser('x@test.local', 'whatever')).toBeNull();
    });

    it('rejects a deactivated user even with the right password', async () => {
      const { service } = setup(makeUser({ user_sts: 'inactive' }));
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).toBeNull();
    });

    it('rejects a user whose tenant is inactive', async () => {
      const { service } = setup(makeUser({ tenant: { tenant_id: 'T1', tenant_sts: 0 } }));
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).toBeNull();
    });

    it('fails closed when a non-global user’s tenant row is missing', async () => {
      const { service } = setup(makeUser({ tenant: null }));
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).toBeNull();
    });

    it('does not let a half-admin (role admin, level 2) skip the tenant status check', async () => {
      const { service } = setup(
        makeUser({ user_role: 'admin', user_level: 2, tenant: { tenant_id: 'T1', tenant_sts: 0 } }),
      );
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).toBeNull();
    });

    it('does not let level 0 with a non-admin role skip the tenant status check', async () => {
      const { service } = setup(
        makeUser({ user_role: 'operator', user_level: 0, tenant: { tenant_id: 'T1', tenant_sts: 0 } }),
      );
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).toBeNull();
    });

    it('lets a global admin with no tenant row log in', async () => {
      const { service } = setup(makeUser({ user_level: 0, user_role: 'admin', tenant: null }));
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).not.toBeNull();
    });

    it('still spends a bcrypt comparison for an unknown email (no user-enumeration timing gap)', async () => {
      const { service, users } = setup();
      users.findOne.mockResolvedValue(null);
      const spy = jest.spyOn(bcrypt, 'compare');
      await service.validateUser('nobody@test.local', 'whatever');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('lets a global admin in regardless of tenant status', async () => {
      const { service } = setup(
        makeUser({ user_level: 0, user_role: 'admin', tenant: { tenant_id: 'T0', tenant_sts: 0 } }),
      );
      expect(await service.validateUser('u1@test.local', 'correct-horse-battery')).not.toBeNull();
    });
  });

  describe('login', () => {
    it('stores only a hash of the refresh token', async () => {
      const { service, tokens } = setup();
      const { refreshToken } = await service.login(makeUser());

      expect(tokens.rows).toHaveLength(1);
      expect(tokens.rows[0].token_hash).toBe(sha256(refreshToken));
      expect(JSON.stringify(tokens.rows[0])).not.toContain(refreshToken);
      expect(tokens.rows[0].revoked_at).toBeNull();
    });

    it('puts tenant and role claims in the access token', async () => {
      const { service, jwt } = setup();
      const { accessToken } = await service.login(makeUser());
      expect(jwt.verify(accessToken)).toMatchObject({
        sub: 'u1',
        tenant_id: 'T1',
        user_role: 'tenant_admin',
        user_level: 1,
      });
    });

    it.each([
      ['7d', 7 * 86_400],
      ['15m', 900],
      ['3600', 3600],
      ['1w', 7 * 86_400], // unsupported unit falls back to 7d everywhere, consistently
    ])('refresh lifetime %s: JWT exp and DB expires_at agree', async (setting, seconds) => {
      const { service, tokens, jwt } = setup(makeUser(), setting);
      const { refreshToken } = await service.login(makeUser());
      const { exp, iat } = jwt.decode(refreshToken) as any;
      expect(exp - iat).toBe(seconds);
      const dbSeconds = (tokens.rows[0].expires_at.getTime() - Date.now()) / 1000;
      expect(Math.abs(dbSeconds - seconds)).toBeLessThan(5);
    });

    it('purges expired token rows', async () => {
      const { service, tokens } = setup();
      tokens.rows.push({ rt_id: 'old', user_id: 'u1', token_hash: 'x', expires_at: new Date(0), revoked_at: null });
      await service.login(makeUser());
      expect(tokens.rows.find((r) => r.rt_id === 'old')).toBeUndefined();
    });
  });

  describe('refreshToken (rotation)', () => {
    it('issues a new pair and revokes the presented token', async () => {
      const { service, tokens } = setup();
      const first = await service.login(makeUser());
      const second = await service.refreshToken(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.accessToken).toEqual(expect.any(String));
      const old = tokens.rows.find((r) => r.token_hash === sha256(first.refreshToken));
      const fresh = tokens.rows.find((r) => r.token_hash === sha256(second.refreshToken));
      expect(old.revoked_at).toBeInstanceOf(Date);
      expect(fresh.revoked_at).toBeNull();
    });

    it('can be chained (the rotated token works too)', async () => {
      const { service } = setup();
      const a = await service.login(makeUser());
      const b = await service.refreshToken(a.refreshToken);
      await expect(service.refreshToken(b.refreshToken)).resolves.toBeDefined();
    });

    it('treats reuse of a rotated token as theft and revokes every session', async () => {
      const { service, tokens } = setup();
      const a = await service.login(makeUser());
      const b = await service.refreshToken(a.refreshToken);
      ageRevocation(tokens, a.refreshToken, 60_000);

      await expect(service.refreshToken(a.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

      // the legitimate, newer token is dead as well
      expect(tokens.rows.every((r) => r.revoked_at)).toBe(true);
      await expect(service.refreshToken(b.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lets only one of two concurrent refreshes win, and the loser is a benign race', async () => {
      const { service } = setup();
      const { refreshToken } = await service.login(makeUser());

      const results = await Promise.allSettled([
        service.refreshToken(refreshToken),
        service.refreshToken(refreshToken),
      ]);
      const won = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
      const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(lost[0].reason).toBeInstanceOf(RefreshRaceException);
      // the winner's new token was NOT revoked by the loser
      await expect(service.refreshToken(won[0].value.refreshToken)).resolves.toBeDefined();
    });

    it('re-presenting a just-rotated token (two tabs) is refused as a race, not theft', async () => {
      const { service, tokens } = setup();
      const a = await service.login(makeUser());
      const b = await service.refreshToken(a.refreshToken);

      await expect(service.refreshToken(a.refreshToken)).rejects.toBeInstanceOf(RefreshRaceException);

      // sessions survive: the newer token still works
      expect(tokens.rows.filter((r) => r.token_hash === sha256(b.refreshToken))[0].revoked_at).toBeNull();
      await expect(service.refreshToken(b.refreshToken)).resolves.toBeDefined();
    });

    it('the grace window is short: reuse after it still triggers full revocation', async () => {
      const { service, tokens } = setup();
      const a = await service.login(makeUser());
      await service.refreshToken(a.refreshToken);
      ageRevocation(tokens, a.refreshToken, 11_000);
      await expect(service.refreshToken(a.refreshToken)).rejects.not.toBeInstanceOf(RefreshRaceException);
      expect(tokens.rows.every((r) => r.revoked_at)).toBe(true);
    });

    it.each([undefined, '', 'garbage', 'a.b.c'])('rejects a malformed token (%p)', async (bad) => {
      const { service } = setup();
      await expect(service.refreshToken(bad as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token signed with the access secret (wrong key)', async () => {
      const { service, jwt } = setup();
      const forged = jwt.sign({ sub: 'u1' }, { secret: ACCESS_SECRET, jwtid: 'whatever' });
      await expect(service.refreshToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a validly signed token that was never issued (no DB record)', async () => {
      const { service, jwt } = setup();
      const forged = jwt.sign({ sub: 'u1' }, { secret: REFRESH_SECRET, jwtid: 'never-issued', expiresIn: '1d' });
      await expect(service.refreshToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the stored hash does not match the presented token', async () => {
      const { service, tokens, jwt } = setup();
      const { refreshToken } = await service.login(makeUser());
      const { jti } = jwt.decode(refreshToken) as any;
      // same jti, different (validly signed) token string
      const sibling = jwt.sign({ sub: 'u1' }, { secret: REFRESH_SECRET, jwtid: jti, expiresIn: '1d' });
      expect(sibling).not.toBe(refreshToken);
      await expect(service.refreshToken(sibling)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.rows[0].revoked_at).toBeNull(); // not consumed by the forgery
    });

    it('rejects an expired DB record', async () => {
      const { service, tokens } = setup();
      const { refreshToken } = await service.login(makeUser());
      tokens.rows[0].expires_at = new Date(Date.now() - 1000);
      await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('revokes everything and refuses once the user is deactivated', async () => {
      const { service, users, tokens } = setup();
      const { refreshToken } = await service.login(makeUser());
      users.findOne.mockResolvedValue(makeUser({ user_sts: 'inactive' }));

      await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.rows.every((r) => r.revoked_at)).toBe(true);
    });

    it('refuses once the tenant is deactivated (non-global user)', async () => {
      const { service, users } = setup();
      const { refreshToken } = await service.login(makeUser());
      users.findOne.mockResolvedValue(makeUser({ tenant: { tenant_id: 'T1', tenant_sts: 0 } }));
      await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('picks up role changes at refresh time', async () => {
      const { service, users, jwt } = setup();
      const { refreshToken } = await service.login(makeUser());
      users.findOne.mockResolvedValue(makeUser({ user_role: 'agronom', user_level: 2 }));
      const { accessToken } = await service.refreshToken(refreshToken);
      expect(jwt.verify(accessToken)).toMatchObject({ user_role: 'agronom', user_level: 2 });
    });
  });

  describe('logout', () => {
    it('revokes the presented token so it can no longer refresh', async () => {
      const { service } = setup();
      const { refreshToken } = await service.login(makeUser());
      await service.logout(refreshToken);
      await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('does not revoke other sessions of the same user', async () => {
      const { service } = setup();
      const phone = await service.login(makeUser());
      const laptop = await service.login(makeUser());
      await service.logout(phone.refreshToken);
      await expect(service.refreshToken(laptop.refreshToken)).resolves.toBeDefined();
    });

    it('ignores a forged cookie that shares a jti but has the wrong signature/hash', async () => {
      const { service, tokens, jwt } = setup();
      const { refreshToken } = await service.login(makeUser());
      const { jti } = jwt.decode(refreshToken) as any;
      const forged = jwt.sign({ sub: 'u1' }, { secret: 'attacker-secret-attacker-secret-1234', jwtid: jti });
      await service.logout(forged);
      expect(tokens.rows[0].revoked_at).toBeNull();
    });

    it('is a no-op without a cookie', async () => {
      const { service } = setup();
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong old password and leaves sessions intact', async () => {
      const { service, tokens } = setup();
      await service.login(makeUser());
      await expect(service.changePassword('u1', 'wrong', 'a-new-long-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tokens.rows.every((r) => !r.revoked_at)).toBe(true);
    });

    it('hashes the new password and revokes all sessions', async () => {
      const user = makeUser();
      const { service, tokens, users } = setup(user);
      const { refreshToken } = await service.login(user);

      await service.changePassword('u1', 'correct-horse-battery', 'a-new-long-password');

      const saved = users.save.mock.calls[0][0];
      expect(saved.user_pass).not.toBe('a-new-long-password');
      expect(await bcrypt.compare('a-new-long-password', saved.user_pass)).toBe(true);
      expect(tokens.rows.every((r) => r.revoked_at)).toBe(true);
      await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
