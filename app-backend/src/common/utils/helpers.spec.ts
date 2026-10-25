import { BadRequestException, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { assertOwned } from './assert-owned';
import { escapeRegExp } from './escape-regexp';
import { parseBoundedInt } from './parse-bounded-int';
import { scoped } from './scope';
import { GLOBAL_ADMIN_LEVEL, isGlobalAdmin } from '../constants/roles';

describe('isGlobalAdmin', () => {
  it.each([
    [{ user_role: 'admin', user_level: 0 }, true],
    [{ user_role: 'admin', user_level: 1 }, false],
    [{ user_role: 'admin', user_level: 2 }, false],
    [{ user_role: 'admin' }, false],
    [{ user_role: 'farmer', user_level: 0 }, false],
    [{ user_role: 'tenant_admin', user_level: 0 }, false],
    [{ user_role: 'ADMIN', user_level: 0 }, false],
    [{ user_level: 0 }, false],
    [{}, false],
    [null, false],
    [undefined, false],
  ])('%j -> %s', (user, expected) => {
    expect(isGlobalAdmin(user as any)).toBe(expected);
  });

  it('level is strictly numeric 0 (not "0" or false)', () => {
    expect(isGlobalAdmin({ user_role: 'admin', user_level: '0' as any })).toBe(false);
    expect(isGlobalAdmin({ user_role: 'admin', user_level: false as any })).toBe(false);
    expect(GLOBAL_ADMIN_LEVEL).toBe(0);
  });
});

describe('scoped', () => {
  it('adds tenant_id when a scope is given', () => {
    expect(scoped({ cluster_id: 'C1' }, 'T1')).toEqual({ cluster_id: 'C1', tenant_id: 'T1' });
  });

  it('leaves the where untouched for global admins (undefined scope)', () => {
    const where = { cluster_id: 'C1' };
    expect(scoped(where, undefined)).toBe(where);
  });

  it('scope always wins over a tenant_id already in the where', () => {
    expect(scoped({ cluster_id: 'C1', tenant_id: 'T2' } as any, 'T1')).toEqual({ cluster_id: 'C1', tenant_id: 'T1' });
  });

  it('does not mutate its input', () => {
    const where = { a: 1 };
    scoped(where, 'T1');
    expect(where).toEqual({ a: 1 });
  });
});

describe('assertOwned', () => {
  class Thing {}
  const manager = (row: unknown) => ({ findOne: jest.fn().mockResolvedValue(row) }) as any;

  it('returns the row when it exists', async () => {
    const row = { id: 1 };
    await expect(assertOwned(manager(row), Thing, { id: 1 } as any, 'Thing')).resolves.toBe(row);
  });

  it('throws 404 (not 403) when missing, so existence is not revealed', async () => {
    await expect(assertOwned(manager(null), Thing, { id: 1 } as any, 'Site')).rejects.toThrow(
      new NotFoundException('Site not found'),
    );
  });

  it('queries with exactly the where it was given', async () => {
    const m = manager({});
    await assertOwned(m, Thing, { id: 1, tenant_id: 'T1' } as any, 'Thing');
    expect(m.findOne).toHaveBeenCalledWith(Thing, { where: { id: 1, tenant_id: 'T1' } });
  });
});

describe('parseBoundedInt', () => {
  it.each([undefined, null, ''])('falls back for %p', (v) => {
    expect(parseBoundedInt('limit', v, 10, 1, 500)).toBe(10);
  });

  it.each([
    ['1', 1],
    ['500', 500],
    [25, 25],
  ])('accepts %p', (v, n) => expect(parseBoundedInt('limit', v, 10, 1, 500)).toBe(n));

  it.each(['0', '501', '-1', '1.5', 'abc', 'NaN', 'Infinity', '1e9', {}, []])('rejects %p with 400', (v) => {
    expect(() => parseBoundedInt('limit', v, 10, 1, 500)).toThrow(BadRequestException);
  });

  it('names the parameter and the bounds in the message', () => {
    expect(() => parseBoundedInt('hours', '9999', 24, 1, 720)).toThrow('hours must be an integer between 1 and 720');
  });
});

describe('escapeRegExp', () => {
  it('escapes every regex metacharacter so the input is matched literally', () => {
    const nasty = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o';
    expect(new RegExp(`^${escapeRegExp(nasty)}$`).test(nasty)).toBe(true);
    expect(new RegExp(`^${escapeRegExp(nasty)}$`).test('aXb')).toBe(false);
  });

  it('a "." in an id does not match arbitrary characters', () => {
    const re = new RegExp(`^${escapeRegExp('SITE.1')}_CLS(\\d+)$`);
    expect(re.test('SITE.1_CLS7')).toBe(true);
    expect(re.test('SITEX1_CLS7')).toBe(false);
  });

  it('leaves ordinary ids untouched', () => {
    expect(escapeRegExp('TENANT1_SITE2')).toBe('TENANT1_SITE2');
  });
});

describe('safeUnlinkUpload (path-traversal guard)', () => {
  let root: string;
  let cwd: jest.SpyInstance;
  let safeUnlinkUpload: (p: string | null | undefined) => Promise<void>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'media-files-'));
    mkdirSync(join(root, 'uploads'));
    cwd = jest.spyOn(process, 'cwd').mockReturnValue(root);
    // UPLOADS_DIR is computed at import time from process.cwd()
    jest.isolateModules(() => {
      safeUnlinkUpload = require('../../media/media-files').safeUnlinkUpload;
    });
  });
  afterEach(() => {
    cwd.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  const touch = (rel: string) => {
    const p = join(root, rel);
    writeFileSync(p, 'x');
    return p;
  };

  it('deletes a file inside uploads (relative stored path)', async () => {
    const p = touch('uploads/a.png');
    await safeUnlinkUpload('uploads/a.png');
    expect(existsSync(p)).toBe(false);
  });

  it('deletes a file inside uploads (dot-slash and backslash styles)', async () => {
    const p = touch('uploads/b.png');
    await safeUnlinkUpload('./uploads/b.png');
    expect(existsSync(p)).toBe(false);
    const q = touch('uploads/c.png');
    await safeUnlinkUpload('uploads\\c.png');
    // backslash only separates on Windows; on POSIX it is part of the name, so nothing is removed
    expect(existsSync(q)).toBe(process.platform === 'win32' ? false : true);
  });

  it.each(['uploads/../secret.txt', '../secret.txt', 'secret.txt', '/etc/passwd', 'uploads/../../secret.txt'])(
    'refuses to delete outside uploads: %s',
    async (rel) => {
      const secret = touch('secret.txt');
      await safeUnlinkUpload(rel);
      expect(existsSync(secret)).toBe(true);
    },
  );

  it('refuses the uploads directory itself and a sibling with the same prefix', async () => {
    mkdirSync(join(root, 'uploads-evil'));
    const evil = touch('uploads-evil/x.png');
    await safeUnlinkUpload('uploads');
    await safeUnlinkUpload('uploads-evil/x.png');
    expect(existsSync(join(root, 'uploads'))).toBe(true);
    expect(existsSync(evil)).toBe(true);
  });

  it('never throws: missing file, empty, null', async () => {
    await expect(safeUnlinkUpload('uploads/missing.png')).resolves.toBeUndefined();
    await expect(safeUnlinkUpload('')).resolves.toBeUndefined();
    await expect(safeUnlinkUpload(null)).resolves.toBeUndefined();
    await expect(safeUnlinkUpload(undefined)).resolves.toBeUndefined();
  });
});
