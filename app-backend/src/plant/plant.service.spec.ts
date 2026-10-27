import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PlantService } from './plant.service';
import { Plant } from './entities/plant.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { PlantType } from '../ref/entities/plant-type.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';

const clusters = [
  { cluster_id: 'C1', tenant_id: 'T1', site_id: 'S1', cluster_name: 'Petak A' },
  { cluster_id: 'C2', tenant_id: 'T2', site_id: 'S2', cluster_name: 'Petak B' },
];

const phases = [
  { phase_id: 'PH-PADI-01', phase_code: 'SEMAI', phase_seq: 1, phase_start_age: -21, phase_end_age: 0 },
  { phase_id: 'PH-PADI-02', phase_code: 'VEG-AWAL', phase_seq: 2, phase_start_age: 0, phase_end_age: 10 },
  { phase_id: 'PH-PADI-05', phase_code: 'PRIMORDIA', phase_seq: 5, phase_start_age: 29, phase_end_age: 77 },
  { phase_id: 'PH-PADI-09', phase_code: 'KUNING', phase_seq: 9, phase_start_age: 77, phase_end_age: null },
];

const types = ['PUPUK-DASAR', 'PUPUK-S1', 'PUPUK-S2', 'BWD', 'DRAIN', 'PANEN'].map((s) => ({
  actype_id: `ACT-PD-${s}`,
  actype_name: s,
  unit_id: null,
}));

function setup(existingPlants: any[] = []) {
  const stored: any[] = existingPlants.map((p) => ({ ...p }));
  const inserted: { entity: unknown; rows: any }[] = [];
  const em = {
    insert: jest.fn(async (entity, rows) => {
      inserted.push({ entity, rows });
      if (entity === Plant) stored.push({ ...rows });
    }),
    save: jest.fn(async (_e, row) => row),
    update: jest.fn().mockResolvedValue({ affected: 3 }),
  };

  const repos = new Map<unknown, any>([
    [PlantVariety, { findOne: jest.fn(async ({ where }) => (where.var_id === 'VAR-PD-INPARI32' || where.var_id === 'VAR-PD-DEFAULT' ? { var_id: where.var_id, var_name: 'Inpari 32 HDB', var_maturity: 120 } : null)) }],
    [PlantType, { findOne: jest.fn().mockResolvedValue({ ptype_id: 'PT-PADI', ptype_density: 213333 }) }],
    [PlantPhase, { find: jest.fn().mockResolvedValue(phases), findOne: jest.fn(async ({ where }) => phases.find((p) => p.phase_id === where.phase_id) ?? null) }],
    [VarietyPhase, { find: jest.fn().mockResolvedValue([]) }],
    [ActivityType, { find: jest.fn().mockResolvedValue(types) }],
  ]);

  const manager = {
    findOne: jest.fn(async (entity, { where }) =>
      entity === Cluster ? clusters.find((c) => Object.entries(where).every(([k, v]) => (c as any)[k] === v)) ?? null : null,
    ),
    getRepository: (entity: unknown) => repos.get(entity),
    transaction: jest.fn(async (cb) => cb(em)),
  };

  const repo = {
    manager,
    create: jest.fn((x) => ({ ...x })),
    find: jest.fn(async ({ where }) => stored.filter((p) => Object.entries(where).every(([k, v]) => p[k] === v))),
    findOne: jest.fn(async ({ where }) => stored.find((p) => Object.entries(where).every(([k, v]) => p[k] === v)) ?? null),
    save: jest.fn(async (p) => p),
  };

  return { service: new PlantService(repo as any), repo, em, inserted, stored };
}

const dto = (over: Record<string, unknown> = {}): any => ({
  cluster_id: 'C1',
  var_id: 'VAR-PD-INPARI32',
  plant_season: 'MT2-2026',
  plant_sow_date: '2026-08-25',
  plant_date: '2026-09-15',
  plant_area: 2,
  ...over,
});

describe('PlantService.create', () => {
  it('creates the plant with tenant/site from the cluster and the template schedule in one transaction', async () => {
    const { service, em, inserted } = setup();
    const res = await service.create('T1', 'u1', dto());

    expect(res).toMatchObject({
      plant_id: 'C1_PLT1',
      tenant_id: 'T1',
      site_id: 'S1',
      cluster_id: 'C1',
      ptype_id: 'PT-PADI',
      var_id: 'VAR-PD-INPARI32',
      plant_variety: 'Inpari 32 HDB',
      plant_sts: 1,
      plant_phase_mode: 'AUTO',
      plant_name: 'Padi Petak A MT2 2026',
      schedules_created: 6,
      warnings: [],
    });
    expect(em.insert).toHaveBeenCalledTimes(2);
    expect(inserted.map((i) => i.entity)).toEqual([Plant, Schedule]);
    expect(inserted[1].rows).toHaveLength(6);
    expect(inserted[1].rows.every((s: any) => s.plant_id === 'C1_PLT1' && s.tenant_id === 'T1')).toBe(true);
  });

  it('defaults population to area x standard density (2 ha -> 426666 rumpun)', async () => {
    const { service } = setup();
    expect((await service.create('T1', 'u1', dto())).plant_count).toBe(426666);
    expect((await service.create('T1', 'u1', dto({ plant_count: 1000, plant_season: 'MT3-2026' }))).plant_count).toBe(1000);
  });

  it('falls back to the default variety when none is given', async () => {
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto({ var_id: undefined }));
    expect(res.var_id).toBe('VAR-PD-DEFAULT');
  });

  it('rejects an unknown or non-rice variety', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ var_id: 'VAR-SAWIT' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for a cluster of another tenant and writes nothing', async () => {
    const { service, em } = setup();
    await expect(service.create('T1', 'u1', dto({ cluster_id: 'C2' }))).rejects.toBeInstanceOf(NotFoundException);
    expect(em.insert).not.toHaveBeenCalled();
  });

  it('rejects a planting date before the sowing date', async () => {
    const { service, em } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_date: '2026-08-24' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(em.insert).not.toHaveBeenCalled();
  });

  it('accepts planting on the sowing day', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_date: '2026-08-25' }))).resolves.toBeDefined();
  });

  it('allows only one active plant per cluster per season', async () => {
    const { service } = setup([{ plant_id: 'C1_PLT1', cluster_id: 'C1', plant_season: 'MT2-2026', plant_sts: 1 }]);
    await expect(service.create('T1', 'u1', dto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows the same season again once the earlier plant is closed, and numbers it PLT2', async () => {
    const { service } = setup([{ plant_id: 'C1_PLT1', cluster_id: 'C1', plant_season: 'MT2-2026', plant_sts: 0 }]);
    const res = await service.create('T1', 'u1', dto());
    expect(res.plant_id).toBe('C1_PLT2');
  });

  it('numbers by the highest existing suffix, not by count or string order', async () => {
    const { service } = setup([
      { plant_id: 'C1_PLT2', cluster_id: 'C1', plant_season: 'MT1-2025', plant_sts: 0 },
      { plant_id: 'C1_PLT10', cluster_id: 'C1', plant_season: 'MT2-2025', plant_sts: 0 },
    ]);
    expect((await service.create('T1', 'u1', dto())).plant_id).toBe('C1_PLT11');
  });

  it('warns (without blocking) when the drawn polygon differs from the declared area', async () => {
    const side = 100 / 111_319.49;
    const geom = {
      type: 'Polygon',
      coordinates: [[[107, -6], [107 + side, -6], [107 + side, -6 - side], [107, -6 - side], [107, -6]]],
    };
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto({ plant_geom: geom, plant_area: 2 }));
    expect(res.warnings).toHaveLength(1);
    expect(JSON.parse(res.plant_geom)).toEqual(geom);
  });

  it('rejects an invalid polygon', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_geom: { type: 'Point', coordinates: [1, 2] } }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('PlantService.findOne / findAll', () => {
  const rows = [
    { plant_id: 'A', tenant_id: 'T1', cluster_id: 'C1', plant_sts: 1 },
    { plant_id: 'B', tenant_id: 'T2', cluster_id: 'C2', plant_sts: 1 },
  ];

  it('hides another tenant’s plant', async () => {
    const { service } = setup(rows);
    await expect(service.findOne('B', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne('A', 'T1')).resolves.toMatchObject({ plant_id: 'A' });
  });

  it('a global admin without scope sees any tenant', async () => {
    const { service } = setup(rows);
    await expect(service.findOne('B', undefined)).resolves.toMatchObject({ plant_id: 'B' });
  });

  it('scopes the list by tenant and applies filters', async () => {
    const { service, repo } = setup(rows);
    await service.findAll('T1', { clusterId: 'C1', season: 'MT2-2026', status: 1 });
    expect(repo.find).toHaveBeenLastCalledWith({
      where: { cluster_id: 'C1', plant_season: 'MT2-2026', plant_sts: 1, tenant_id: 'T1' },
      order: { plant_created: 'DESC' },
    });
  });

  it('a tenant_id smuggled through filters cannot widen the scope', async () => {
    const { service, repo } = setup(rows);
    await service.findAll('T1', { tenant_id: 'T2' } as any);
    expect(repo.find.mock.calls.at(-1)![0].where).toEqual({ tenant_id: 'T1' });
  });
});

describe('PlantService.update', () => {
  const active = () => ({ plant_id: 'A', tenant_id: 'T1', plant_sts: 1, plant_area: 2, plant_phase_mode: 'AUTO' });

  it('updates descriptive fields and stamps plant_update', async () => {
    const { service, repo } = setup([active()]);
    const res = await service.update('A', 'T1', { plant_name: 'Baru', plant_health: 'NORMAL' });
    expect(res).toMatchObject({ plant_name: 'Baru', plant_health: 'NORMAL', warnings: [] });
    expect(repo.save).toHaveBeenCalled();
  });

  it('refuses to change a closed plant', async () => {
    const { service } = setup([{ ...active(), plant_sts: 0 }]);
    await expect(service.update('A', 'T1', { plant_name: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for another tenant', async () => {
    const { service } = setup([{ ...active(), tenant_id: 'T2' }]);
    await expect(service.update('A', 'T1', { plant_name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only allows a manual phase when the mode is MANUAL', async () => {
    const { service } = setup([active()]);
    await expect(service.update('A', 'T1', { phase_id: 'PH-PADI-05' })).rejects.toBeInstanceOf(BadRequestException);

    const manual = await service.update('A', 'T1', { plant_phase_mode: 'MANUAL', phase_id: 'PH-PADI-05', plant_phase_date: '2026-10-19' });
    expect(manual).toMatchObject({ phase_id: 'PH-PADI-05', plant_phase_date: '2026-10-19' });
  });

  it('rejects a phase that does not exist for rice', async () => {
    const { service } = setup([{ ...active(), plant_phase_mode: 'MANUAL' }]);
    await expect(service.update('A', 'T1', { phase_id: 'PH-NOPE' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PlantService.close', () => {
  const active = () => ({ plant_id: 'A', tenant_id: 'T1', plant_sts: 1, plant_date: '2026-09-15' });

  it('closes the season, sets the harvest date and cancels open schedules in one transaction', async () => {
    const { service, em } = setup([active()]);
    const res = await service.close('A', 'T1', { plant_harvest_date: '2026-12-20' });

    expect(res).toMatchObject({ plant_sts: 0, plant_harvest_date: '2026-12-20', schedules_cancelled: 3 });
    const [entity, where, patch] = em.update.mock.calls[0];
    expect(entity).toBe(Schedule);
    expect(where.plant_id).toBe('A');
    expect(patch.sched_sts).toBe(3);
    // planned (0) and overdue (4) are cancelled; done (2) stays
    expect((where.sched_sts as any)._value).toEqual([0, 4]);
  });

  it('defaults the harvest date to today', async () => {
    const { service } = setup([active()]);
    const res = await service.close('A', 'T1', {});
    expect(res.plant_harvest_date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('refuses to close twice', async () => {
    const { service } = setup([{ ...active(), plant_sts: 0 }]);
    await expect(service.close('A', 'T1', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a harvest date before planting and writes nothing', async () => {
    const { service, em } = setup([active()]);
    await expect(service.close('A', 'T1', { plant_harvest_date: '2026-09-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(em.update).not.toHaveBeenCalled();
  });

  it('404s for another tenant', async () => {
    const { service } = setup([{ ...active(), tenant_id: 'T2' }]);
    await expect(service.close('A', 'T1', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
