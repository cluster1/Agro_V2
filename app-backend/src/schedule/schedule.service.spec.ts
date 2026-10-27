import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ScheduleController } from './schedule.controller';
import { ScheduleService, effectiveStatus, normalizeDateTime } from './schedule.service';
import { Plant } from '../plant/entities/plant.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';

const phases = [
  { phase_id: 'PH-PADI-02', phase_seq: 2, phase_start_age: 0, phase_end_age: 29 },
  { phase_id: 'PH-PADI-05', phase_seq: 5, phase_start_age: 29, phase_end_age: null },
];

const plants = [
  { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', plant_date: '2026-09-15', plant_sts: 1 },
  { plant_id: 'P2', tenant_id: 'T2', site_id: 'S2', cluster_id: 'C2', plant_date: '2026-09-15', plant_sts: 1 },
  { plant_id: 'P3', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C3', plant_date: '2026-01-01', plant_sts: 0 },
];

const types: Record<string, any> = {
  'ACT-PD-PUPUK-S1': { actype_id: 'ACT-PD-PUPUK-S1', actype_name: 'Pemupukan Susulan I', unit_id: 'UNIT-KG', ptype_id: 'PT-PADI', actype_sts: 1 },
  'ACT-PD-BWD': { actype_id: 'ACT-PD-BWD', actype_name: 'BWD', unit_id: null, ptype_id: 'PT-PADI', actype_sts: 1 },
  'ACT-PUPUK': { actype_id: 'ACT-PUPUK', actype_name: 'Pemupukan', unit_id: 'UNIT-KG', ptype_id: null, actype_sts: 1 },
  'ACT-PANEN-TBS': { actype_id: 'ACT-PANEN-TBS', actype_name: 'Panen TBS', unit_id: null, ptype_id: 'PT-SAWIT', actype_sts: 1 },
  'ACT-OFF': { actype_id: 'ACT-OFF', actype_name: 'Off', unit_id: null, ptype_id: null, actype_sts: 0 },
};

const row = (over: Record<string, unknown> = {}) => ({
  sched_id: 'S1',
  tenant_id: 'T1',
  plant_id: 'P1',
  actype_id: 'ACT-PD-PUPUK-S1',
  sched_title: 'Pemupukan Susulan I',
  sched_start_date: '2099-01-01 08:00:00',
  sched_end_date: '2099-01-01 17:00:00',
  sched_repeat: 'NONE',
  sched_sts: 0,
  ...over,
});

function setup(seed: any[] = []) {
  const stored = seed.map((r) => ({ ...r }));
  const matches = (r: any, where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && 'type' in v ? true : r[k] === v));
  const repo = {
    manager: {
      findOne: jest.fn(async (entity, { where }) =>
        entity === Plant ? plants.find((p) => Object.entries(where).every(([k, v]) => (p as any)[k] === v)) ?? null : null,
      ),
      getRepository: (entity: unknown) =>
        entity === ActivityType
          ? { findOne: jest.fn(async ({ where }) => types[where.actype_id] ?? null) }
          : entity === PlantPhase
            ? { find: jest.fn().mockResolvedValue(phases) }
            : undefined,
    },
    create: jest.fn((x) => ({ ...x })),
    save: jest.fn(async (r) => {
      const i = stored.findIndex((s) => s.sched_id === r.sched_id);
      if (i >= 0) stored[i] = { ...stored[i], ...r };
      else stored.push({ ...r });
      return r;
    }),
    find: jest.fn(async ({ where }) => stored.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
    findOne: jest.fn(async ({ where }) => {
      const r = stored.find((s) => matches(s, where));
      return r ? { ...r } : null;
    }),
    delete: jest.fn(async ({ sched_id }) => {
      const i = stored.findIndex((s) => s.sched_id === sched_id);
      if (i >= 0) stored.splice(i, 1);
    }),
  };
  return { service: new ScheduleService(repo as any), repo, stored };
}

const dto = (over: Record<string, unknown> = {}): any => ({
  plant_id: 'P1',
  actype_id: 'ACT-PD-PUPUK-S1',
  sched_start_date: '2026-09-29T08:00',
  sched_end_date: '2026-09-29T17:00',
  ...over,
});

describe('normalizeDateTime', () => {
  it.each([
    ['2026-09-29T08:00', '2026-09-29 08:00:00'],
    ['2026-09-29 08:00:00', '2026-09-29 08:00:00'],
    ['2026-09-29T23:59:59', '2026-09-29 23:59:59'],
  ])('%s -> %s', (input, expected) => expect(normalizeDateTime(input, 'x')).toBe(expected));

  it.each(['2026-02-31T08:00', '2026-09-29T24:00', '2026-09-29T08:60', '2026-13-01T08:00'])('rejects %s', (bad) => {
    expect(() => normalizeDateTime(bad, 'x')).toThrow(BadRequestException);
  });
});

describe('effectiveStatus', () => {
  const now = new Date('2026-10-01T00:00:00');
  it('turns planned into overdue once the end passed', () => {
    expect(effectiveStatus({ sched_sts: 0, sched_end_date: '2026-09-30 23:59:59' }, now)).toBe(4);
    expect(effectiveStatus({ sched_sts: 0, sched_end_date: new Date('2026-09-30T23:59:59') }, now)).toBe(4);
  });
  it('keeps planned while the end is in the future', () => {
    expect(effectiveStatus({ sched_sts: 0, sched_end_date: '2026-10-02 00:00:00' }, now)).toBe(0);
  });
  it('never touches done or cancelled', () => {
    expect(effectiveStatus({ sched_sts: 2, sched_end_date: '2020-01-01 00:00:00' }, now)).toBe(2);
    expect(effectiveStatus({ sched_sts: 3, sched_end_date: '2020-01-01 00:00:00' }, now)).toBe(3);
  });
});

describe('ScheduleService.create', () => {
  it('creates a MANUAL planned schedule with defaults from plant and activity type', async () => {
    const { service, stored } = setup();
    const res = await service.create('T1', 'u1', dto());
    expect(res).toMatchObject({
      tenant_id: 'T1',
      site_id: 'S1',
      cluster_id: 'C1',
      plant_id: 'P1',
      actype_id: 'ACT-PD-PUPUK-S1',
      sched_title: 'Pemupukan Susulan I',
      unit_id: 'UNIT-KG',
      sched_source: 'MANUAL',
      sched_repeat: 'NONE',
      sched_start_date: '2026-09-29 08:00:00',
      sched_end_date: '2026-09-29 17:00:00',
      user_id: 'u1',
      phase_id: 'PH-PADI-02', // HST 14 falls in the generic 0-29 range
    } as any);
    expect(stored).toHaveLength(1);
  });

  it('picks the generic phase at the start date (HST 14 vs HST 30)', async () => {
    const { service } = setup();
    expect((await service.create('T1', 'u1', dto())).phase_id).toBe('PH-PADI-02');
    expect(
      (await service.create('T1', 'u1', dto({ sched_start_date: '2026-10-15T08:00', sched_end_date: '2026-10-15T09:00' }))).phase_id,
    ).toBe('PH-PADI-05');
  });

  it('404s for another tenant’s plant and rejects a closed season', async () => {
    const { service, stored } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P2' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P3' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(stored).toHaveLength(0);
  });

  it.each(['ACT-NOPE', 'ACT-OFF', 'ACT-PANEN-TBS'])('rejects activity type %s', async (id) => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ actype_id: id }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a generic (null ptype) activity type', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ actype_id: 'ACT-PUPUK' }))).resolves.toBeDefined();
  });

  it('rejects an end before the start, accepts equal', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ sched_end_date: '2026-09-29T07:59' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('T1', 'u1', dto({ sched_end_date: '2026-09-29T08:00' }))).resolves.toBeDefined();
  });

  describe('repeat', () => {
    it('needs interval and end date', async () => {
      const { service } = setup();
      await expect(service.create('T1', 'u1', dto({ sched_repeat: 'WEEKLY' }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('T1', 'u1', dto({ sched_repeat: 'WEEKLY', sched_interval: 1 }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create('T1', 'u1', dto({ sched_repeat: 'WEEKLY', sched_interval: 1, sched_repeat_until: '2026-09-01' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stores a valid recurrence and drops interval/until for NONE', async () => {
      const { service } = setup();
      const weekly = await service.create(
        'T1',
        'u1',
        dto({ sched_repeat: 'WEEKLY', sched_interval: 1, sched_repeat_until: '2026-11-16' }),
      );
      expect(weekly).toMatchObject({ sched_repeat: 'WEEKLY', sched_interval: 1, sched_repeat_until: '2026-11-16' });

      const once = await service.create('T1', 'u1', dto({ sched_interval: 3, sched_repeat_until: '2026-11-16' }));
      expect(once.sched_interval).toBeUndefined();
      expect(once.sched_repeat_until).toBeUndefined();
    });
  });
});

describe('ScheduleService.findAll', () => {
  const seed = () => [
    row({ sched_id: 'A', sched_sts: 0, sched_end_date: '2099-01-01 17:00:00' }),
    row({ sched_id: 'B', sched_sts: 0, sched_end_date: '2020-01-01 17:00:00' }), // stored planned, past -> overdue
    row({ sched_id: 'C', sched_sts: 2 }),
    row({ sched_id: 'D', sched_sts: 3 }),
    row({ sched_id: 'E', tenant_id: 'T2' }),
  ];

  it('is scoped to the tenant (a global admin without scope sees all)', async () => {
    const { service } = setup(seed());
    expect((await service.findAll('T1')).map((r) => r.sched_id).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(await service.findAll(undefined)).toHaveLength(5);
  });

  it('reports overdue as status 4 and filters by the effective status', async () => {
    const { service } = setup(seed());
    expect((await service.findAll('T1')).find((r) => r.sched_id === 'B')!.sched_sts).toBe(4);
    expect((await service.findAll('T1', { status: 4 })).map((r) => r.sched_id)).toEqual(['B']);
    expect((await service.findAll('T1', { status: 0 })).map((r) => r.sched_id)).toEqual(['A']);
    expect((await service.findAll('T1', { status: 2 })).map((r) => r.sched_id)).toEqual(['C']);
  });

  it('builds a start-date range from from/to', async () => {
    const { service, repo } = setup(seed());
    await service.findAll('T1', { from: '2026-09-01', to: '2026-09-30' });
    const range = repo.find.mock.calls.at(-1)![0].where.sched_start_date;
    expect(range.value).toEqual(['2026-09-01 00:00:00', '2026-09-30 23:59:59']);
  });

  it('a tenant_id smuggled through filters cannot widen the scope', async () => {
    const { service, repo } = setup(seed());
    await service.findAll('T1', { tenant_id: 'T2' } as any);
    expect(repo.find.mock.calls.at(-1)![0].where.tenant_id).toBe('T1');
  });
});

describe('ScheduleService.update / remove', () => {
  it('edits a planned schedule and re-validates the window', async () => {
    const { service } = setup([row()]);
    const res = await service.update('S1', 'T1', { sched_title: 'Baru', sched_end_date: '2099-01-02T10:00' });
    expect(res).toMatchObject({ sched_title: 'Baru', sched_end_date: '2099-01-02 10:00:00' });
    await expect(service.update('S1', 'T1', { sched_end_date: '2098-12-31T10:00' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels with sched_sts 3', async () => {
    const { service, stored } = setup([row()]);
    await service.update('S1', 'T1', { sched_sts: 3 });
    expect(stored[0].sched_sts).toBe(3);
  });

  it('refuses to change done or cancelled schedules', async () => {
    for (const sts of [2, 3]) {
      const { service } = setup([row({ sched_sts: sts })]);
      await expect(service.update('S1', 'T1', { sched_title: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('switching to repeat NONE clears interval and until', async () => {
    const { service, stored } = setup([row({ sched_repeat: 'WEEKLY', sched_interval: 1, sched_repeat_until: '2099-02-01' })]);
    await service.update('S1', 'T1', { sched_repeat: 'NONE' });
    expect(stored[0].sched_interval).toBeNull();
    expect(stored[0].sched_repeat_until).toBeNull();
  });

  it('changing the activity type refreshes title and unit unless given', async () => {
    const { service } = setup([row()]);
    const res = await service.update('S1', 'T1', { actype_id: 'ACT-PD-BWD' });
    expect(res).toMatchObject({ actype_id: 'ACT-PD-BWD', sched_title: 'BWD' });
    await expect(service.update('S1', 'T1', { actype_id: 'ACT-PANEN-TBS' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for another tenant on read, update and delete', async () => {
    const { service } = setup([row({ tenant_id: 'T2' })]);
    await expect(service.findOne('S1', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('S1', 'T1', { sched_title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('S1', 'T1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes planned/cancelled schedules but not done ones', async () => {
    const a = setup([row()]);
    await a.service.remove('S1', 'T1');
    expect(a.stored).toHaveLength(0);

    const b = setup([row({ sched_sts: 3 })]);
    await b.service.remove('S1', 'T1');
    expect(b.stored).toHaveLength(0);

    const c = setup([row({ sched_sts: 2 })]);
    await expect(c.service.remove('S1', 'T1')).rejects.toBeInstanceOf(ConflictException);
    expect(c.stored).toHaveLength(1);
  });
});

describe('ScheduleController roles', () => {
  it.each(['create', 'update', 'remove'] as const)('%s allows admin, tenant_admin and agronom but not operator', (name) => {
    const roles: string[] = Reflect.getMetadata(ROLES_KEY, ScheduleController.prototype[name]);
    expect(roles.sort()).toEqual(['admin', 'agronom', 'tenant_admin']);
  });
});
