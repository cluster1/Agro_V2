import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalibrationService, MIN_PLOTS } from './calibration.service';
import { AccuracyService, pctError } from './accuracy.service';
import { CalibrationController } from './calibration.controller';
import { Plant } from '../plant/entities/plant.entity';
import { Observation } from '../observation/entities/observation.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { Harvest } from '../harvest/entities/harvest.entity';
import { Activity } from '../activity/entities/activity.entity';
import { Simulation } from './entities/simulation.entity';
import { SimPhase } from './entities/sim-phase.entity';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import * as ExcelJS from 'exceljs';

const eq = (row: any, where: Record<string, any>) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && '_type' in v) return v._type === 'in' ? v._value.includes(row[k]) : true;
    return row[k] === v;
  });

function makeManager(tables: Map<unknown, any[]>) {
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

// ------------------------------------------------------------------ calibration

const generic = [
  { phase_id: 'PH1', ptype_id: 'PT-PADI', phase_name: 'Semai', phase_seq: 1 },
  { phase_id: 'PH2', ptype_id: 'PT-PADI', phase_name: 'Anakan', phase_seq: 2 },
  { phase_id: 'PH3', ptype_id: 'PT-PADI', phase_name: 'Primordia', phase_seq: 3 },
  { phase_id: 'PH4', ptype_id: 'PT-PADI', phase_name: 'Bunting', phase_seq: 4 },
];
const vps = () => [
  { vp_id: 'VP1', var_id: 'V1', phase_id: 'PH1', vp_start_age: -21, vp_end_age: 0, vp_gdd_start: -357, vp_gdd_end: 0, vp_source: 'ESTIMASI' },
  { vp_id: 'VP2', var_id: 'V1', phase_id: 'PH2', vp_start_age: 12, vp_end_age: 34, vp_gdd_start: 204, vp_gdd_end: 578, vp_source: 'ESTIMASI' },
  { vp_id: 'VP3', var_id: 'V1', phase_id: 'PH3', vp_start_age: 34, vp_end_age: 49, vp_gdd_start: 578, vp_gdd_end: 833, vp_source: 'ESTIMASI' },
  { vp_id: 'VP4', var_id: 'V1', phase_id: 'PH4', vp_start_age: 49, vp_end_age: null, vp_gdd_start: 833, vp_gdd_end: null, vp_source: 'LITERATUR' },
];
const plants = (n: number, tenant = 'T1') =>
  Array.from({ length: n }, (_, i) => ({ plant_id: `P${i + 1}`, plant_name: `Petak ${i + 1}`, tenant_id: tenant, var_id: 'V1', plant_date: '2026-09-15' }));
const obs = (plantId: string, phaseId: string, date: string, pct = 50, sts = 2) => ({ obs_id: `${plantId}-${phaseId}-${date}`, plant_id: plantId, phase_id: phaseId, obs_date: date + ' 08:00:00', obs_phase_pct: pct, obs_sts: sts });

function calSetup(over: { plants?: any[]; observations?: any[]; vps?: any[] } = {}, gddByPlant: Record<string, number | null> = {}) {
  const tables = new Map<unknown, any[]>([
    [PlantVariety, [{ var_id: 'V1', var_name: 'Inpari 32', ptype_id: 'PT-PADI' }]],
    [PlantPhase, generic],
    [VarietyPhase, over.vps ?? vps()],
    [Plant, over.plants ?? plants(3)],
    [Observation, over.observations ?? []],
  ]);
  const manager = makeManager(tables);
  const model = { gddUntil: jest.fn(async (plant: any) => (plant.plant_id in gddByPlant ? gddByPlant[plant.plant_id] : 600)) };
  const service = new CalibrationService({ manager } as any, model as any);
  return { service, tables, model };
}

const reached = [obs('P1', 'PH3', '2026-10-21'), obs('P2', 'PH3', '2026-10-23'), obs('P3', 'PH3', '2026-10-22')]; // ages 36, 38, 37

describe('CalibrationService.report', () => {
  it('404s for an unknown variety', async () => {
    const { service } = calSetup();
    await expect(service.report('NOPE', undefined)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('compares the estimate with observed ages and GDD and proposes the mean once 3 plots agree', async () => {
    const { service } = calSetup({ observations: reached }, { P1: 590, P2: 610, P3: 600 });
    const r = await service.report('V1', 'T1');
    const p = r.phases.find((x) => x.phase_id === 'PH3')!;
    expect(r.variety).toEqual({ var_id: 'V1', name: 'Inpari 32' });
    expect(p.estimate).toMatchObject({ start_age: 34, gdd_start: 578 });
    expect(p.n_plots).toBe(3);
    expect(p.mean_age).toBe(37);
    expect(p.mean_gdd).toBe(600);
    expect(p.diff_age).toBe(3);
    expect(p.diff_gdd).toBe(22);
    expect(p.observed.map((o) => [o.plant_id, o.age, o.gdd, o.diff_gdd])).toEqual([['P1', 36, 590, 12], ['P3', 37, 600, 22], ['P2', 38, 610, 32]]);
    expect(p.proposal).toEqual({ start_age: 37, gdd_start: 600 });
  });

  it('offers no proposal below the minimum number of plots, but still shows the observations', async () => {
    const { service } = calSetup({ observations: reached.slice(0, MIN_PLOTS - 1) });
    const p = (await service.report('V1', 'T1')).phases.find((x) => x.phase_id === 'PH3')!;
    expect(p.n_plots).toBe(2);
    expect(p.observed).toHaveLength(2);
    expect(p.proposal).toBeNull();
  });

  it('ignores unverified observations, phase share under 50%, and observations without a phase', async () => {
    const { service } = calSetup({
      observations: [obs('P1', 'PH3', '2026-10-21', 50, 1), obs('P2', 'PH3', '2026-10-23', 49), { ...obs('P3', 'PH3', '2026-10-22'), phase_id: null }],
    });
    const p = (await service.report('V1', 'T1')).phases.find((x) => x.phase_id === 'PH3')!;
    expect(p.observed).toEqual([]);
    expect(p.mean_gdd).toBeNull();
  });

  it('uses only the earliest reached observation of a plant for a phase', async () => {
    const { service } = calSetup({ observations: [obs('P1', 'PH3', '2026-10-25'), obs('P1', 'PH3', '2026-10-21')] });
    const p = (await service.report('V1', 'T1')).phases.find((x) => x.phase_id === 'PH3')!;
    expect(p.observed).toHaveLength(1);
    expect(p.observed[0].date).toBe('2026-10-21');
  });

  it('counts a plot toward the proposal only when its GDD could be computed', async () => {
    const { service } = calSetup({ observations: reached }, { P2: null });
    const p = (await service.report('V1', 'T1')).phases.find((x) => x.phase_id === 'PH3')!;
    expect(p.observed).toHaveLength(3);
    expect(p.n_plots).toBe(2);
    expect(p.proposal).toBeNull();
  });

  it('is tenant scoped: another tenant’s plots are not used (a global admin sees all)', async () => {
    const mixed = [...plants(2, 'T1'), { ...plants(3)[2], tenant_id: 'T2' }];
    const { service } = calSetup({ plants: mixed, observations: reached });
    expect((await service.report('V1', 'T1')).phases.find((x) => x.phase_id === 'PH3')!.observed).toHaveLength(2);
    expect((await service.report('V1', undefined)).phases.find((x) => x.phase_id === 'PH3')!.observed).toHaveLength(3);
  });

  it('returns the phases of the variety even with no plots at all', async () => {
    const { service } = calSetup({ plants: [] });
    const r = await service.report('V1', 'T1');
    expect(r.phases).toHaveLength(4);
    expect(r.phases.every((p) => p.observed.length === 0 && p.proposal === null)).toBe(true);
  });
});

describe('CalibrationService.apply', () => {
  const agronom = { user_id: 'ag', user_role: 'agronom' };

  it('writes the proposal, sets KALIBRASI, and moves the previous phase end to the new start', async () => {
    const { service, tables } = calSetup({ observations: reached }, { P1: 590, P2: 610, P3: 600 });
    const out = await service.apply(agronom, 'V1', 'T1');
    expect(out.applied).toEqual([{ phase_id: 'PH3', vp_id: 'VP3', gdd_start: 600, start_age: 37 }]);
    const rows = tables.get(VarietyPhase)!;
    expect(rows.find((r) => r.vp_id === 'VP3')).toMatchObject({ vp_gdd_start: 600, vp_start_age: 37, vp_source: 'KALIBRASI' });
    expect(rows.find((r) => r.vp_id === 'VP3')!.vp_update).toBeInstanceOf(Date);
    expect(rows.find((r) => r.vp_id === 'VP2')).toMatchObject({ vp_gdd_end: 600, vp_end_age: 37, vp_source: 'ESTIMASI' }); // neighbour end only
    expect(rows.find((r) => r.vp_id === 'VP4')!.vp_source).toBe('LITERATUR');
  });

  it('skips a proposal that would break the increasing GDD order', async () => {
    const { service, tables } = calSetup({ observations: reached }, { P1: 900, P2: 900, P3: 900 }); // above the next phase start (833)
    const out = await service.apply(agronom, 'V1', 'T1');
    expect(out.applied).toEqual([]);
    expect(out.skipped).toEqual([{ phase_id: 'PH3', reason: expect.stringContaining('urutan GDD') }]);
    expect(tables.get(VarietyPhase)!.find((r) => r.vp_id === 'VP3')!.vp_source).toBe('ESTIMASI');
  });

  it('reports requested phases that lack a proposal, and applies only the requested ones', async () => {
    const { service, tables } = calSetup({ observations: reached });
    const out = await service.apply(agronom, 'V1', 'T1', ['PH2']);
    expect(out.applied).toEqual([]);
    expect(out.skipped).toEqual([{ phase_id: 'PH2', reason: expect.stringContaining('kurang dari 3') }]);
    expect(tables.get(VarietyPhase)!.find((r) => r.vp_id === 'VP3')!.vp_source).toBe('ESTIMASI');
  });

  it('refuses anyone but admin and agronom', async () => {
    const { service } = calSetup({ observations: reached });
    await expect(service.apply({ user_id: 'ta', user_role: 'tenant_admin' }, 'V1', 'T1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies nothing when no phase has enough plots', async () => {
    const { service } = calSetup();
    expect(await service.apply(agronom, 'V1', 'T1')).toEqual({ applied: [], skipped: [] });
  });
});

// ------------------------------------------------------------------ accuracy

describe('pctError', () => {
  it('is signed, rounded to 0.1, and null without a usable actual', () => {
    expect(pctError(5.7, 6)).toBe(-5);
    expect(pctError(6.6, 6)).toBe(10);
    expect(pctError(5.5, 5.23)).toBe(5.2);
    expect(pctError(null, 6)).toBeNull();
    expect(pctError(5, null)).toBeNull();
    expect(pctError(5, 0)).toBeNull();
  });
});

function accSetup(over: { sims?: any[]; phases?: any[]; harvests?: any[]; ubinan?: any[]; plants?: any[] } = {}) {
  const base = [
    { plant_id: 'P1', plant_name: 'Petak A', tenant_id: 'T1', var_id: 'V1', plant_season: 'MT2-2026' },
    { plant_id: 'P2', plant_name: 'Petak B', tenant_id: 'T1', var_id: 'V1', plant_season: 'MT1-2026' },
    { plant_id: 'P3', plant_name: 'Lain', tenant_id: 'T2', var_id: 'V2', plant_season: 'MT2-2026' },
  ];
  const tables = new Map<unknown, any[]>([
    [Plant, over.plants ?? base],
    [Simulation, over.sims ?? [
      { sim_id: 'S1', plant_id: 'P1', sim_scenario: 'BASE', sim_is_latest: 1, sim_yield: 5.7, sim_date: '2026-10-24' },
      { sim_id: 'S2', plant_id: 'P2', sim_scenario: 'BASE', sim_is_latest: 1, sim_yield: 6, sim_date: '2026-05-01' },
      { sim_id: 'S3', plant_id: 'P3', sim_scenario: 'BASE', sim_is_latest: 1, sim_yield: 6, sim_date: '2026-10-24' },
      { sim_id: 'OLD', plant_id: 'P1', sim_scenario: 'BASE', sim_is_latest: 0, sim_yield: 9, sim_date: '2026-10-17' },
      { sim_id: 'KR', plant_id: 'P1', sim_scenario: 'KERING', sim_is_latest: 1, sim_yield: 7, sim_date: '2026-10-24' },
    ]],
    [SimPhase, over.phases ?? [
      { sp_id: 'a', sim_id: 'S1', phase_id: 'PH2', sp_seq: 2, sp_error_day: -1 },
      { sp_id: 'b', sim_id: 'S1', phase_id: 'PH3', sp_seq: 3, sp_error_day: 3 },
      { sp_id: 'c', sim_id: 'S1', phase_id: 'PH4', sp_seq: 4, sp_error_day: null },
      { sp_id: 'd', sim_id: 'S2', phase_id: 'PH2', sp_seq: 2, sp_error_day: 0 },
    ]],
    [PlantPhase, generic],
    [PlantVariety, [{ var_id: 'V1', var_name: 'Inpari 32' }, { var_id: 'V2', var_name: 'Lain' }]],
    [Harvest, over.harvests ?? [
      { hv_id: 'H1', plant_id: 'P1', hv_weight_dry: 5233, hv_area: 1 },
      { hv_id: 'H2', plant_id: 'P1', hv_weight_dry: 5233, hv_area: 1 },
    ]],
    [Activity, over.ubinan ?? [
      { pact_id: 'U1', plant_id: 'P1', actype_id: 'ACT-PD-UBINAN', pact_value: '5,0', pact_date: '2026-12-01' },
      { pact_id: 'U2', plant_id: 'P1', actype_id: 'ACT-PD-UBINAN', pact_value: '6', pact_date: '2026-12-10' },
      { pact_id: 'X', plant_id: 'P1', actype_id: 'ACT-OTHER', pact_value: '99', pact_date: '2026-12-11' },
    ]],
  ]);
  const manager = makeManager(tables);
  const simRepo = manager.getRepository(Simulation);
  return new AccuracyService({ manager, find: simRepo.find } as any);
}

describe('AccuracyService.report', () => {
  it('uses the latest BASE run per plant and reports phase errors with names', async () => {
    const { rows } = await accSetup().report('T1');
    const a = rows.find((r) => r.plant_id === 'P1')!;
    expect(a.sim_id).toBe('S1'); // not the older BASE run nor the KERING one
    expect(a).toMatchObject({ plant_name: 'Petak A', season: 'MT2-2026', variety: 'Inpari 32', phases_compared: 2, mean_abs_error_day: 2 });
    expect(a.phase_errors).toEqual([{ phase_id: 'PH2', name: 'Anakan', error_day: -1 }, { phase_id: 'PH3', name: 'Primordia', error_day: 3 }]);
  });

  it('compares the prediction with the area-weighted harvest yield and the latest ubinan', async () => {
    const { rows } = await accSetup().report('T1');
    const a = rows.find((r) => r.plant_id === 'P1')!;
    expect(a).toMatchObject({ pred_yield: 5.7, actual_yield: 5.23, yield_error_pct: 9, ubinan_yield: 6, ubinan_error_pct: -5 });
  });

  it('weights multiple harvests by area, not by the mean of their yields', async () => {
    const svc = accSetup({
      harvests: [
        { hv_id: 'H1', plant_id: 'P1', hv_weight_dry: 6000, hv_area: 1 }, // 6.0 t/ha
        { hv_id: 'H2', plant_id: 'P1', hv_weight_dry: 2000, hv_area: 1 }, // 2.0 t/ha on the same area -> total 8000 kg / 2 ha
      ],
    });
    expect((await svc.report('T1')).rows.find((r) => r.plant_id === 'P1')!.actual_yield).toBe(4);
  });

  it('has null yield errors without a harvest, and null phase error without compared phases', async () => {
    const { rows } = await accSetup().report('T1');
    const b = rows.find((r) => r.plant_id === 'P2')!;
    expect(b).toMatchObject({ actual_yield: null, yield_error_pct: null, ubinan_yield: null, phases_compared: 1, mean_abs_error_day: 0 });
    const none = (await accSetup({ phases: [] }).report('T1')).rows.find((r) => r.plant_id === 'P1')!;
    expect(none).toMatchObject({ phases_compared: 0, mean_abs_error_day: null });
  });

  it('is tenant scoped and filters by variety and season', async () => {
    const svc = accSetup();
    expect((await svc.report('T1')).rows.map((r) => r.plant_id)).toEqual(['P1', 'P2']); // newest season first
    expect((await svc.report(undefined)).rows).toHaveLength(3);
    expect((await svc.report('T1', { season: 'MT1-2026' })).rows.map((r) => r.plant_id)).toEqual(['P2']);
    expect((await svc.report(undefined, { varId: 'V2' })).rows.map((r) => r.plant_id)).toEqual(['P3']);
    expect((await svc.report('T1', { varId: 'NOPE' })).rows).toEqual([]);
  });

  it('summarises MAE in days and MAPE/bias in percent over the compared runs', async () => {
    const { summary } = await accSetup().report('T1');
    expect(summary).toMatchObject({ runs: 2, runs_with_phase: 2, runs_with_yield: 1, mape_pct: 9, bias_pct: 9 });
    expect(summary.mae_day).toBe(1.3); // |-1|, |3|, |0| -> 4/3
  });

  it('an empty report summarises to nulls', async () => {
    const { rows, summary } = await accSetup({ plants: [] }).report('T1');
    expect(rows).toEqual([]);
    expect(summary).toMatchObject({ runs: 0, mae_day: null, mape_pct: null, bias_pct: null });
  });

  it('exports an XLSX with the rows and a summary sheet, neutralising formula-like names', async () => {
    const svc = accSetup({ plants: [{ plant_id: 'P1', plant_name: '=HYPERLINK("x")', tenant_id: 'T1', var_id: 'V1', plant_season: 'MT2-2026' }] });
    const { rows, summary } = await svc.report('T1');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await svc.toXlsx(rows, summary)) as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Akurasi Model', 'Ringkasan']);
    expect(wb.getWorksheet('Akurasi Model')!.getRow(2).getCell(1).value).toBe(`'=HYPERLINK("x")`);
    expect(wb.getWorksheet('Ringkasan')!.getRow(1).getCell(2).value).toBe(1);
  });
});

describe('CalibrationController roles', () => {
  const roles = (n: keyof CalibrationController) => [...Reflect.getMetadata(ROLES_KEY, CalibrationController.prototype[n])].sort();
  it('calibration is admin and agronom only (no tenant admin, no operator)', () => {
    expect(roles('report')).toEqual(['admin', 'agronom']);
    expect(roles('apply')).toEqual(['admin', 'agronom']);
  });
  it('the accuracy report is open to admin, tenant admin and agronom', () => {
    expect(roles('accuracyReport')).toEqual(['admin', 'agronom', 'tenant_admin']);
  });
});
