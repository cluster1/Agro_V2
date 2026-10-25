import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Caller, UserService } from './user.service';
import { FakeRepo } from '../test-utils/fakes';

type Row = Record<string, any>;

function makeRepo(seed: Row[]) {
  const rows = seed.map((r) => ({ ...r }));
  const matches = (r: Row, where: Row) => Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    rows,
    findOne: jest.fn(async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null),
    create: jest.fn((e: Row) => ({ ...e })),
    save: jest.fn(async (e: Row) => {
      const i = rows.findIndex((r) => r.user_id === e.user_id);
      if (i >= 0) rows[i] = e;
      else rows.push(e);
      return e;
    }),
    remove: jest.fn(async (e: Row) => {
      rows.splice(rows.findIndex((r) => r.user_id === e.user_id), 1);
      return e;
    }),
  };
}

const globalAdmin: Caller = { user_id: 'ga', tenant_id: 'T0', user_role: 'admin', user_level: 0 };
const tenantAdminT1: Caller = { user_id: 'ta1', tenant_id: 'T1', user_role: 'tenant_admin', user_level: 1 };

const seed = () => [
  { user_id: 'ga', tenant_id: 'T0', user_name: 'GA', user_email: 'ga@x', user_role: 'admin', user_level: 0 },
  { user_id: 'ta1', tenant_id: 'T1', user_name: 'TA1', user_email: 'ta1@x', user_role: 'tenant_admin', user_level: 1 },
  { user_id: 'f1', tenant_id: 'T1', user_name: 'F1', user_email: 'f1@x', user_role: 'farmer', user_level: 2 },
  { user_id: 'f2', tenant_id: 'T2', user_name: 'F2', user_email: 'f2@x', user_role: 'farmer', user_level: 2 },
  // a global admin that happens to live inside tenant T1
  { user_id: 'ga-in-t1', tenant_id: 'T1', user_name: 'GA1', user_email: 'ga1@x', user_role: 'admin', user_level: 0 },
];

function setup() {
  const repo = makeRepo(seed());
  const tokens = new FakeRepo<any>('rt_id');
  ['f1', 'f2', 'ta1'].forEach((u) =>
    tokens.rows.push({ rt_id: `rt-${u}`, user_id: u, token_hash: 'h', expires_at: new Date(Date.now() + 1e6), revoked_at: null }),
  );
  return { repo, tokens, service: new UserService(repo as any, tokens as any) };
}

const revoked = (tokens: FakeRepo<any>, userId: string) =>
  tokens.rows.filter((r) => r.user_id === userId).every((r) => r.revoked_at instanceof Date);
const stillValid = (tokens: FakeRepo<any>, userId: string) =>
  tokens.rows.filter((r) => r.user_id === userId).every((r) => r.revoked_at === null);

const newUser = (extra: Row = {}) => ({
  user_name: 'New',
  user_email: 'new@x',
  user_pass: 'a-long-enough-password',
  user_role: 'farmer',
  ...extra,
});

describe('UserService privilege rules', () => {
  describe('create', () => {
    it('lets a tenant admin create a normal user and hashes the password', async () => {
      const { service, repo } = setup();
      const res = await service.create(tenantAdminT1, 'T1', newUser() as any);

      const stored = repo.rows.find((r) => r.user_email === 'new@x');
      expect(stored.tenant_id).toBe('T1');
      expect(stored.user_pass).not.toBe('a-long-enough-password');
      expect(await bcrypt.compare('a-long-enough-password', stored.user_pass)).toBe(true);
      expect((res as any).user_pass).toBeUndefined();
    });

    it.each([
      ['user_level 0', { user_level: 0 }],
      ['role admin', { user_role: 'admin' }],
      ['both', { user_level: 0, user_role: 'admin' }],
    ])('blocks a tenant admin from minting a global admin (%s)', async (_n, extra) => {
      const { service, repo } = setup();
      const before = repo.rows.length;
      await expect(service.create(tenantAdminT1, 'T1', newUser(extra) as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.rows).toHaveLength(before);
    });

    it('lets a global admin create a global admin', async () => {
      const { service } = setup();
      await expect(
        service.create(globalAdmin, 'T0', newUser({ user_level: 0, user_role: 'admin' }) as any),
      ).resolves.toBeDefined();
    });

    it('rejects a duplicate email', async () => {
      const { service } = setup();
      await expect(
        service.create(tenantAdminT1, 'T1', newUser({ user_email: 'f1@x' }) as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('lets a tenant admin update a user in their own tenant', async () => {
      const { service } = setup();
      const res = await service.update(tenantAdminT1, 'T1', 'f1', { user_name: 'Renamed' } as any);
      expect(res.user_name).toBe('Renamed');
    });

    it('does NOT fall back to another tenant (the old account-takeover bug)', async () => {
      const { service, repo } = setup();
      // tenant admin of T1 targets f2 who lives in T2, using their own tenant id in the path
      await expect(
        service.update(tenantAdminT1, 'T1', 'f2', { user_pass: 'attacker-chosen-pass' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.rows.find((r) => r.user_id === 'f2').user_pass).toBeUndefined();
    });

    it.each([
      ['promote to global admin by level', { user_level: 0 }],
      ['promote to admin by role', { user_role: 'admin' }],
    ])('blocks a tenant admin from escalating a user (%s)', async (_n, patch) => {
      const { service, repo } = setup();
      await expect(service.update(tenantAdminT1, 'T1', 'f1', patch as any)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.rows.find((r) => r.user_id === 'f1').user_level).toBe(2);
    });

    it('blocks a tenant admin from modifying a global admin inside their tenant', async () => {
      const { service } = setup();
      await expect(
        service.update(tenantAdminT1, 'T1', 'ga-in-t1', { user_pass: 'a-long-enough-password' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("blocks changing one's own role or level", async () => {
      const { service } = setup();
      await expect(
        service.update(tenantAdminT1, 'T1', 'ta1', { user_role: 'farmer' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.update(tenantAdminT1, 'T1', 'ta1', { user_level: 2 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows editing one's own non-privilege fields", async () => {
      const { service } = setup();
      await expect(
        service.update(tenantAdminT1, 'T1', 'ta1', { user_name: 'Me', user_role: 'tenant_admin' } as any),
      ).resolves.toBeDefined();
    });

    it('lets a global admin update a user in any tenant', async () => {
      const { service } = setup();
      const res = await service.update(globalAdmin, 'T2', 'f2', { user_name: 'By GA' } as any);
      expect(res.user_name).toBe('By GA');
    });

    it('hashes a new password and never returns it', async () => {
      const { service, repo } = setup();
      const res = await service.update(tenantAdminT1, 'T1', 'f1', { user_pass: 'brand-new-password' } as any);
      expect((res as any).user_pass).toBeUndefined();
      expect(await bcrypt.compare('brand-new-password', repo.rows.find((r) => r.user_id === 'f1').user_pass)).toBe(true);
    });
  });

  describe('remove', () => {
    it('deletes a user in the same tenant', async () => {
      const { service, repo } = setup();
      await service.remove(tenantAdminT1, 'T1', 'f1');
      expect(repo.rows.find((r) => r.user_id === 'f1')).toBeUndefined();
    });

    it('cannot delete a user of another tenant', async () => {
      const { service, repo } = setup();
      await expect(service.remove(tenantAdminT1, 'T1', 'f2')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.rows.find((r) => r.user_id === 'f2')).toBeDefined();
    });

    it('tenant admin cannot delete a global admin', async () => {
      const { service } = setup();
      await expect(service.remove(tenantAdminT1, 'T1', 'ga-in-t1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('nobody can delete their own account', async () => {
      const { service } = setup();
      await expect(service.remove(tenantAdminT1, 'T1', 'ta1')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove(globalAdmin, 'T0', 'ga')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('global admin can delete across tenants', async () => {
      const { service, repo } = setup();
      await service.remove(globalAdmin, 'T2', 'f2');
      expect(repo.rows.find((r) => r.user_id === 'f2')).toBeUndefined();
    });
  });

  describe('half-admin accounts (role admin XOR level 0)', () => {
    it.each([
      ['role admin without level 0', { user_role: 'admin', user_level: 2 }],
      ['role admin with no level', { user_role: 'admin' }],
      ['level 0 with a non-admin role', { user_role: 'farmer', user_level: 0 }],
    ])('a global admin cannot create %s', async (_n, extra) => {
      const { service, repo } = setup();
      const before = repo.rows.length;
      await expect(service.create(globalAdmin, 'T0', newUser(extra) as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.rows).toHaveLength(before);
    });

    it('rejects an update that would leave a half-admin', async () => {
      const { service } = setup();
      await expect(service.update(globalAdmin, 'T1', 'f1', { user_role: 'admin' } as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.update(globalAdmin, 'T1', 'f1', { user_level: 0 } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows promoting to a full global admin when both fields change together', async () => {
      const { service } = setup();
      await expect(
        service.update(globalAdmin, 'T1', 'f1', { user_role: 'admin', user_level: 0 } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('session revocation', () => {
    it('an admin password reset revokes that user’s sessions only', async () => {
      const { service, tokens } = setup();
      await service.update(tenantAdminT1, 'T1', 'f1', { user_pass: 'brand-new-password' } as any);
      expect(revoked(tokens, 'f1')).toBe(true);
      expect(stillValid(tokens, 'ta1')).toBe(true);
      expect(stillValid(tokens, 'f2')).toBe(true);
    });

    it('deactivating a user revokes their sessions', async () => {
      const { service, tokens } = setup();
      await service.update(tenantAdminT1, 'T1', 'f1', { user_sts: 'inactive' } as any);
      expect(revoked(tokens, 'f1')).toBe(true);
    });

    it('re-activating or renaming does not revoke anything', async () => {
      const { service, tokens } = setup();
      await service.update(tenantAdminT1, 'T1', 'f1', { user_name: 'x', user_sts: 'active' } as any);
      expect(stillValid(tokens, 'f1')).toBe(true);
    });

    it('deleting a user revokes their sessions', async () => {
      const { service, tokens } = setup();
      await service.remove(tenantAdminT1, 'T1', 'f1');
      expect(revoked(tokens, 'f1')).toBe(true);
    });
  });
});
