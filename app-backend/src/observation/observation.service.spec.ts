import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObservationService } from './observation.service';
import { ObservationController } from './observation.controller';
import { Observation } from './entities/observation.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Media } from '../media/entities/media.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

const phases = [
  { phase_id: 'PH-PADI-02', phase_seq: 2, phase_start_age: 0, phase_end_age: 29 },
  { phase_id: 'PH-PADI-06', phase_seq: 6, phase_start_age: 29, phase_end_age: 57 },
  { phase_id: 'PH-PADI-07', phase_seq: 7, phase_start_age: 57, phase_end_age: 67 },
  { phase_id: 'PH-PADI-08', phase_seq: 8, phase_start_age: 67, phase_end_age: 77 },
  { phase_id: 'PH-PADI-10', phase_seq: 10, phase_start_age: 77, phase_end_age: 94 },
];

const plants: any[] = [
  { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', plant_sow_date: '2026-08-25', plant_date: '2026-09-15', plant_sts: 1, plant_phase_mode: 'AUTO' },
  { plant_id: 'P2', tenant_id: 'T2', site_id: 'S2', cluster_id: 'C2', plant_sow_date: '2026-08-25', plant_date: '2026-09-15', plant_sts: 1 },
  { plant_id: 'P3', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C3', plant_sow_date: '2026-01-01', plant_date: '2026-01-20', plant_sts: 0 },
  { plant_id: 'P4', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C4', plant_sow_date: '2026-08-25', plant_date: '2026-09-15', plant_sts: 1, plant_phase_mode: 'MANUAL', phase_id: 'PH-PADI-08' },
];

const eq = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && '_type' in v) {
      if (v._type === 'in') return v._value.includes(row[k]);
      if (v._type === 'isNull') return row[k] === null || row[k] === undefined;
      return true;
    }
    return row[k] === v;
  });

function setup(seed: any[] = [], media: any[] = []) {
  const stored = seed.map((r) => ({ ...r }));
  const mediaRows = media.map((r) => ({ ...r }));
  const em = {
    insert: jest.fn(async (entity, row) => {
      if (entity === Observation) stored.push({ ...row });
    }),
    update: jest.fn(async (entity, where, patch) => {
      if (entity === Media) mediaRows.filter((r) => eq(r, where)).forEach((r) => Object.assign(r, patch));
    }),
    delete: jest.fn(async (_e, where) => {
      const i = stored.findIndex((r) => eq(r, where));
      if (i >= 0) stored.splice(i, 1);
    }),
  };
  const repos = new Map<unknown, any>([
    [PlantPhase, { find: jest.fn().mockResolvedValue(phases) }],
    [Plant, { findOne: jest.fn(async ({ where }) => plants.find((p) => eq(p, where)) ?? null) }],
    [Media, { find: jest.fn(async ({ where }) => mediaRows.filter((m) => eq(m, where))) }],
  ]);
  const manager = {
    findOne: jest.fn(async (entity, { where }) => (entity === Plant ? plants.find((p) => eq(p, where)) ?? null : null)),
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
      const i = stored.findIndex((s) => s.obs_id === r.obs_id);
      if (i >= 0) stored[i] = { ...stored[i], ...r };
      return r;
    }),
  };
  return { service: new ObservationService(repo as any), repo, em, stored, mediaRows };
}

const dto = (over: Record<string, unknown> = {}): any => ({
  plant_id: 'P1',
  obs_date: '2026-09-29T08:00', // HST 14
  obs_height: 32,
  obs_tiller: 8,
  ...over,
});

describe('ObservationService.create', () => {
  it('records a saved observation with HST, phase, defaults and tenant data', async () => {
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto());
    expect(res).toMatchObject({
      obs_id: 'P1_OBS1',
      tenant_id: 'T1',
      site_id: 'S1',
      cluster_id: 'C1',
      plant_id: 'P1',
      phase_id: 'PH-PADI-02',
      user_id: 'u1',
      obs_age: 14,
      obs_sample_n: 20,
      obs_source: 'WEB',
      obs_sts: 1,
      obs_date: '2026-09-29 08:00:00',
    });
  });

  it('saves as draft (status 0) when asked', async () => {
    const { service } = setup();
    expect((await service.create('T1', 'u1', dto({ draft: true }))).obs_sts).toBe(0);
  });

  it('uses the plant’s manual phase when the mode is MANUAL', async () => {
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto({ plant_id: 'P4', obs_grain: 100 }));
    expect(res.phase_id).toBe('PH-PADI-08'); // grain would be refused in the generic phase at HST 14
  });

  it('applies the phase rules (BWD outside HST 14-62, panicle too early)', async () => {
    const { service, em } = setup();
    await expect(service.create('T1', 'u1', dto({ obs_date: '2026-09-28T08:00', obs_bwd: 3.5 }))).rejects.toBeInstanceOf(BadRequestException); // HST 13
    await expect(service.create('T1', 'u1', dto({ obs_panicle: 10 }))).rejects.toBeInstanceOf(BadRequestException);
    expect(em.insert).not.toHaveBeenCalled();
  });

  it('accepts phase-gated fields in the right phase (HST 70 = milk stage)', async () => {
    const { service } = setup();
    await expect(
      service.create('T1', 'u1', dto({ obs_date: '2026-11-24T08:00', obs_panicle: 14, obs_grain: 120, obs_filled_pct: 70 })),
    ).resolves.toMatchObject({ obs_age: 70, phase_id: 'PH-PADI-08' });
  });

  it('stores symptom codes comma separated and deduplicated', async () => {
    const { service } = setup();
    const res = await service.create('T1', 'u1', dto({ obs_symptom: ['N_KUNING', 'KERDIL', 'N_KUNING'] }));
    expect(res.obs_symptom).toBe('N_KUNING,KERDIL');
  });

  it('rejects an empty observation and a date before sowing', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ obs_height: undefined, obs_tiller: undefined }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('T1', 'u1', dto({ obs_date: '2026-08-24T08:00' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for another tenant’s plant and rejects a closed season', async () => {
    const { service } = setup();
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P2' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create('T1', 'u1', dto({ plant_id: 'P3' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('claims unused photos of the tenant and rejects others', async () => {
    const a = setup([], [{ media_id: 'M1', tenant_id: 'T1', obs_id: null }]);
    await a.service.create('T1', 'u1', dto({ media_ids: ['M1'] }));
    expect(a.mediaRows[0]).toMatchObject({ obs_id: 'P1_OBS1', plant_id: 'P1' });

    const b = setup([], [
      { media_id: 'M1', tenant_id: 'T1', obs_id: 'OTHER' },
      { media_id: 'M2', tenant_id: 'T2', obs_id: null },
    ]);
    await expect(b.service.create('T1', 'u1', dto({ media_ids: ['M1'] }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(b.service.create('T1', 'u1', dto({ media_ids: ['M2'] }))).rejects.toBeInstanceOf(BadRequestException);
    expect(b.em.insert).not.toHaveBeenCalled();
  });

  it('numbers by the highest existing suffix', async () => {
    const { service } = setup([{ obs_id: 'P1_OBS3', plant_id: 'P1' }, { obs_id: 'P1_OBS12', plant_id: 'P1' }]);
    expect((await service.create('T1', 'u1', dto())).obs_id).toBe('P1_OBS13');
  });
});

describe('ObservationService read', () => {
  const rows = () => [
    { obs_id: 'A', tenant_id: 'T1', plant_id: 'P1', obs_sts: 1, obs_source: 'WEB' },
    { obs_id: 'B', tenant_id: 'T1', plant_id: 'P1', obs_sts: 1, obs_source: 'AI' },
    { obs_id: 'C', tenant_id: 'T2', plant_id: 'P2', obs_sts: 1, obs_source: 'WEB' },
  ];

  it('is tenant scoped and filters by status and source', async () => {
    const { service, repo } = setup(rows());
    expect((await service.findAll('T1')).map((r) => r.obs_id).sort()).toEqual(['A', 'B']);
    expect(await service.findAll(undefined)).toHaveLength(3);
    await service.findAll('T1', { status: 1, source: 'AI' });
    expect(repo.find.mock.calls.at(-1)![0].where).toMatchObject({ obs_sts: 1, obs_source: 'AI', tenant_id: 'T1' });
  });

  it('a tenant_id smuggled through filters cannot widen the scope', async () => {
    const { service, repo } = setup(rows());
    await service.findAll('T1', { tenant_id: 'T2' } as any);
    expect(repo.find.mock.calls.at(-1)![0].where.tenant_id).toBe('T1');
  });

  it('findOne hides another tenant’s row', async () => {
    const { service } = setup(rows());
    await expect(service.findOne('C', 'T1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ObservationService workflow', () => {
  const seed = (sts: number, extra: Record<string, unknown> = {}) => [
    { obs_id: 'O1', tenant_id: 'T1', plant_id: 'P1', obs_sts: sts, obs_date: '2026-09-29 08:00:00', obs_height: 32, obs_tiller: 8, obs_desc: 'Catatan', ...extra },
  ];

  it('verifies only a saved observation', async () => {
    const ok = setup(seed(1));
    expect((await ok.service.verify('O1', 'T1')).obs_sts).toBe(2);
    for (const sts of [0, 2, 3]) {
      const { service } = setup(seed(sts));
      await expect(service.verify('O1', 'T1')).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rejects with a reason kept in the description', async () => {
    const { service } = setup(seed(1));
    const res = await service.reject('O1', 'T1', '  Foto buram  ');
    expect(res).toMatchObject({ obs_sts: 3, obs_desc: 'Ditolak: Foto buram | Catatan' });
    const done = setup(seed(2));
    await expect(done.service.reject('O1', 'T1', 'alasan')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verify and reject are tenant scoped (404 across tenants)', async () => {
    const { service } = setup(seed(1, { tenant_id: 'T2' }));
    await expect(service.verify('O1', 'T1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.reject('O1', 'T1', 'alasan')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a global admin without scope can verify any tenant', async () => {
    const { service } = setup(seed(1, { tenant_id: 'T2' }));
    await expect(service.verify('O1', undefined)).resolves.toMatchObject({ obs_sts: 2 });
  });

  describe('update', () => {
    it('re-saves a draft and recomputes HST and phase', async () => {
      const { service } = setup(seed(0));
      const res = await service.update('O1', 'T1', { obs_date: '2026-10-20T08:00', obs_height: 60 });
      expect(res).toMatchObject({ obs_sts: 1, obs_age: 35, phase_id: 'PH-PADI-06', obs_height: 60 });
    });

    it('lets a rejected observation be corrected, clearing the rejection text and returning it to saved', async () => {
      const { service } = setup(seed(3, { obs_desc: 'Ditolak: Foto buram | Catatan' }));
      const res = await service.update('O1', 'T1', { obs_height: 40 });
      expect(res).toMatchObject({ obs_sts: 1, obs_desc: 'Catatan' });
    });

    it('keeps it a draft when asked', async () => {
      const { service } = setup(seed(1));
      expect((await service.update('O1', 'T1', { draft: true })).obs_sts).toBe(0);
    });

    it('refuses to change a verified observation', async () => {
      const { service } = setup(seed(2));
      await expect(service.update('O1', 'T1', { obs_height: 40 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-validates merged values (BWD in a phase where it is not allowed)', async () => {
      const { service } = setup(seed(1));
      await expect(service.update('O1', 'T1', { obs_date: '2026-09-20T08:00', obs_bwd: 3.5 })).rejects.toBeInstanceOf(BadRequestException); // HST 5
    });

    it('rejects changes on a closed season and 404s across tenants', async () => {
      const closed = setup(seed(1, { plant_id: 'P3' }));
      await expect(closed.service.update('O1', 'T1', { obs_height: 40 })).rejects.toBeInstanceOf(BadRequestException);
      const other = setup(seed(1, { tenant_id: 'T2' }));
      await expect(other.service.update('O1', 'T1', { obs_height: 40 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it.each([0, 1, 3])('deletes status %s and unlinks photos', async (sts) => {
      const { service, stored, mediaRows } = setup(seed(sts), [{ media_id: 'M1', obs_id: 'O1' }]);
      await service.remove('O1', 'T1');
      expect(stored).toHaveLength(0);
      expect(mediaRows[0].obs_id).toBeNull();
    });

    it('keeps verified observations', async () => {
      const { service, stored } = setup(seed(2));
      await expect(service.remove('O1', 'T1')).rejects.toBeInstanceOf(BadRequestException);
      expect(stored).toHaveLength(1);
    });
  });
});

describe('ObservationController roles', () => {
  const roles = (name: keyof ObservationController) => [...Reflect.getMetadata(ROLES_KEY, ObservationController.prototype[name])].sort();

  it.each(['create', 'update', 'remove'] as const)('%s: admin, tenant_admin, operator', (n) => {
    expect(roles(n)).toEqual(['admin', 'operator', 'tenant_admin']);
  });

  it.each(['verify', 'reject'] as const)('%s: admin, tenant_admin, agronom (never operator)', (n) => {
    expect(roles(n)).toEqual(['admin', 'agronom', 'tenant_admin']);
  });
});
