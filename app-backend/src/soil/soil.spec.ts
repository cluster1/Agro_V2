import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SoilService } from './soil.service';
import { SoilController } from './soil.controller';
import { Cluster } from '../cluster/entities/cluster.entity';
import { Plant } from '../plant/entities/plant.entity';
import { nutrientStatus, validateSoil } from './soil-rules';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('validateSoil', () => {
  const bad = (v: any, re?: RegExp) => {
    expect(() => validateSoil(v)).toThrow(BadRequestException);
    if (re) expect(() => validateSoil(v)).toThrow(re);
  };

  it('BR-15: texture 30/30/30 is rejected (sum 90%)', () => {
    bad({ soil_sand: 30, soil_silt: 30, soil_clay: 30 }, /100%/);
  });

  it.each([
    [25, 35, 40],
    [25.5, 34.5, 40.5], // 100.5, within ±1
    [33, 33, 33], // 99, within ±1
    [30, 30, 41], // 101
  ])('accepts texture %s/%s/%s', (a, b, c) => {
    expect(() => validateSoil({ soil_sand: a, soil_silt: b, soil_clay: c })).not.toThrow();
  });

  it.each([[30, 30, 41.1], [30, 30, 38.9], [50, 50, 50]])('rejects texture %s/%s/%s', (a, b, c) => {
    bad({ soil_sand: a, soil_silt: b, soil_clay: c });
  });

  it('needs all three fractions when any is given, and each within 0-100', () => {
    bad({ soil_sand: 50, soil_silt: 50 }, /bersamaan/);
    bad({ soil_sand: -5, soil_silt: 55, soil_clay: 50 }, /0-100/);
  });

  it.each([3, 5.8, 10])('accepts pH %s', (v) => expect(() => validateSoil({ soil_ph_h2o: v, soil_ph_kcl: v })).not.toThrow());
  it.each([2.9, 10.1])('rejects pH %s for both scales', (v) => {
    bad({ soil_ph_h2o: v }, /pH H₂O/);
    bad({ soil_ph_kcl: v }, /pH KCl/);
  });

  it('field capacity must exceed wilting point', () => {
    expect(() => validateSoil({ soil_fc: 38, soil_wp: 22 })).not.toThrow();
    bad({ soil_fc: 22, soil_wp: 22 }, /Kapasitas lapang/);
    bad({ soil_fc: 20, soil_wp: 22 });
    expect(() => validateSoil({ soil_fc: 20 })).not.toThrow(); // only compared when both given
  });

  it('checks depth order and sign', () => {
    expect(() => validateSoil({ soil_depth_top: 0, soil_depth_bottom: 20 })).not.toThrow();
    bad({ soil_depth_top: 20, soil_depth_bottom: 20 }, /Kedalaman bawah/);
    bad({ soil_depth_top: -5, soil_depth_bottom: 10 }, /negatif/);
  });

  it('needs the P method when P is given', () => {
    bad({ soil_p_avail: 18 }, /Metode P/);
    expect(() => validateSoil({ soil_p_avail: 18, soil_p_method: 'BRAY1' })).not.toThrow();
  });

  it('bounds base saturation and C-organic to 0-100', () => {
    bad({ soil_base_sat: 101 });
    bad({ soil_c_org: -1 });
  });

  it('reports every problem at once', () => {
    try {
      validateSoil({ soil_sand: 30, soil_silt: 30, soil_clay: 30, soil_ph_h2o: 12, soil_fc: 1, soil_wp: 5 });
      fail('should throw');
    } catch (e: any) {
      expect(e.message.split('; ')).toHaveLength(3);
    }
  });
});

describe('nutrientStatus', () => {
  it.each([
    ['BRAY1', 9, 'RENDAH'],
    ['BRAY1', 15, 'RENDAH'],
    ['BRAY1', 18, 'SEDANG'],
    ['BRAY1', 25, 'SEDANG'],
    ['BRAY1', 30, 'TINGGI'],
    ['OLSEN', 10, 'RENDAH'],
    ['OLSEN', 20, 'SEDANG'],
    ['OLSEN', 26, 'TINGGI'],
    ['BRAY2', 28, 'SEDANG'],
    ['BRAY2', 31, 'TINGGI'],
  ])('P %s %s -> %s', (method, value, expected) => {
    expect(nutrientStatus({ soil_p_avail: value as number, soil_p_method: method }).p_status).toBe(expected);
  });

  it.each([
    [0.18, 'RENDAH'],
    [0.3, 'RENDAH'],
    [0.35, 'SEDANG'],
    [0.5, 'SEDANG'],
    [0.6, 'TINGGI'],
  ])('K %s -> %s', (value, expected) => {
    expect(nutrientStatus({ soil_k_exch: value }).k_status).toBe(expected);
  });

  it('matches the demo samples (SPL-A: P 18 Bray1, K 0.35 -> SEDANG; SPL-B01: P 9, K 0.18 -> RENDAH)', () => {
    expect(nutrientStatus({ soil_p_avail: 18, soil_p_method: 'BRAY1', soil_k_exch: 0.35 })).toEqual({ p_status: 'SEDANG', k_status: 'SEDANG' });
    expect(nutrientStatus({ soil_p_avail: 9, soil_p_method: 'BRAY1', soil_k_exch: 0.18 })).toEqual({ p_status: 'RENDAH', k_status: 'RENDAH' });
  });

  it('is null when the value or the P method is missing or unknown', () => {
    expect(nutrientStatus({})).toEqual({ p_status: null, k_status: null });
    expect(nutrientStatus({ soil_p_avail: 18 }).p_status).toBeNull();
    expect(nutrientStatus({ soil_p_avail: 18, soil_p_method: 'MEHLICH' }).p_status).toBeNull();
    expect(nutrientStatus({ soil_p_avail: 0, soil_p_method: 'BRAY1' }).p_status).toBe('RENDAH'); // 0 is a value
  });
});

const clusters: any[] = [
  { cluster_id: 'C1', tenant_id: 'T1', site_id: 'S1' },
  { cluster_id: 'C2', tenant_id: 'T2', site_id: 'S2' },
];
const plants: any[] = [
  { plant_id: 'P1', tenant_id: 'T1', cluster_id: 'C1' },
  { plant_id: 'P9', tenant_id: 'T1', cluster_id: 'C9' },
];

const eq = (row: any, where: Record<string, any>) => Object.entries(where).every(([k, v]) => row[k] === v);

function setup(seed: any[] = []) {
  const stored = seed.map((r) => ({ ...r }));
  const repo = {
    manager: {
      findOne: jest.fn(async (entity, { where }) => {
        const list = entity === Cluster ? clusters : entity === Plant ? plants : [];
        return list.find((r) => eq(r, where)) ?? null;
      }),
    },
    create: jest.fn((x) => ({ ...x })),
    insert: jest.fn(async (row) => stored.push({ ...row })),
    find: jest.fn(async ({ where }) => stored.filter((r) => eq(r, where)).map((r) => ({ ...r }))),
    findOne: jest.fn(async ({ where }) => {
      const r = stored.find((s) => eq(s, where));
      return r ? { ...r } : null;
    }),
    save: jest.fn(async (r) => r),
    delete: jest.fn(async ({ soil_id }) => {
      const i = stored.findIndex((s) => s.soil_id === soil_id);
      if (i >= 0) stored.splice(i, 1);
    }),
  };
  return { service: new SoilService(repo as any), repo, stored };
}

const dto = (over: Record<string, unknown> = {}): any => ({
  cluster_id: 'C1',
  soil_sample_date: '2026-08-20',
  soil_sand: 25,
  soil_silt: 35,
  soil_clay: 40,
  soil_ph_h2o: 5.8,
  soil_p_avail: 18,
  soil_p_method: 'BRAY1',
  soil_k_exch: 0.35,
  ...over,
});

describe('SoilService.create', () => {
  it('stores the profile with tenant/site from the cluster, a 32-char id, and the derived statuses', async () => {
    const { service, stored } = setup();
    const res = await service.create('T1', 'u1', dto());
    expect(res).toMatchObject({
      tenant_id: 'T1',
      site_id: 'S1',
      cluster_id: 'C1',
      user_id: 'u1',
      soil_sts: 1,
      p_status: 'SEDANG',
      k_status: 'SEDANG',
    });
    expect(res.soil_id).toMatch(/^[0-9a-f]{32}$/);
    expect(stored).toHaveLength(1);
  });

  it('404s for another tenant’s cluster and for a plant of a different cluster', async () => {
    const { service, repo } = setup();
    await expect(service.create('T1', 'u1', dto({ cluster_id: 'C2' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P9' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P1' }))).resolves.toMatchObject({ plant_id: 'P1' });
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['bad texture', { soil_clay: 30 }],
    ['pH out of range', { soil_ph_h2o: 11 }],
    ['future date', { soil_sample_date: '2099-01-01' }],
    ['impossible date', { soil_sample_date: '2026-02-31' }],
    ['P without method', { soil_p_method: undefined }],
  ])('rejects %s and writes nothing', async (_n, over) => {
    const { service, repo } = setup();
    await expect(service.create('T1', 'u1', dto(over))).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insert).not.toHaveBeenCalled();
  });
});

describe('SoilService read, update, remove', () => {
  const seed = () => [
    { soil_id: 'A', tenant_id: 'T1', cluster_id: 'C1', soil_sample_date: '2026-08-20', soil_sand: 25, soil_silt: 35, soil_clay: 40, soil_p_avail: 18, soil_p_method: 'BRAY1', soil_k_exch: 0.35 },
    { soil_id: 'B', tenant_id: 'T2', cluster_id: 'C2', soil_sample_date: '2026-08-20' },
  ];

  it('lists only the tenant’s profiles with statuses; a global admin without scope sees all', async () => {
    const { service } = setup(seed());
    const list = await service.findAll('T1');
    expect(list.map((r) => r.soil_id)).toEqual(['A']);
    expect(list[0]).toMatchObject({ p_status: 'SEDANG', k_status: 'SEDANG' });
    expect(await service.findAll(undefined)).toHaveLength(2);
  });

  it('a tenant_id smuggled through filters cannot widen the scope', async () => {
    const { service, repo } = setup(seed());
    await service.findAll('T1', { tenant_id: 'T2' } as any);
    expect(repo.find.mock.calls.at(-1)![0].where.tenant_id).toBe('T1');
  });

  it('recomputes statuses after a correction and re-validates merged values', async () => {
    const { service } = setup(seed());
    expect(await service.update('A', 'T1', { soil_p_avail: 30 })).toMatchObject({ p_status: 'TINGGI' });
    await expect(service.update('A', 'T1', { soil_sand: 60 })).rejects.toBeInstanceOf(BadRequestException); // 60+35+40
    await expect(service.update('A', 'T1', { soil_sample_date: '2099-01-01' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('can detach a plant and checks a new one against the profile’s cluster', async () => {
    const { service } = setup([{ ...seed()[0], plant_id: 'P1' }]);
    await expect(service.update('A', 'T1', { plant_id: 'P9' })).rejects.toBeInstanceOf(NotFoundException);
    const res = await service.update('A', 'T1', { plant_id: '' });
    expect(res.plant_id).toBeNull();
  });

  it('404s across tenants for read, update and delete', async () => {
    const { service, stored } = setup(seed());
    await expect(service.findOne('B', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('B', 'T1', { soil_lab: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('B', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    expect(stored).toHaveLength(2);
  });

  it('deletes an own profile', async () => {
    const { service, stored } = setup(seed());
    await service.remove('A', 'T1');
    expect(stored.map((r) => r.soil_id)).toEqual(['B']);
  });
});

describe('SoilController roles', () => {
  const roles = (n: keyof SoilController) => [...Reflect.getMetadata(ROLES_KEY, SoilController.prototype[n])].sort();

  it.each(['create', 'update', 'remove'] as const)('%s: admin and tenant_admin only', (n) => {
    expect(roles(n)).toEqual(['admin', 'tenant_admin']);
  });

  it.each(['findAll', 'findOne'] as const)('%s: agronom may view, operator may not', (n) => {
    expect(roles(n)).toEqual(['admin', 'agronom', 'tenant_admin']);
  });
});
