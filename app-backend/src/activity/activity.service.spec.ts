import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { Activity } from './entities/activity.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Media } from '../media/entities/media.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { Material } from '../ref/entities/material.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { Unit } from '../unit/entities/unit.entity';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ActivityController } from './activity.controller';

const phases = [
  { phase_id: 'PH-PADI-02', phase_seq: 2, phase_start_age: 0, phase_end_age: 29 },
  { phase_id: 'PH-PADI-05', phase_seq: 5, phase_start_age: 29, phase_end_age: null },
];

const plants: any[] = [
  { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', plant_date: '2026-09-15', plant_area: 2, plant_sts: 1, plant_phase_mode: 'AUTO' },
  { plant_id: 'P2', tenant_id: 'T2', site_id: 'S2', cluster_id: 'C2', plant_date: '2026-09-15', plant_area: 1, plant_sts: 1 },
  { plant_id: 'P3', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C3', plant_date: '2026-01-01', plant_area: 1, plant_sts: 0 },
  { plant_id: 'P4', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C4', plant_date: '2026-09-15', plant_area: 1, plant_sts: 1, plant_phase_mode: 'MANUAL', phase_id: 'PH-PADI-05' },
];

const types: Record<string, any> = {
  'ACT-PD-PUPUK-S1': { actype_id: 'ACT-PD-PUPUK-S1', actype_category: 'PEMUPUKAN', unit_id: 'UNIT-KG', ptype_id: 'PT-PADI', actype_need_photo: 1, actype_sts: 1 },
  'ACT-PD-GULMA': { actype_id: 'ACT-PD-GULMA', actype_category: 'PERAWATAN', unit_id: 'UNIT-HA', ptype_id: 'PT-PADI', actype_need_photo: 0, actype_sts: 1 },
  'ACT-PD-HERBISIDA': { actype_id: 'ACT-PD-HERBISIDA', actype_category: 'PROTEKSI', unit_id: 'UNIT-L', ptype_id: 'PT-PADI', actype_need_photo: 0, actype_sts: 1 },
  'ACT-PANEN-TBS': { actype_id: 'ACT-PANEN-TBS', actype_category: 'PANEN', unit_id: null, ptype_id: 'PT-SAWIT', actype_need_photo: 0, actype_sts: 1 },
};

const materials: Record<string, any> = {
  'MAT-UREA': { mat_id: 'MAT-UREA', mat_name: 'Urea', mat_n: 46, mat_sts: 1 },
  'MAT-OFF': { mat_id: 'MAT-OFF', mat_name: 'Off', mat_sts: 0 },
};

const units = new Set(['UNIT-KG', 'UNIT-HA', 'UNIT-L']);

const eq = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && '_type' in v) {
      if (v._type === 'in') return v._value.includes(row[k]);
      if (v._type === 'isNull') return row[k] === null || row[k] === undefined;
      return true;
    }
    return row[k] === v;
  });

function setup(seed: any[] = [], media: any[] = [], schedules: any[] = []) {
  const stored = seed.map((r) => ({ ...r }));
  const mediaRows = media.map((r) => ({ ...r }));
  const schedRows = schedules.map((r) => ({ ...r }));
  const tx = {
    inserts: [] as any[],
    updates: [] as { entity: unknown; where: any; patch: any }[],
  };
  const em = {
    insert: jest.fn(async (entity, row) => {
      tx.inserts.push({ entity, row });
      if (entity === Activity) stored.push({ ...row });
    }),
    update: jest.fn(async (entity, where, patch) => {
      tx.updates.push({ entity, where, patch });
      const list = entity === Schedule ? schedRows : entity === Media ? mediaRows : [];
      list.filter((r) => eq(r, where)).forEach((r) => Object.assign(r, patch));
    }),
    delete: jest.fn(async (_e, where) => {
      const i = stored.findIndex((r) => eq(r, where));
      if (i >= 0) stored.splice(i, 1);
    }),
    count: jest.fn(async (_e, { where }) => stored.filter((r) => eq(r, where)).length),
  };

  const repos = new Map<unknown, any>([
    [ActivityType, { findOne: jest.fn(async ({ where }) => types[where.actype_id] ?? null) }],
    [Material, {
      findOne: jest.fn(async ({ where }) => materials[where.mat_id] ?? null),
      find: jest.fn(async ({ where }) => Object.values(materials).filter((m) => where.mat_id._value.includes(m.mat_id))),
    }],
    [Unit, { findOne: jest.fn(async ({ where }) => (units.has(where.unit_id) ? { unit_id: where.unit_id } : null)) }],
    [PlantPhase, { find: jest.fn().mockResolvedValue(phases) }],
    [Plant, {
      findOne: jest.fn(async ({ where }) => plants.find((p) => eq(p, where)) ?? null),
      find: jest.fn(async ({ where }) => plants.filter((p) => eq(p, where))),
    }],
    [Media, { find: jest.fn(async ({ where }) => mediaRows.filter((m) => eq(m, where))) }],
  ]);

  const manager = {
    findOne: jest.fn(async (entity, { where }) => {
      const list = entity === Plant ? plants : entity === Schedule ? schedRows : [];
      return list.find((r) => eq(r, where)) ?? null;
    }),
    getRepository: (e: unknown) => repos.get(e),
    transaction: jest.fn(async (cb) => cb(em)),
  };

  const repo = {
    manager,
    create: jest.fn((x) => ({ ...x })),
    find: jest.fn(async ({ where }) => stored.filter((r) => eq(r, where)).map((r) => ({ ...r }))),
    findOne: jest.fn(async ({ where }) => {
      const r = stored.find((s) => eq(s, where));
      return r ? { ...r } : null;
    }),
    save: jest.fn(async (r) => {
      const i = stored.findIndex((s) => s.pact_id === r.pact_id);
      if (i >= 0) stored[i] = { ...stored[i], ...r };
      return r;
    }),
  };
  return { service: new ActivityService(repo as any), repo, em, tx, stored, mediaRows, schedRows };
}

const dto = (over: Record<string, unknown> = {}): any => ({
  plant_id: 'P1',
  actype_id: 'ACT-PD-PUPUK-S1',
  pact_date: '2026-09-29T09:00',
  pact_value: '150',
  mat_id: 'MAT-UREA',
  media_ids: ['M1'],
  ...over,
});

const mediaSeed = () => [{ media_id: 'M1', tenant_id: 'T1', pact_id: null }];
const schedSeed = () => [{ sched_id: 'SC1', tenant_id: 'T1', plant_id: 'P1', sched_sts: 0 }];

describe('ActivityService.create', () => {
  it('records a fertiliser activity with computed nutrients, phase, defaults and linked photo', async () => {
    const { service, tx } = setup([], mediaSeed());
    const res = await service.create('T1', 'u1', dto());
    expect(res).toMatchObject({
      pact_id: 'P1_ACT1',
      tenant_id: 'T1',
      site_id: 'S1',
      cluster_id: 'C1',
      plant_id: 'P1',
      actype_id: 'ACT-PD-PUPUK-S1',
      phase_id: 'PH-PADI-02', // HST 14
      unit_id: 'UNIT-KG',
      mat_id: 'MAT-UREA',
      pact_material: 'Urea',
      pact_source: 'WEB',
      pact_sts: 1,
      pact_date: '2026-09-29 09:00:00',
      user_id: 'u1',
    });
    expect(res.nutrient_input).toEqual({ n_kg_ha: 34.5, p2o5_kg_ha: 0, k2o_kg_ha: 0 });
    const mediaUpdate = tx.updates.find((u) => u.entity === Media)!;
    expect(mediaUpdate.patch).toEqual({ pact_id: 'P1_ACT1', plant_id: 'P1' });
  });

  it('uses the plant’s manual phase when the mode is MANUAL', async () => {
    const { service } = setup([], mediaSeed());
    expect((await service.create('T1', 'u1', dto({ plant_id: 'P4' }))).phase_id).toBe('PH-PADI-05');
  });

  it('404s for another tenant’s plant, rejects a closed season, and writes nothing', async () => {
    const { service, em } = setup([], mediaSeed());
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P2' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P3' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(em.insert).not.toHaveBeenCalled();
  });

  it('rejects a non-rice or unknown activity type', async () => {
    const { service } = setup([], mediaSeed());
    await expect(service.create('T1', 'u1', dto({ actype_id: 'ACT-PANEN-TBS' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('T1', 'u1', dto({ actype_id: 'ACT-NOPE' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('material and amount (PEMUPUKAN / PROTEKSI)', () => {
    it('requires a material', async () => {
      const { service, em } = setup([], mediaSeed());
      await expect(service.create('T1', 'u1', dto({ mat_id: undefined }))).rejects.toBeInstanceOf(BadRequestException);
      expect(em.insert).not.toHaveBeenCalled();
    });

    it.each([undefined, '', '0', '-3', 'banyak'])('requires a positive numeric amount (got %p)', async (value) => {
      const { service } = setup([], mediaSeed());
      await expect(service.create('T1', 'u1', dto({ pact_value: value }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown or inactive material', async () => {
      const { service } = setup([], mediaSeed());
      await expect(service.create('T1', 'u1', dto({ mat_id: 'MAT-NOPE' }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('T1', 'u1', dto({ mat_id: 'MAT-OFF' }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires them for PROTEKSI too', async () => {
      const { service } = setup();
      await expect(service.create('T1', 'u1', dto({ actype_id: 'ACT-PD-HERBISIDA', mat_id: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.create('T1', 'u1', dto({ actype_id: 'ACT-PD-HERBISIDA', mat_id: 'MAT-UREA', pact_value: '2', media_ids: undefined })),
      ).resolves.toBeDefined();
    });

    it('does not require them for other categories, and gives no nutrients', async () => {
      const { service } = setup();
      const res = await service.create('T1', 'u1', dto({ actype_id: 'ACT-PD-GULMA', mat_id: undefined, pact_value: undefined, media_ids: undefined }));
      expect(res).toMatchObject({ unit_id: 'UNIT-HA', nutrient_input: null });
    });

    it('rejects an unknown unit', async () => {
      const { service } = setup([], mediaSeed());
      await expect(service.create('T1', 'u1', dto({ unit_id: 'UNIT-NOPE' }))).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('photo', () => {
    it('is required when the activity type demands one', async () => {
      const { service } = setup();
      await expect(service.create('T1', 'u1', dto({ media_ids: undefined }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('T1', 'u1', dto({ media_ids: [] }))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('must be an unused upload of the same tenant', async () => {
      const { service, em } = setup([], [
        { media_id: 'M1', tenant_id: 'T1', pact_id: 'OTHER_ACT' },
        { media_id: 'M2', tenant_id: 'T2', pact_id: null },
      ]);
      await expect(service.create('T1', 'u1', dto({ media_ids: ['M1'] }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('T1', 'u1', dto({ media_ids: ['M2'] }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('T1', 'u1', dto({ media_ids: ['NOPE'] }))).rejects.toBeInstanceOf(BadRequestException);
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('deduplicates repeated ids', async () => {
      const { service } = setup([], mediaSeed());
      await expect(service.create('T1', 'u1', dto({ media_ids: ['M1', 'M1'] }))).resolves.toBeDefined();
    });
  });

  describe('schedule link', () => {
    it('marks the schedule done in the same transaction', async () => {
      const { service, tx, schedRows } = setup([], mediaSeed(), schedSeed());
      await service.create('T1', 'u1', dto({ sched_id: 'SC1' }));
      expect(schedRows[0].sched_sts).toBe(2);
      expect(tx.updates.find((u) => u.entity === Schedule)!.where).toEqual({ sched_id: 'SC1' });
    });

    it('rejects a schedule of another plant/tenant, or one already done or cancelled', async () => {
      const { service, em } = setup([], mediaSeed(), [
        { sched_id: 'SC1', tenant_id: 'T1', plant_id: 'P4', sched_sts: 0 },
        { sched_id: 'SC2', tenant_id: 'T1', plant_id: 'P1', sched_sts: 2 },
        { sched_id: 'SC3', tenant_id: 'T1', plant_id: 'P1', sched_sts: 3 },
      ]);
      await expect(service.create('T1', 'u1', dto({ sched_id: 'SC1' }))).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.create('T1', 'u1', dto({ sched_id: 'SC2' }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('T1', 'u1', dto({ sched_id: 'SC3' }))).rejects.toBeInstanceOf(BadRequestException);
      expect(em.insert).not.toHaveBeenCalled();
    });

    it('accepts an overdue schedule (stored 4)', async () => {
      const { service } = setup([], mediaSeed(), [{ sched_id: 'SC1', tenant_id: 'T1', plant_id: 'P1', sched_sts: 4 }]);
      await expect(service.create('T1', 'u1', dto({ sched_id: 'SC1' }))).resolves.toBeDefined();
    });
  });

  it('numbers by the highest existing suffix', async () => {
    const { service } = setup([{ pact_id: 'P1_ACT2', plant_id: 'P1' }, { pact_id: 'P1_ACT10', plant_id: 'P1' }], mediaSeed());
    expect((await service.create('T1', 'u1', dto())).pact_id).toBe('P1_ACT11');
  });
});

describe('ActivityService.findAll / findOne', () => {
  const rows = () => [
    { pact_id: 'A1', tenant_id: 'T1', plant_id: 'P1', mat_id: 'MAT-UREA', pact_value: '150', unit_id: 'UNIT-KG', pact_date: '2026-09-29 09:00:00' },
    { pact_id: 'A2', tenant_id: 'T1', plant_id: 'P1', pact_value: '2', unit_id: 'UNIT-HA', pact_date: '2026-09-20 09:00:00' },
    { pact_id: 'A3', tenant_id: 'T2', plant_id: 'P2', pact_date: '2026-09-20 09:00:00' },
  ];

  it('is scoped to the tenant and adds nutrient_input from material and plant area', async () => {
    const { service } = setup(rows());
    const list = await service.findAll('T1');
    expect(list.map((r) => r.pact_id).sort()).toEqual(['A1', 'A2']);
    expect(list.find((r) => r.pact_id === 'A1')!.nutrient_input).toEqual({ n_kg_ha: 34.5, p2o5_kg_ha: 0, k2o_kg_ha: 0 });
    expect(list.find((r) => r.pact_id === 'A2')!.nutrient_input).toBeNull();
  });

  it('a global admin without scope sees every tenant', async () => {
    const { service } = setup(rows());
    expect(await service.findAll(undefined)).toHaveLength(3);
  });

  it('a tenant_id smuggled through filters cannot widen the scope', async () => {
    const { service, repo } = setup(rows());
    await service.findAll('T1', { tenant_id: 'T2' } as any);
    expect(repo.find.mock.calls.at(-1)![0].where.tenant_id).toBe('T1');
  });

  it('findOne hides another tenant’s activity', async () => {
    const { service } = setup(rows());
    await expect(service.findOne('A3', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne('A1', 'T1')).resolves.toMatchObject({ pact_id: 'A1' });
  });
});

describe('ActivityService.update', () => {
  const seed = () => [
    { pact_id: 'A1', tenant_id: 'T1', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK-S1', mat_id: 'MAT-UREA', pact_value: '150', unit_id: 'UNIT-KG', pact_date: '2026-09-29 09:00:00' },
  ];

  it('changes the amount and recomputes the nutrients', async () => {
    const { service } = setup(seed());
    const res = await service.update('A1', 'T1', { pact_value: '300' });
    expect(res.nutrient_input!.n_kg_ha).toBe(69);
  });

  it('re-derives the phase when the date moves', async () => {
    const { service } = setup(seed());
    expect((await service.update('A1', 'T1', { pact_date: '2026-10-20T08:00' })).phase_id).toBe('PH-PADI-05');
  });

  it('keeps the category rules (cannot blank the amount)', async () => {
    const { service } = setup(seed());
    await expect(service.update('A1', 'T1', { pact_value: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for another tenant and rejects a closed season', async () => {
    const other = setup([{ ...seed()[0], tenant_id: 'T2' }]);
    await expect(other.service.update('A1', 'T1', { pact_desc: 'x' })).rejects.toBeInstanceOf(NotFoundException);

    const closed = setup([{ ...seed()[0], plant_id: 'P3' }]);
    await expect(closed.service.update('A1', 'T1', { pact_desc: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ActivityService.remove', () => {
  const seed = () => [{ pact_id: 'A1', tenant_id: 'T1', plant_id: 'P1', sched_id: 'SC1' }];

  it('deletes, unlinks photos and reopens the schedule', async () => {
    const { service, stored, mediaRows, schedRows } = setup(
      seed(),
      [{ media_id: 'M1', tenant_id: 'T1', pact_id: 'A1' }],
      [{ sched_id: 'SC1', tenant_id: 'T1', plant_id: 'P1', sched_sts: 2 }],
    );
    await service.remove('A1', 'T1');
    expect(stored).toHaveLength(0);
    expect(mediaRows[0].pact_id).toBeNull();
    expect(schedRows[0].sched_sts).toBe(0);
  });

  it('keeps the schedule done while another activity still fulfils it', async () => {
    const { service, schedRows } = setup(
      [...seed(), { pact_id: 'A2', tenant_id: 'T1', plant_id: 'P1', sched_id: 'SC1' }],
      [],
      [{ sched_id: 'SC1', tenant_id: 'T1', plant_id: 'P1', sched_sts: 2 }],
    );
    await service.remove('A1', 'T1');
    expect(schedRows[0].sched_sts).toBe(2);
  });

  it('turns a foreign-key error (e.g. a harvest uses it) into 409', async () => {
    const { service, em } = setup(seed());
    em.delete.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'ER_ROW_IS_REFERENCED_2' }));
    await expect(service.remove('A1', 'T1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s for another tenant', async () => {
    const { service } = setup([{ ...seed()[0], tenant_id: 'T2' }]);
    await expect(service.remove('A1', 'T1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ActivityController roles', () => {
  it.each(['create', 'update', 'remove'] as const)('%s allows admin, tenant_admin and operator but not agronom', (name) => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, ActivityController.prototype[name]);
    expect([...roles].sort()).toEqual(['admin', 'operator', 'tenant_admin']);
  });
});
