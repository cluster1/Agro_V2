import { BadRequestException } from '@nestjs/common';
import { Between, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { makeManager } from '../test-utils/fake-manager';
import { Plant } from '../plant/entities/plant.entity';
import { Harvest } from '../harvest/entities/harvest.entity';
import { Activity } from '../activity/entities/activity.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { Material } from '../ref/entities/material.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Site } from '../site/entities/site.entity';
import { Simulation } from '../model/entities/simulation.entity';
import { addDays, today } from '../plant/plant-rules';
import { FarmDashboardService } from './farm-dashboard.service';
import { ProductionReportService } from './production-report.service';
import { CostReportService } from './cost-report.service';
import { ReportingController } from './reporting.controller';

const build = <S>(Service: new (repo: any) => S, entity: unknown, tables: Map<unknown, any[]>, extra: Record<string, unknown> = {}) => {
  const manager = { ...makeManager(tables), ...extra };
  return new Service({ ...manager.getRepository(entity), manager });
};

describe('FarmDashboardService', () => {
  const future = (days: number) => addDays(today(), days);
  const plots = [
    { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', plant_name: 'Petak 1', phase_id: 'PH-ANAKAN', plant_area: 2, plant_health: 'Sehat', plant_sts: 1 },
    { plant_id: 'P2', tenant_id: 'T1', site_id: 'S1', plant_name: 'Petak 2', phase_id: 'PH-ANAKAN', plant_area: 1.5, plant_health: null, plant_sts: 1, plant_harvest_date: future(40) },
    { plant_id: 'P3', tenant_id: 'T1', site_id: 'S2', plant_name: 'Petak 3', phase_id: null, plant_area: 1, plant_health: ' ', plant_sts: 1, plant_harvest_date: '2000-01-01' },
    { plant_id: 'P4', tenant_id: 'T2', site_id: 'S9', plant_name: 'Lain tenant', phase_id: 'PH-ANAKAN', plant_area: 9, plant_sts: 1 },
    { plant_id: 'P5', tenant_id: 'T1', site_id: 'S1', plant_name: 'Ditutup', phase_id: 'PH-ANAKAN', plant_area: 5, plant_sts: 0 },
  ];
  const tables = () =>
    new Map<unknown, any[]>([
      [Plant, plots],
      [PlantPhase, [{ phase_id: 'PH-ANAKAN', phase_name: 'Anakan', phase_color: '#66BB6A', phase_seq: 2 }]],
      [Simulation, [{ plant_id: 'P1', sim_scenario: 'BASE', sim_is_latest: 1, sim_harvest_date: future(60) }]],
      [ActivityType, [{ actype_id: 'ACT-PD-PUPUK', actype_name: 'Pemupukan' }]],
      [
        Schedule,
        [
          { sched_id: 'A', tenant_id: 'T1', site_id: 'S1', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK', sched_title: 'Pupuk susulan', sched_start_date: `${future(2)} 08:00:00`, sched_end_date: `${future(3)} 08:00:00`, sched_sts: 0 },
          { sched_id: 'B', tenant_id: 'T1', site_id: 'S1', plant_id: 'P2', sched_start_date: `${future(1)} 08:00:00`, sched_end_date: '2000-01-01 08:00:00', sched_sts: 0 },
          { sched_id: 'C', tenant_id: 'T1', site_id: 'S1', plant_id: 'P1', sched_start_date: `${future(1)} 08:00:00`, sched_end_date: `${future(2)} 08:00:00`, sched_sts: 2 },
          { sched_id: 'D', tenant_id: 'T1', site_id: 'S1', plant_id: 'P1', sched_start_date: `${future(30)} 08:00:00`, sched_end_date: `${future(31)} 08:00:00`, sched_sts: 0 },
          { sched_id: 'E', tenant_id: 'T2', site_id: 'S9', plant_id: 'P4', sched_start_date: `${future(1)} 08:00:00`, sched_end_date: `${future(2)} 08:00:00`, sched_sts: 0 },
        ],
      ],
    ]);
  const query = jest.fn(async () => [{ total: '3' }]);

  it('counts active plots, area, phases and health inside the tenant', async () => {
    const out = await build(FarmDashboardService, Plant, tables(), { query }).summary('T1');
    expect(out.plants).toBe(3);
    expect(out.area_ha).toBe(4.5);
    expect(out.phases.map((p) => [p.name, p.count, p.area_ha, p.color])).toEqual([
      ['Anakan', 2, 3.5, '#66BB6A'],
      ['Belum ada fase', 1, 1, null],
    ]);
    expect(out.health).toEqual([
      { health: 'Belum dinilai', count: 2 },
      { health: 'Sehat', count: 1 },
    ]);
  });

  it('limits to one site', async () => {
    const out = await build(FarmDashboardService, Plant, tables(), { query }).summary('T1', 'S2');
    expect(out.plants).toBe(1);
    expect(out.area_ha).toBe(1);
  });

  it('picks the nearest harvest ahead, the model projection first and past dates ignored', async () => {
    const out = await build(FarmDashboardService, Plant, tables(), { query }).summary('T1');
    // P1 projected in 60 days (MODEL), P2 planned in 40 days (RENCANA), P3's date is in the past
    expect(out.next_harvest).toEqual({ date: future(40), plant_id: 'P2', plant_name: 'Petak 2', source: 'RENCANA' });
  });

  it('lists open schedules of the coming week with names, late ones flagged', async () => {
    const out = await build(FarmDashboardService, Plant, tables(), { query }).summary('T1');
    // C is done, D is outside the week, E belongs to another tenant
    expect(out.schedules.window_days).toBe(7);
    expect(out.schedules.total).toBe(2);
    expect(out.schedules.items.map((s) => [s.sched_id, s.status, s.plant_name, s.activity])).toEqual([
      ['B', 4, 'Petak 2', null],
      ['A', 0, 'Petak 1', 'Pemupukan'],
    ]);
  });

  it('counts unacknowledged alarms of the tenant, all tenants for a global admin', async () => {
    const q = jest.fn(async () => [{ total: '3' }]);
    const service = build(FarmDashboardService, Plant, tables(), { query: q });
    expect((await service.summary('T1')).open_alerts).toBe(3);
    expect(q).toHaveBeenLastCalledWith(expect.stringContaining('tenant_id = ?'), ['T1']);
    await service.summary(undefined);
    expect(q).toHaveBeenLastCalledWith(expect.not.stringContaining('tenant_id'), []);
  });

  it('handles a tenant without plots', async () => {
    const out = await build(FarmDashboardService, Plant, tables(), { query }).summary('T-EMPTY');
    expect(out).toMatchObject({ plants: 0, area_ha: 0, phases: [], next_harvest: null });
    expect(out.schedules.total).toBe(0);
  });
});

describe('ProductionReportService', () => {
  const tables = () =>
    new Map<unknown, any[]>([
      [
        Plant,
        [
          { plant_id: 'P1', tenant_id: 'T1', site_id: 'S1', plant_name: '=HYPERLINK("http://x")', var_id: 'V1', plant_season: 'MT1-2026' },
          { plant_id: 'P2', tenant_id: 'T1', site_id: 'S1', plant_name: 'Petak 2', var_id: 'V2', plant_season: 'MT2-2026' },
        ],
      ],
      [PlantVariety, [{ var_id: 'V1', var_name: 'Inpari 32' }, { var_id: 'V2', var_name: 'Ciherang' }]],
      [Site, [{ site_id: 'S1', site_name: 'Sawah Subang' }]],
      [
        Harvest,
        [
          { hv_id: 'H1', tenant_id: 'T1', site_id: 'S1', plant_id: 'P1', hv_season: 'MT1-2026', hv_date: '2026-08-01', hv_area: 1, hv_weight: 6000, hv_weight_dry: 5233, hv_yield: 5.23 },
          { hv_id: 'H2', tenant_id: 'T1', site_id: 'S1', plant_id: 'P1', hv_season: 'MT1-2026', hv_date: '2026-08-05', hv_area: 1, hv_weight: 5000, hv_weight_dry: 4000, hv_yield: 4 },
          { hv_id: 'H3', tenant_id: 'T1', site_id: 'S1', plant_id: 'P1', hv_season: 'MT1-2026', hv_date: '2026-08-07', hv_area: 1, hv_weight: 800, hv_weight_dry: null },
          { hv_id: 'H4', tenant_id: 'T1', site_id: 'S1', plant_id: 'P2', hv_season: null, hv_date: '2026-12-01', hv_area: 2, hv_weight: 9000, hv_weight_dry: 7860 },
          { hv_id: 'H5', tenant_id: 'T2', site_id: 'S9', plant_id: 'P9', hv_season: 'MT1-2026', hv_date: '2026-08-01', hv_area: 1, hv_weight: 1, hv_weight_dry: 1 },
        ],
      ],
    ]);
  const service = () => build(ProductionReportService, Harvest, tables());

  it('sums harvests per plot and season; yield is weighted over weighed harvests only', async () => {
    const { rows, summary } = await service().report('T1');
    expect(rows).toHaveLength(2);
    const p1 = rows.find((r) => r.plant_id === 'P1')!;
    expect(p1).toMatchObject({ season: 'MT1-2026', variety: 'Inpari 32', site_name: 'Sawah Subang', harvests: 3, last_date: '2026-08-07', area_ha: 3, gkp_kg: 11800, gkg_kg: 9233 });
    // 9233 kg GKG over the 2 ha that were weighed, not 3 ha
    expect(p1.yield_t_ha).toBe(4.62);
    // a harvest without a season falls back to the plot's season
    expect(rows.find((r) => r.plant_id === 'P2')).toMatchObject({ season: 'MT2-2026', gkg_kg: 7860, yield_t_ha: 3.93 });
    expect(summary).toMatchObject({ plots: 2, area_ha: 5, gkp_kg: 20800, gkg_kg: 17093 });
    expect(summary.yield_t_ha).toBe(4.27); // 17093 / 1000 / 4 ha weighed
  });

  it('filters by season and variety and stays inside the tenant', async () => {
    expect((await service().report('T1', { season: 'MT2-2026' })).rows.map((r) => r.plant_id)).toEqual(['P2']);
    expect((await service().report('T1', { varId: 'V1' })).rows.map((r) => r.plant_id)).toEqual(['P1']);
    expect((await service().report('T2')).rows.map((r) => r.plant_id)).toEqual(['P9']);
    expect((await service().report('T3')).summary).toMatchObject({ plots: 0, area_ha: 0, yield_t_ha: null });
  });

  it('exports XLSX with formula-looking names neutralised', async () => {
    const { rows, summary } = await service().report('T1');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await service().toXlsx(rows, summary)) as any);
    const names = wb.getWorksheet('Produksi')!.getColumn(1).values as string[];
    expect(names.some((n) => n === `'=HYPERLINK("http://x")`)).toBe(true);
    expect(wb.getWorksheet('Ringkasan')).toBeDefined();
  });

  it('renders a PDF, breaking onto more pages when the rows do not fit', async () => {
    const { rows, summary } = await service().report('T1');
    const pdf = await service().toPdf(rows, summary, { season: 'MT1-2026' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (buffer: Buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;
    expect(pages(pdf)).toBe(1);
    const many = Array.from({ length: 80 }, (_, i) => ({ ...rows[0], plant_id: `P${i}`, plant_name: `Petak ${i}` }));
    expect(pages(await service().toPdf(many, summary))).toBeGreaterThan(1);
  });
});

describe('CostReportService', () => {
  const tables = () =>
    new Map<unknown, any[]>([
      [Plant, [{ plant_id: 'P1', tenant_id: 'T1', plant_name: 'Petak 1', plant_area: 2 }]],
      [ActivityType, [{ actype_id: 'ACT-PD-PUPUK', actype_name: 'Pemupukan', actype_category: 'PEMUPUKAN' }, { actype_id: 'ACT-PD-TANAM', actype_name: 'Tanam', actype_category: 'BUDIDAYA' }]],
      [Material, [{ mat_id: 'MAT-UREA', mat_name: 'Urea', mat_n: 46, mat_p2o5: 0, mat_k2o: 0 }]],
      [Unit, [{ unit_id: 'UNIT-KG', unit_symbol: 'kg' }]],
      [
        Activity,
        [
          { pact_id: 'A1', tenant_id: 'T1', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK', mat_id: 'MAT-UREA', unit_id: 'UNIT-KG', pact_value: '150', pact_cost: 100000, pact_worker: 2, pact_date: '2026-09-29 09:00:00', pact_sts: 1, sched_id: 'S1' },
          { pact_id: 'A2', tenant_id: 'T1', plant_id: 'P1', actype_id: 'ACT-PD-TANAM', pact_material: '=cmd', pact_date: '2026-09-10 07:00:00', pact_sts: 2 },
          { pact_id: 'A3', tenant_id: 'T1', plant_id: 'P1', actype_id: 'ACT-PD-TANAM', pact_cost: 999, pact_date: '2026-09-11 07:00:00', pact_sts: 3 },
          { pact_id: 'A4', tenant_id: 'T1', plant_id: 'P1', actype_id: 'ACT-PD-TANAM', pact_cost: 5, pact_date: '2026-10-05 07:00:00', pact_sts: 1 },
          { pact_id: 'A5', tenant_id: 'T2', plant_id: 'P9', actype_id: 'ACT-PD-TANAM', pact_cost: 7, pact_date: '2026-09-12 07:00:00', pact_sts: 1 },
        ],
      ],
      [
        Schedule,
        [
          { sched_id: 'S1', tenant_id: 'T1', plant_id: 'P1', actype_id: 'ACT-PD-PUPUK', sched_title: 'Urea', sched_start_date: '2026-09-28 08:00:00', sched_end_date: '2026-09-29 08:00:00', sched_sts: 0 },
          { sched_id: 'S2', tenant_id: 'T1', plant_id: 'P1', sched_start_date: '2026-09-15 08:00:00', sched_end_date: '2000-01-01 08:00:00', sched_sts: 0 },
          { sched_id: 'S3', tenant_id: 'T1', plant_id: 'P1', sched_start_date: '2026-09-16 08:00:00', sched_end_date: '2026-09-17 08:00:00', sched_sts: 3 },
          { sched_id: 'S4', tenant_id: 'T1', plant_id: 'P1', sched_start_date: '2026-09-20 08:00:00', sched_end_date: '2999-01-01 08:00:00', sched_sts: 0 },
          { sched_id: 'S5', tenant_id: 'T1', plant_id: 'P1', sched_start_date: '2026-11-20 08:00:00', sched_end_date: '2999-01-01 08:00:00', sched_sts: 0 },
        ],
      ],
    ]);
  const service = () => build(CostReportService, Activity, tables());
  const sept = { from: '2026-09-01', to: '2026-09-30' };

  it('lists saved activities of the period with nutrient input per ha, cost and workers', async () => {
    const { rows, summary } = await service().report('T1', sept);
    // A3 is rejected, A4 is outside the period, A5 is another tenant
    expect(rows.map((r) => r.pact_id)).toEqual(['A2', 'A1']);
    expect(rows[1]).toMatchObject({ date: '2026-09-29', plant_name: 'Petak 1', activity: 'Pemupukan', material: 'Urea', amount: '150 kg', workers: 2, cost: 100000 });
    expect(rows[0]).toMatchObject({ cost: null, n_kg_ha: null, material: '=cmd' });
    expect(summary).toMatchObject({ activities: 2, workers: 2, cost: 100000, cost_missing: 1 });
  });

  it('works out nutrient input per hectare from the plot area (150 kg urea over 2 ha is 34.5 kg N/ha)', async () => {
    const { rows } = await service().report('T1', sept);
    expect(rows.find((r) => r.pact_id === 'A1')).toMatchObject({ n_kg_ha: 34.5, p2o5_kg_ha: 0, k2o_kg_ha: 0 });
  });

  it('compares plan with actual: a linked activity fulfils the schedule', async () => {
    const { plan, summary } = await service().report('T1', sept);
    expect(plan.map((p) => [p.sched_id, p.status])).toEqual([
      ['S2', 'Terlambat'],
      ['S3', 'Batal'],
      ['S4', 'Rencana'],
      ['S1', 'Selesai'],
    ]);
    expect(plan.find((p) => p.sched_id === 'S1')!.done_date).toBe('2026-09-29');
    expect(summary.plan).toEqual({ planned: 4, done: 1, open: 1, overdue: 1, cancelled: 1, completion_pct: 33.3 });
  });

  it('without a period it takes everything of the tenant', async () => {
    const { rows, plan } = await service().report('T1');
    expect(rows.map((r) => r.pact_id)).toEqual(['A2', 'A1', 'A4']);
    expect(plan).toHaveLength(5);
  });

  it('exports XLSX with the plan sheet and neutralised text', async () => {
    const report = await service().report('T1', sept);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await service().toXlsx(report)) as any);
    const materials = wb.getWorksheet('Kegiatan & Biaya')!.getColumn(4).values as string[];
    expect(materials).toContain("'=cmd");
    expect(wb.getWorksheet('Rencana vs Realisasi')!.rowCount).toBe(5);
    expect(wb.getWorksheet('Ringkasan')).toBeDefined();
  });
});

describe('ReportingController period validation', () => {
  const controller = new ReportingController({} as any, {} as any, { report: jest.fn() } as any);
  const res = {} as any;

  it('rejects a period that ends before it starts', async () => {
    await expect(controller.costReport('T1', { from: '2026-09-30', to: '2026-09-01' }, res)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a period longer than a year', async () => {
    await expect(controller.costReport('T1', { from: '2025-01-01', to: '2026-09-01' }, res)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('fake manager operators used by the reports', () => {
  // the fake manager reads the private _type/_value of typeorm's FindOperator
  it('matches the typeorm helpers it stands in for', () => {
    expect((In(['a']) as any)._type).toBe('in');
    expect((Between('a', 'b') as any)._type).toBe('between');
    expect((Between('a', 'b') as any)._value).toEqual(['a', 'b']);
  });
});
