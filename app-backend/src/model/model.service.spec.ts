import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ModelService } from './model.service';
import { ModelController } from './model.controller';
import { Simulation } from './entities/simulation.entity';
import { SimPhase } from './entities/sim-phase.entity';
import { WeatherDailyRow } from './entities/weather-daily.entity';
import { ClimateNormal } from './entities/climate-normal.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Observation } from '../observation/entities/observation.entity';
import { Activity } from '../activity/entities/activity.entity';
import { SoilProfile } from '../soil/entities/soil-profile.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { Material } from '../ref/entities/material.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

// Same Inpari 32 HDB rows as the seed data (see model-engine.spec for the table)
const SEED: [string, number, number, number, number | null, number | null, number | null][] = [
  ['SEMAI', 1, -21, -357, 19.4, 1, null],
  ['VEG-AWAL', 2, 0, 0, 29.1, 5.9, null],
  ['ANAKAN', 3, 12, 204, 48.5, 17.6, 4],
  ['ANAK-MAX', 4, 26, 442, 60.1, 23.4, 4],
  ['PRIMORDIA', 5, 34, 578, 75.7, 21.1, 4],
  ['BUNTING', 6, 49, 833, 89.2, 18, 4],
  ['BUNGA', 7, 62, 1054, 97, 18, null],
  ['SUSU', 8, 72, 1224, 97, 18, null],
  ['KUNING', 9, 82, 1394, 97, 18, null],
  ['PANEN', 10, 92, 1564, 97, 18, null],
  ['BERA', 11, 99, 1683, 97, 18, null],
];

const phaseRows = SEED.map(([code, seq, start]) => ({
  phase_id: `PH-${code}`, ptype_id: 'PT-PADI', phase_code: code, phase_name: code, phase_seq: seq, phase_start_age: start, phase_end_age: null,
}));
const varietyPhaseRows = SEED.map(([code, , start, gdd, h, t, bwd], i) => ({
  phase_id: `PH-${code}`, var_id: 'V1', vp_start_age: start, vp_end_age: SEED[i + 1]?.[2] ?? null,
  vp_gdd_start: gdd, vp_gdd_end: SEED[i + 1]?.[3] ?? null, vp_height_ref: h, vp_tiller_ref: t, vp_bwd_min: bwd,
}));

const eq = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && '_type' in v) return v._type === 'in' ? v._value.includes(row[k]) : true;
    return row[k] === v;
  });

function setup(over: { plant?: any; observations?: any[]; soil?: any[]; activities?: any[]; schedules?: any[]; weather?: any[] } = {}) {
  const tables = new Map<unknown, any[]>();
  tables.set(Plant, [
    over.plant ?? {
      plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', ptype_id: 'PT-PADI', var_id: 'V1', phase_id: 'PH-ANAKAN',
      plant_sow_date: '2026-08-25', plant_date: '2026-09-15', plant_area: 2, plant_count: 426_666, plant_sts: 1, plant_phase_mode: 'AUTO',
    },
  ]);
  tables.set(PlantVariety, [{ var_id: 'V1', var_name: 'Inpari 32 HDB', var_tbase: 10, var_topt: 30, var_tmax: 42, var_yield_avg: 6.3, var_yield_potential: 8.4, var_grain_weight: 27 }]);
  tables.set(PlantPhase, phaseRows);
  tables.set(VarietyPhase, varietyPhaseRows);
  tables.set(
    ClimateNormal,
    Array.from({ length: 366 }, (_, i) => ({ site_id: 'S1', cn_scenario: 'NORMAL', cn_doy: i + 1, cn_tmin: 22, cn_tmax: 32 })),
  );
  tables.set(WeatherDailyRow, over.weather ?? []);
  tables.set(Observation, over.observations ?? []);
  tables.set(SoilProfile, over.soil ?? []);
  tables.set(Activity, over.activities ?? []);
  tables.set(Material, [{ mat_id: 'MAT-NPK', mat_n: 15, mat_p2o5: 15, mat_k2o: 15 }]);
  tables.set(Schedule, over.schedules ?? []);
  tables.set(ActivityType, [
    { actype_id: 'ACT-PD-PUPUK-S1', actype_name: 'Pemupukan Susulan I', ptype_id: 'PT-PADI', actype_category: 'PEMUPUKAN' },
    { actype_id: 'ACT-PD-PUPUK-S2', actype_name: 'Pemupukan Susulan II', ptype_id: 'PT-PADI', actype_category: 'PEMUPUKAN' },
  ]);
  tables.set(Simulation, []);
  tables.set(SimPhase, []);

  const repoOf = (entity: unknown) => ({
    find: jest.fn(async (opts: any = {}) => (tables.get(entity) ?? []).filter((r) => eq(r, opts.where ?? {})).map((r) => ({ ...r }))),
    findOne: jest.fn(async (opts: any) => {
      const r = (tables.get(entity) ?? []).find((x) => eq(x, opts.where ?? {}));
      return r ? { ...r } : null;
    }),
    create: jest.fn((x) => ({ ...x })),
    insert: jest.fn(async (row: any) => {
      const list = tables.get(entity)!;
      (Array.isArray(row) ? row : [row]).forEach((r) => list.push({ ...r }));
    }),
    update: jest.fn(async (where: any, patch: any) => {
      (tables.get(entity) ?? []).filter((r) => eq(r, where)).forEach((r) => Object.assign(r, patch));
    }),
  });
  const repos = new Map<unknown, ReturnType<typeof repoOf>>();
  const getRepository = (e: unknown) => {
    if (!repos.has(e)) repos.set(e, repoOf(e));
    return repos.get(e)!;
  };
  const em = {
    update: jest.fn(async (entity: unknown, where: any, patch: any) => getRepository(entity).update(where, patch)),
    insert: jest.fn(async (entity: unknown, row: any) => getRepository(entity).insert(row)),
  };
  const manager = { getRepository, transaction: jest.fn(async (cb: any) => cb(em)) };
  const repo = { manager, create: jest.fn((x) => ({ ...x })), find: getRepository(Simulation).find, findOne: getRepository(Simulation).findOne };
  return { service: new ModelService(repo as any), tables, em };
}

const verified = (over: Record<string, unknown> = {}) => ({
  obs_id: 'O1', plant_id: 'P1', obs_sts: 2, obs_date: '2026-10-20 08:00:00', obs_age: 35, phase_id: 'PH-PRIMORDIA',
  obs_height: 60, obs_tiller: 22.5, obs_bwd: 3, obs_pest_pct: 3.3333, obs_phase_pct: 50, ...over,
});
const soil = () => [{ soil_id: 'S', cluster_id: 'C1', plant_id: null, soil_sample_date: '2026-08-20', soil_p_avail: 18, soil_p_method: 'BRAY1', soil_k_exch: 0.35 }];
const npk = () => [{ pact_id: 'A1', plant_id: 'P1', mat_id: 'MAT-NPK', pact_value: '200', unit_id: 'UNIT-KG' }]; // 15/15/15 kg/ha on 2 ha

describe('ModelService.simulate (demo plant, 24 Oct 2026)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-24T03:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());

  it('reproduces the seeded weekly run: phase, GI, N 23, P 12, K 15, yield 5.7 (4.9-6.6), harvest 23 Dec', async () => {
    const { service } = setup({ observations: [verified()], soil: soil(), activities: npk() });
    const out = await service.simulate('P1', 'T1', 'u1');
    const sim = out.simulation;

    expect(sim).toMatchObject({
      plant_id: 'P1', tenant_id: 'T1', var_id: 'V1', phase_id: 'PH-PRIMORDIA', sim_model: 'AGRO-PADI', sim_scenario: 'BASE',
      sim_age_now: 39, sim_is_latest: 1, sim_harvest_date: '2026-12-23', sim_cutoff_date: '2026-10-23', sim_confidence: 0.5,
      sim_n_def: 23, sim_p2o5_def: 12, sim_k2o_def: 15, sim_growth_idx: 0.97, sim_yield: 5.7, sim_yield_low: 4.9, sim_yield_high: 6.6,
    });
    expect(sim.sim_gdd_now).toBe(663); // 39 days x 17 GDD
    const param = JSON.parse(sim.sim_param);
    expect(param).toMatchObject({ yield_method: 'FAKTOR', soil_p: 'SEDANG', soil_k: 'SEDANG', bwd: 3, bwd_min: 4, urea_koreksi: 50, f_n: 0.95, f_pest: 0.99 });
    expect(sim.sim_note).toMatch(/N kurang \(BWD 3\)/);
    expect(sim.sim_note).toMatch(/P\/K di bawah rekomendasi/);
  });

  it('writes one phase row per phase with the demo dates and data types', async () => {
    const { service } = setup({ observations: [verified()], soil: soil() });
    const { phases } = await service.simulate('P1', 'T1', 'u1');
    expect(phases).toHaveLength(11);
    const by = (id: string) => phases.find((p) => p.phase_id === `PH-${id}`)!;
    expect(by('SEMAI')).toMatchObject({ sp_start_date: '2026-08-25', sp_end_date: '2026-09-14', sp_start_age: -21, sp_data_type: 'ACTUAL' });
    expect(by('PRIMORDIA')).toMatchObject({ sp_start_date: '2026-10-19', sp_end_date: '2026-11-02', sp_start_age: 34, sp_gdd_start: 578 });
    expect(by('BERA')).toMatchObject({ sp_start_date: '2026-12-23', sp_end_date: undefined, sp_data_type: 'NORMAL' });
    expect(new Set(phases.map((p) => p.sp_id)).size).toBe(11);
  });

  it('stamps the observed date and error on the phase the observation reached (F-MDL-08)', async () => {
    const { service } = setup({ observations: [verified({ obs_date: '2026-10-20 08:00:00' })] });
    const { phases } = await service.simulate('P1', 'T1', 'u1');
    // projected start 2026-10-19, observed at 50% on 2026-10-20: error = start - actual = -1
    expect(phases.find((p) => p.phase_id === 'PH-PRIMORDIA')).toMatchObject({ sp_actual_date: '2026-10-20', sp_error_day: -1 });
    expect(phases.find((p) => p.phase_id === 'PH-BUNTING')!.sp_actual_date).toBeUndefined();
  });

  it('makes the new run the only latest one for the scenario and keeps other scenarios', async () => {
    const { service, tables } = setup({ observations: [verified()] });
    await service.simulate('P1', 'T1', 'u1');
    await service.simulate('P1', 'T1', 'u1');
    await service.simulate('P1', 'T1', 'u1', 'KERING');
    const sims = tables.get(Simulation)!;
    expect(sims).toHaveLength(3);
    expect(sims.filter((s) => s.sim_scenario === 'BASE' && s.sim_is_latest === 1)).toHaveLength(1);
    expect(sims.filter((s) => s.sim_scenario === 'BASE' && s.sim_is_latest === 0)).toHaveLength(1);
    expect(sims.find((s) => s.sim_scenario === 'KERING')!.sim_is_latest).toBe(1);
  });

  it('a hotter season gives an earlier harvest than a cooler one (scenario uses its own normals)', async () => {
    const { service, tables } = setup();
    tables.get(ClimateNormal)!.push(
      ...Array.from({ length: 366 }, (_, i) => ({ site_id: 'S1', cn_scenario: 'KERING', cn_doy: i + 1, cn_tmin: 24, cn_tmax: 36 })),
      ...Array.from({ length: 366 }, (_, i) => ({ site_id: 'S1', cn_scenario: 'BASAH', cn_doy: i + 1, cn_tmin: 21, cn_tmax: 29 })),
    );
    const dry = (await service.simulate('P1', 'T1', 'u1', 'KERING')).simulation.sim_harvest_date as string;
    const wet = (await service.simulate('P1', 'T1', 'u1', 'BASAH')).simulation.sim_harvest_date as string;
    expect(dry < '2026-12-23').toBe(true);
    expect(wet > '2026-12-23').toBe(true);
  });

  it('uses actual then forecast weather before the normal', async () => {
    const weather = [
      ...Array.from({ length: 40 }, (_, i) => ({ site_id: 'S1', wd_type: 'ACTUAL', wd_date: new Date(2026, 8, 15 + i), wd_tmin: 20, wd_tmax: 30 })), // 15 GDD
    ];
    const { service } = setup({ weather });
    const { simulation } = await service.simulate('P1', 'T1', 'u1');
    expect(simulation.sim_gdd_now).toBe(Math.round(39 * 15)); // days 09-15 .. 10-23 are all actual rows
  });

  it('without verified observations: no growth index, "perlu observasi", factor-method yield at the variety average', async () => {
    const { service } = setup({ observations: [verified({ obs_sts: 1 })] }); // saved, not verified: ignored
    const { simulation } = await service.simulate('P1', 'T1', 'u1');
    expect(simulation.sim_growth_idx).toBeUndefined();
    expect(simulation.sim_n_def).toBe(0);
    expect(simulation.sim_yield).toBe(6.3);
    expect(simulation.sim_note).toMatch(/perlu observasi/);
  });

  it('ignores observations older than 14 days for growth and BWD', async () => {
    const { service } = setup({ observations: [verified({ obs_date: '2026-10-01 08:00:00' })] });
    const { simulation } = await service.simulate('P1', 'T1', 'u1');
    expect(simulation.sim_growth_idx).toBeUndefined();
    expect(simulation.sim_n_def).toBe(0);
  });

  it('assumes SEDANG without soil data and notes it', async () => {
    const { service } = setup();
    const { simulation } = await service.simulate('P1', 'T1', 'u1');
    expect(simulation.sim_note).toMatch(/tanpa data lab tanah/);
    expect(simulation.sim_p2o5_def).toBe(27); // full SEDANG recommendation, nothing applied
    expect(simulation.sim_k2o_def).toBe(30);
  });

  it('uses the component method after flowering', async () => {
    const plant = {
      plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', cluster_id: 'C1', ptype_id: 'PT-PADI', var_id: 'V1',
      plant_sow_date: '2026-08-01', plant_date: '2026-08-22', plant_area: 1, plant_count: 250_000, plant_sts: 1,
    };
    const { service } = setup({ plant, observations: [verified({ obs_date: '2026-10-23 08:00:00', obs_panicle: 14, obs_grain: 120, obs_filled_pct: 85, obs_bwd: null })] });
    const { simulation } = await service.simulate('P1', 'T1', 'u1');
    expect(simulation.phase_id).toBe('PH-BUNGA'); // HST 63: flowering, so the component method applies
    expect(JSON.parse(simulation.sim_param).yield_method).toBe('KOMPONEN');
    expect(simulation.sim_yield).toBe(9.6);
    expect(simulation.sim_confidence).toBe(0.7);
  });

  it('refreshes an AUTO plant’s phase but never a MANUAL one', async () => {
    const auto = setup();
    await auto.service.simulate('P1', 'T1', 'u1');
    expect(auto.tables.get(Plant)![0]).toMatchObject({ phase_id: 'PH-PRIMORDIA', plant_phase_date: '2026-10-19' });

    const manual = setup({ plant: { ...setup().tables.get(Plant)![0], plant_phase_mode: 'MANUAL', phase_id: 'PH-ANAKAN' } });
    await manual.service.simulate('P1', 'T1', 'u1');
    expect(manual.tables.get(Plant)![0].phase_id).toBe('PH-ANAKAN');
  });

  it('does not touch the plant phase for non-BASE scenarios', async () => {
    const { service, tables } = setup();
    await service.simulate('P1', 'T1', 'u1', 'KERING');
    expect(tables.get(Plant)![0].phase_id).toBe('PH-ANAKAN');
  });

  it('is atomic: one transaction writes the run, its phases and the flag flip', async () => {
    const { service, em } = setup();
    await service.simulate('P1', 'T1', 'u1');
    const calls = em.update.mock.calls.map((c) => c[0]).concat(em.insert.mock.calls.map((c) => c[0]));
    expect(calls).toEqual(expect.arrayContaining([Simulation, SimPhase]));
  });

  describe('recommendation schedule (F-MDL-05)', () => {
    it('creates a MODEL schedule 3 days ahead with the deficits as straight fertiliser', async () => {
      const { service, tables } = setup({ observations: [verified()], soil: soil(), activities: npk() });
      const { detail } = await service.simulate('P1', 'T1', 'u1');
      const sched = tables.get(Schedule)![0];
      expect(sched).toMatchObject({
        plant_id: 'P1', tenant_id: 'T1', actype_id: 'ACT-PD-PUPUK-S2', sched_source: 'MODEL', sched_sts: 0,
        sched_start_date: '2026-10-27 06:00:00', unit_id: 'UNIT-KG',
      });
      expect(sched.sched_plan_value).toBe('Urea 50; SP-36 34; KCl 25 kg/ha');
      expect(sched.sched_desc).toContain('Urea 50 kg/ha (100 kg untuk 2 ha)');
      expect(detail.recommendation_sched_id).toBe(sched.sched_id);
    });

    it('updates a similar open schedule within 7 days instead of creating another', async () => {
      const existing = { sched_id: 'EX', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK-S2', sched_sts: 0, sched_source: 'TEMPLATE', sched_start_date: '2026-10-30 00:00:00' };
      const { service, tables } = setup({ observations: [verified()], soil: soil(), activities: npk(), schedules: [existing] });
      await service.simulate('P1', 'T1', 'u1');
      expect(tables.get(Schedule)).toHaveLength(1);
      expect(tables.get(Schedule)![0]).toMatchObject({ sched_id: 'EX', sched_source: 'MODEL' });
      expect(tables.get(Schedule)![0].sched_desc).toMatch(/Rekomendasi model/);
    });

    it('ignores finished schedules and far-away ones', async () => {
      const far = { sched_id: 'FAR', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK-S2', sched_sts: 0, sched_source: 'TEMPLATE', sched_start_date: '2026-12-01 00:00:00' };
      const done = { sched_id: 'DONE', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK-S2', sched_sts: 2, sched_source: 'MANUAL', sched_start_date: '2026-10-27 00:00:00' };
      const { service, tables } = setup({ observations: [verified()], soil: soil(), activities: npk(), schedules: [far, done] });
      await service.simulate('P1', 'T1', 'u1');
      expect(tables.get(Schedule)).toHaveLength(3);
      expect(tables.get(Schedule)!.find((s) => s.sched_id === 'FAR')!.sched_source).toBe('TEMPLATE');
    });

    it('creates nothing without a deficit, and nothing for non-BASE scenarios', async () => {
      const covered = [{ pact_id: 'A1', plant_id: 'P1', mat_id: 'MAT-NPK', pact_value: '800', unit_id: 'UNIT-KG' }]; // 60 kg/ha each
      const a = setup({ observations: [verified({ obs_bwd: 4.5 })], soil: soil(), activities: covered });
      await a.service.simulate('P1', 'T1', 'u1');
      expect(a.tables.get(Schedule)).toHaveLength(0);

      const b = setup({ observations: [verified()], soil: soil() });
      await b.service.simulate('P1', 'T1', 'u1', 'BASAH');
      expect(b.tables.get(Schedule)).toHaveLength(0);
    });
  });

  describe('guards', () => {
    it('404s for another tenant’s plant and rejects a closed season or missing dates', async () => {
      const { service } = setup();
      await expect(service.simulate('P1', 'T2', 'u1')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.simulate('NOPE', 'T1', 'u1')).rejects.toBeInstanceOf(NotFoundException);

      const closed = setup({ plant: { ...setup().tables.get(Plant)![0], plant_sts: 0 } });
      await expect(closed.service.simulate('P1', 'T1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
      const noDates = setup({ plant: { ...setup().tables.get(Plant)![0], plant_date: null } });
      await expect(noDates.service.simulate('P1', 'T1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('a global admin without scope can simulate any tenant’s plant', async () => {
      const { service } = setup();
      await expect(service.simulate('P1', undefined, 'u1')).resolves.toBeDefined();
    });

    it('simulateSafely swallows failures', async () => {
      const { service } = setup();
      await expect(service.simulateSafely('NOPE', null)).resolves.toBe(false);
      await expect(service.simulateSafely('P1', null)).resolves.toBe(true);
    });
  });
});

describe('ModelService accuracy and reads', () => {
  it('recordPhaseActual stamps the actual date and error on every run of the plant', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-24T03:00:00Z') });
    const { service, tables } = setup();
    await service.simulate('P1', 'T1', 'u1');
    await service.simulate('P1', 'T1', 'u1');
    await service.recordPhaseActual('P1', 'PH-PRIMORDIA', '2026-10-21');
    const rows = tables.get(SimPhase)!.filter((p) => p.phase_id === 'PH-PRIMORDIA');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.sp_actual_date === '2026-10-21' && r.sp_error_day === -2)).toBe(true);
    jest.useRealTimers();
  });

  it('recordPhaseActual does nothing for a plant without runs', async () => {
    const { service } = setup();
    await expect(service.recordPhaseActual('P1', 'PH-PRIMORDIA', '2026-10-21')).resolves.toBeUndefined();
  });

  it('latest, findOne and history are tenant scoped', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-24T03:00:00Z') });
    const { service } = setup();
    const { simulation } = await service.simulate('P1', 'T1', 'u1');
    expect((await service.latest('P1'))!.phases).toHaveLength(11);
    expect(await service.latest('P1', 'BASAH')).toBeNull();
    await expect(service.findOne(simulation.sim_id, 'T1')).resolves.toBeDefined();
    await expect(service.findOne(simulation.sim_id, 'T2')).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.history('P1', 'T1')).toHaveLength(1);
    await expect(service.history('P1', 'T2')).rejects.toBeInstanceOf(NotFoundException);
    jest.useRealTimers();
  });
});

describe('ModelController roles', () => {
  it('simulate: admin, tenant_admin, agronom (never operator)', () => {
    expect([...Reflect.getMetadata(ROLES_KEY, ModelController.prototype.simulate)].sort()).toEqual(['admin', 'agronom', 'tenant_admin']);
  });
});
