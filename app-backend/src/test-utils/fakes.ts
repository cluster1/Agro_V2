import { JwtService } from '@nestjs/jwt';
import { FindOperator } from 'typeorm';

export const ACCESS_SECRET = 'test-access-secret-0123456789-0123456789-abcdef';
export const REFRESH_SECRET = 'test-refresh-secret-0123456789-0123456789-xyz';

export interface TokenClaims {
  sub?: string;
  email?: string;
  tenant_id?: string;
  user_role?: string;
  user_level?: number;
}

/** Signs an access token exactly like AuthService does (HS256, ACCESS_SECRET). */
export function signAccessToken(claims: TokenClaims = {}, options: Record<string, any> = {}): string {
  const jwt = new JwtService({ secret: ACCESS_SECRET });
  return jwt.sign(
    {
      sub: 'user-1',
      email: 'u@test.local',
      tenant_id: 'T1',
      user_role: 'tenant_admin',
      user_level: 1,
      ...claims,
    },
    { expiresIn: '15m', ...options },
  );
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Personas used across the HTTP-level tests.
export const personas = {
  globalAdmin: () => signAccessToken({ sub: 'ga', tenant_id: 'T0', user_role: 'admin', user_level: 0 }),
  tenantAdminT1: () => signAccessToken({ sub: 'ta1', tenant_id: 'T1', user_role: 'tenant_admin', user_level: 1 }),
  tenantAdminT2: () => signAccessToken({ sub: 'ta2', tenant_id: 'T2', user_role: 'tenant_admin', user_level: 1 }),
  agronomT1: () => signAccessToken({ sub: 'agr1', tenant_id: 'T1', user_role: 'agronom', user_level: 3 }),
  operatorT1: () => signAccessToken({ sub: 'op1', tenant_id: 'T1', user_role: 'operator', user_level: 2 }),
};

type Row = Record<string, any>;

/**
 * Minimal in-memory stand-in for a TypeORM Repository, enough for the
 * operators the auth code uses (equality, IsNull, LessThan).
 */
export class FakeRepo<T extends Row> {
  rows: T[] = [];

  constructor(private readonly key: keyof T & string) {}

  private matches(row: T, where: Row): boolean {
    return Object.entries(where).every(([field, cond]) => {
      const value = row[field];
      if (cond instanceof FindOperator) {
        switch (cond.type) {
          case 'isNull':
            return value === null || value === undefined;
          case 'lessThan':
            return value < cond.value;
          default:
            throw new Error(`Unsupported operator ${cond.type}`);
        }
      }
      return value === cond;
    });
  }

  async insert(entity: T) {
    this.rows.push({ ...entity, created_at: new Date() });
    return { identifiers: [{ [this.key]: entity[this.key] }] };
  }

  async findOne(opts: { where: Row }): Promise<T | null> {
    return this.rows.find((r) => this.matches(r, opts.where)) ?? null;
  }

  async update(criteria: Row, patch: Partial<T>) {
    const hits = this.rows.filter((r) => this.matches(r, criteria));
    hits.forEach((r) => Object.assign(r, patch));
    return { affected: hits.length };
  }

  async delete(criteria: Row) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !this.matches(r, criteria));
    return { affected: before - this.rows.length };
  }
}

/**
 * In-memory repository for service-level isolation tests. Where-clauses are
 * matched by plain equality, so a service that forgets `tenant_id` returns data
 * it should not. `relations`, `order` and `take` are ignored.
 */
export class TenantRepo<T extends Row> {
  rows: T[];

  constructor(
    private readonly key: keyof T & string,
    seed: T[],
    private readonly registry?: Map<any, TenantRepo<any>>,
  ) {
    this.rows = seed.map((r) => ({ ...r }));
  }

  get manager() {
    return {
      findOne: async (entity: any, opts: { where: Row }) => this.registry!.get(entity)!.findOne(opts),
    };
  }

  private matches(row: T, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => row[k] === v);
  }

  // Return copies, like a real DB, so unsaved in-memory mutations never leak into stored rows.
  async find(opts: { where?: Row } = {}): Promise<T[]> {
    return this.rows.filter((r) => this.matches(r, opts.where)).map((r) => ({ ...r }));
  }

  async findOne(opts: { where: Row }): Promise<T | null> {
    const row = this.rows.find((r) => this.matches(r, opts.where));
    return row ? { ...row } : null;
  }

  create(entity: Partial<T>): T {
    return { ...entity } as T;
  }

  async insert(entity: T) {
    this.rows.push({ ...entity });
    return { identifiers: [{ [this.key]: entity[this.key] }] };
  }

  async save(entity: T): Promise<T> {
    const i = this.rows.findIndex((r) => r[this.key] === entity[this.key]);
    if (i >= 0) this.rows[i] = { ...this.rows[i], ...entity };
    else this.rows.push({ ...entity });
    return entity;
  }

  async update(criteria: Row, patch: Partial<T>) {
    const hits = this.rows.filter((r) => this.matches(r, criteria));
    hits.forEach((r) => Object.assign(r, patch));
    return { affected: hits.length };
  }

  async remove(entity: T): Promise<T> {
    this.rows = this.rows.filter((r) => r[this.key] !== entity[this.key]);
    return entity;
  }

  createQueryBuilder() {
    // Only used for "next id" generation; there are never pre-existing children in these tests.
    const qb: any = { where: () => qb, andWhere: () => qb, orderBy: () => qb, getOne: async () => null };
    return qb;
  }
}
