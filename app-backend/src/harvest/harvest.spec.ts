import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HarvestService } from './harvest.service';
import { HarvestController } from './harvest.controller';
import { Harvest } from './entities/harvest.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Activity } from '../activity/entities/activity.entity';
import { computeHarvest, validateHarvest } from './harvest-rules';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('computeHarvest', () => {
  it('BR-13: GKP 6.000 kg at 25% moisture on 1 ha -> GKG 5.233 kg, 5.23 t/ha', () => {
    expect(computeHarvest(6000, 25, 1)).toEqual({ hv_weight_dry: 5233, hv_yield: 5.23 });
  });

  it('leaves weight unchanged at the 14% standard', () => {
    expect(computeHarvest(5000, 14, 1)).toEqual({ hv_weight_dry: 5000, hv_yield: 5 });
  });

  it('weighs more when drier than 14% (conversion is not clamped)', () => {
    expect(computeHarvest(5000, 10, 1).hv_weight_dry).toBe(5233);
  });

  it('divides by the harvested area', () => {
    expect(computeHarvest(12000, 25, 2)).toEqual({ hv_weight_dry: 10465, hv_yield: 5.23 });
    expect(computeHarvest(6000, 25, 0.5).hv_yield).toBe(10.47);
  });
});

describe('validateHarvest', () => {
  const ok = { weight: 6000, moisture: 25, area: 1, plantArea: 2 };

  it('accepts a valid harvest', () => expect(() => validateHarvest(ok)).not.toThrow());

  it.each([0, -5])('rejects weight %s', (weight) => {
    expect(() => validateHarvest({ ...ok, weight })).toThrow(/GKP/);
  });

  it.each([4.9, 40.1, 0, 100])('rejects moisture %s', (moisture) => {
    expect(() => validateHarvest({ ...ok, moisture })).toThrow(/Kadar air/);
  });

  it.each([5, 14, 40])('accepts moisture %s', (moisture) => {
    expect(() => validateHarvest({ ...ok, moisture })).not.toThrow();
  });

  it('rejects zero area and area beyond the plant (10% tolerance)', () => {
    expect(() => validateHarvest({ ...ok, area: 0 })).toThrow(/Luas dipanen/);
    expect(() => validateHarvest({ ...ok, area: 2.2 })).not.toThrow();
    expect(() => validateHarvest({ ...ok, area: 2.21 })).toThrow(/melebihi/);
  });

  it('reports every problem at once', () => {
    try {
      validateHarvest({ weight: 0, moisture: 99, area: 0 });
      fail('should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(e.message.split('; ')).toHaveLength(3);
    }
  });
});

const plants: any[] = [
  { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', plant_date: '2026-09-15', plant_area: 2, plant_season: 'MT2-2026', plant_sts: 1 },
  { plant_id: 'P2', tenant_id: 'T2', site_id: 'S2', cluster_id: 'C2', plant_date: '2026-09-15', plant_area: 1, plant_season: 'MT2-2026', plant_sts: 1 },
  { plant_id: 'P3', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C3', plant_date: '2026-01-20', plant_area: 1, plant_season: 'MT1-2026', plant_sts: 0 },
];
const activities: any[] = [
  { pact_id: 'A1', tenant_id: 'T1', plant_id: 'P1' },
  { pact_id: 'A2', tenant_id: 'T1', plant_id: 'P3' },
];

const eq = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && '_type' in v ? true : row[k] === v));

function setup(seed: any[] = []) {
  const stored = seed.map((r) => ({ ...r }));
  const repo = {
    manager: {
      findOne: jest.fn(async (entity, { where }) => {
        const list = entity === Plant ? plants : entity === Activity ? activities : [];
        return list.find((r) => eq(r, where)) ?? null;
      }),
      getRepository: () => ({ findOne: jest.fn(async ({ where }) => plants.find((p) => eq(p, where)) ?? null) }),
    },
    create: jest.fn((x) => ({ ...x })),
    insert: jest.fn(async (row) => stored.push({ ...row })),
    find: jest.fn(async ({ where }) => stored.filter((r) => eq(r, where)).map((r) => ({ ...r }))),
    findOne: jest.fn(async ({ where }) => {
      const r = stored.find((s) => eq(s, where));
      return r ? { ...r } : null;
    }),
    save: jest.fn(async (r) => r),
    delete: jest.fn(async ({ hv_id }) => {
      const i = stored.findIndex((s) => s.hv_id === hv_id);
      if (i >= 0) stored.splice(i, 1);
    }),
  };
  return { service: new HarvestService(repo as any), repo, stored };
}

const dto = (over: Record<string, unknown> = {}): any => ({
  plant_id: 'P1',
  hv_date: '2026-10-20',
  hv_weight: 6000,
  hv_moisture: 25,
  hv_area: 1,
  ...over,
});

describe('HarvestService.create', () => {
  it('records a harvest with computed GKG and t/ha plus plant data', async () => {
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto());
    expect(res).toMatchObject({
      hv_id: 'P1_HV1',
      tenant_id: 'T1',
      site_id: 'S1',
      cluster_id: 'C1',
      plant_id: 'P1',
      hv_season: 'MT2-2026',
      hv_rotation: 1,
      hv_area: 1,
      hv_weight: 6000,
      hv_moisture: 25,
      hv_weight_dry: 5233,
      hv_yield: 5.23,
      hv_source: 'WEB',
      hv_sts: 1,
      user_id: 'u1',
    });
  });

  it('defaults the harvested area to the plant area', async () => {
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto({ hv_area: undefined, hv_weight: 12000 }));
    expect(res).toMatchObject({ hv_area: 2, hv_weight_dry: 10465, hv_yield: 5.23 });
  });

  it('numbers rotation and id by existing harvests', async () => {
    const { service } = setup([{ hv_id: 'P1_HV1', plant_id: 'P1' }, { hv_id: 'P1_HV4', plant_id: 'P1' }]);
    expect(await service.create('T1', 'u1', dto())).toMatchObject({ hv_id: 'P1_HV5', hv_rotation: 3 });
  });

  it('404s for another tenant’s plant and writes nothing', async () => {
    const { service, repo } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P2' }))).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('still allows a late entry on a closed season', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P3', hv_date: '2026-05-01' }))).resolves.toBeDefined();
  });

  it.each([
    ['before planting', { hv_date: '2026-09-14' }],
    ['in the future', { hv_date: '2099-01-01' }],
    ['impossible', { hv_date: '2026-02-31' }],
    ['bad moisture', { hv_moisture: 60 }],
    ['area beyond the plant', { hv_area: 5 }],
  ])('rejects a harvest %s', async (_n, over) => {
    const { service, repo } = setup();
    await expect(service.create('T1', 'u1', dto(over))).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('links an activity of the same plant and tenant only', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ pact_id: 'A1' }))).resolves.toMatchObject({ pact_id: 'A1' });
    await expect(service.create('T1', 'u1', dto({ pact_id: 'A2' }))).rejects.toBeInstanceOf(NotFoundException); // other plant
    await expect(service.create('T1', 'u1', dto({ pact_id: 'NOPE' }))).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HarvestService read, update, remove', () => {
  const seed = () => [
    { hv_id: 'H1', tenant_id: 'T1', plant_id: 'P1', hv_date: '2026-10-20', hv_weight: 6000, hv_moisture: 25, hv_area: 1 },
    { hv_id: 'H2', tenant_id: 'T2', plant_id: 'P2', hv_date: '2026-10-20', hv_weight: 1, hv_moisture: 14, hv_area: 1 },
  ];

  it('lists only the tenant’s harvests; a global admin without scope sees all', async () => {
    const { service } = setup(seed());
    expect((await service.findAll('T1')).map((r) => r.hv_id)).toEqual(['H1']);
    expect(await service.findAll(undefined)).toHaveLength(2);
  });

  it('a tenant_id smuggled through filters cannot widen the scope', async () => {
    const { service, repo } = setup(seed());
    await service.findAll('T1', { tenant_id: 'T2' } as any);
    expect(repo.find.mock.calls.at(-1)![0].where.tenant_id).toBe('T1');
  });

  it('recomputes GKG and yield when a value is corrected', async () => {
    const { service } = setup(seed());
    const res = await service.update('H1', 'T1', { hv_moisture: 14 });
    expect(res).toMatchObject({ hv_weight_dry: 6000, hv_yield: 6 });
  });

  it('re-validates merged values on update', async () => {
    const { service } = setup(seed());
    await expect(service.update('H1', 'T1', { hv_moisture: 70 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('H1', 'T1', { hv_area: 9 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('H1', 'T1', { hv_date: '2026-09-01' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s across tenants for read, update and delete', async () => {
    const { service, stored } = setup(seed());
    await expect(service.findOne('H2', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('H2', 'T1', { hv_weight: 5 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('H2', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    expect(stored).toHaveLength(2);
  });

  it('deletes an own harvest', async () => {
    const { service, stored } = setup(seed());
    await service.remove('H1', 'T1');
    expect(stored.map((r) => r.hv_id)).toEqual(['H2']);
  });
});

describe('HarvestController roles', () => {
  it.each(['create', 'update', 'remove'] as const)('%s allows admin, tenant_admin and operator but not agronom', (name) => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, HarvestController.prototype[name]);
    expect([...roles].sort()).toEqual(['admin', 'operator', 'tenant_admin']);
  });
});
