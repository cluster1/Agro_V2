/** In-memory stand-in for a TypeORM EntityManager, enough for `find`, `findOne` and `update` with equality / In() filters. */
const eq = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && '_type' in v) return v._type === 'in' ? v._value.includes(row[k]) : true;
    return row[k] === v;
  });

export function makeManager(tables: Map<unknown, any[]>) {
  const repoOf = (entity: unknown) => ({
    find: jest.fn(async (opts: any = {}) => (tables.get(entity) ?? []).filter((r) => eq(r, opts.where ?? {})).map((r) => ({ ...r }))),
    findOne: jest.fn(async (opts: any) => {
      const r = (tables.get(entity) ?? []).find((x) => eq(x, opts.where ?? {}));
      return r ? { ...r } : null;
    }),
    update: jest.fn(async (where: any, patch: any) => {
      (tables.get(entity) ?? []).filter((r) => eq(r, where)).forEach((r) => Object.assign(r, patch));
    }),
  });
  const repos = new Map<unknown, ReturnType<typeof repoOf>>();
  return { getRepository: (e: unknown) => (repos.has(e) ? repos.get(e)! : (repos.set(e, repoOf(e)), repos.get(e)!)) };
}
