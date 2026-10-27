import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Plant } from '../plant/entities/plant.entity';
import { Harvest } from '../harvest/entities/harvest.entity';
import { Activity } from '../activity/entities/activity.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { Simulation } from './entities/simulation.entity';
import { SimPhase } from './entities/sim-phase.entity';
import { parseAmount } from '../activity/activity-rules';
import { scoped } from '../common/utils/scope';
import { round } from './model-config';

export const UBINAN_ACTIVITY = 'ACT-PD-UBINAN';

export interface AccuracyFilter {
  varId?: string;
  season?: string;
}

export interface AccuracyRow {
  plant_id: string;
  plant_name: string | null;
  season: string | null;
  var_id: string | null;
  variety: string | null;
  sim_id: string;
  sim_date: Date | string | null;
  phases_compared: number;
  /** mean of |sp_error_day| over compared phases; null when none */
  mean_abs_error_day: number | null;
  phase_errors: { phase_id: string; name: string; error_day: number }[];
  pred_yield: number | null;
  actual_yield: number | null;
  /** (prediction - actual) / actual x 100; positive = over-estimate */
  yield_error_pct: number | null;
  ubinan_yield: number | null;
  ubinan_error_pct: number | null;
}

export interface AccuracySummary {
  runs: number;
  runs_with_phase: number;
  /** mean absolute phase error in days over every compared phase */
  mae_day: number | null;
  runs_with_yield: number;
  /** mean absolute percentage error of the yield prediction against harvest */
  mape_pct: number | null;
  /** signed mean: positive = the model tends to over-predict */
  bias_pct: number | null;
}

export const pctError = (pred: number | null, actual: number | null): number | null =>
  pred === null || actual === null || actual <= 0 ? null : round(((pred - actual) / actual) * 100, 1);

@Injectable()
export class AccuracyService {
  constructor(
    @InjectRepository(Simulation)
    private readonly simulations: Repository<Simulation>,
  ) {}

  private get manager() {
    return this.simulations.manager;
  }

  /**
   * F-MDL-08 / F-RPT-01 "Akurasi Model": per plant, the latest BASE run's phase-date error and its
   * yield prediction against the harvest (and ubinan). Closed seasons keep their last run.
   */
  async report(scope: string | undefined, filter: AccuracyFilter = {}): Promise<{ rows: AccuracyRow[]; summary: AccuracySummary }> {
    const where: Record<string, unknown> = {};
    if (filter.varId) where.var_id = filter.varId;
    if (filter.season) where.plant_season = filter.season;
    const plants = (await this.manager.getRepository(Plant).find({ where: scoped(where, scope) })) as Plant[];
    if (!plants.length) return { rows: [], summary: this.summarise([]) };
    const ids = plants.map((p) => p.plant_id);

    const sims = (await this.simulations.find({ where: { plant_id: In(ids), sim_scenario: 'BASE', sim_is_latest: 1 } })) as Simulation[];
    const simByPlant = new Map(sims.map((s) => [s.plant_id, s]));
    const simIds = sims.map((s) => s.sim_id);

    const [phaseRows, generic, varieties, harvests, ubinan] = await Promise.all([
      simIds.length ? this.manager.getRepository(SimPhase).find({ where: { sim_id: In(simIds) } }) : [],
      this.manager.getRepository(PlantPhase).find({}),
      this.manager.getRepository(PlantVariety).find({}),
      this.manager.getRepository(Harvest).find({ where: { plant_id: In(ids) } }),
      this.manager.getRepository(Activity).find({ where: { plant_id: In(ids), actype_id: UBINAN_ACTIVITY } }),
    ]);

    const phaseName = new Map((generic as PlantPhase[]).map((p) => [p.phase_id, p.phase_name]));
    const varietyName = new Map((varieties as PlantVariety[]).map((v) => [v.var_id, v.var_name]));
    const phasesBySim = new Map<string, SimPhase[]>();
    for (const p of phaseRows as SimPhase[]) phasesBySim.set(p.sim_id, [...(phasesBySim.get(p.sim_id) ?? []), p]);

    // harvest yield = total GKG / total area (weighted), not the mean of per-harvest yields
    const harvestAgg = new Map<string, { gkg: number; area: number }>();
    for (const h of harvests as Harvest[]) {
      if (!h.hv_weight_dry || !h.hv_area) continue;
      const cur = harvestAgg.get(h.plant_id) ?? { gkg: 0, area: 0 };
      cur.gkg += h.hv_weight_dry;
      cur.area += h.hv_area;
      harvestAgg.set(h.plant_id, cur);
    }
    const ubinanBy = new Map<string, number>();
    for (const a of (ubinan as Activity[]).sort((x, y) => String(x.pact_date).localeCompare(String(y.pact_date)))) {
      const v = parseAmount(a.pact_value);
      if (v !== undefined && v > 0) ubinanBy.set(a.plant_id, v); // latest wins
    }

    const rows: AccuracyRow[] = [];
    for (const plant of plants) {
      const sim = simByPlant.get(plant.plant_id);
      if (!sim) continue;
      const errors = (phasesBySim.get(sim.sim_id) ?? [])
        .filter((p) => p.sp_error_day !== null && p.sp_error_day !== undefined)
        .sort((a, b) => (a.sp_seq ?? 0) - (b.sp_seq ?? 0))
        .map((p) => ({ phase_id: p.phase_id, name: phaseName.get(p.phase_id) ?? p.phase_id, error_day: p.sp_error_day }));
      const agg = harvestAgg.get(plant.plant_id);
      const actual = agg && agg.area > 0 ? round(agg.gkg / 1000 / agg.area, 2) : null;
      const pred = sim.sim_yield ?? null;
      const ub = ubinanBy.get(plant.plant_id) ?? null;
      rows.push({
        plant_id: plant.plant_id,
        plant_name: plant.plant_name ?? null,
        season: plant.plant_season ?? null,
        var_id: plant.var_id ?? null,
        variety: plant.var_id ? varietyName.get(plant.var_id) ?? plant.var_id : null,
        sim_id: sim.sim_id,
        sim_date: sim.sim_date,
        phases_compared: errors.length,
        mean_abs_error_day: errors.length ? round(errors.reduce((s, e) => s + Math.abs(e.error_day), 0) / errors.length, 1) : null,
        phase_errors: errors,
        pred_yield: pred,
        actual_yield: actual,
        yield_error_pct: pctError(pred, actual),
        ubinan_yield: ub,
        ubinan_error_pct: pctError(pred, ub),
      });
    }
    rows.sort((a, b) => String(b.season).localeCompare(String(a.season)) || String(a.plant_name).localeCompare(String(b.plant_name)));
    return { rows, summary: this.summarise(rows) };
  }

  summarise(rows: AccuracyRow[]): AccuracySummary {
    const phaseErrors = rows.flatMap((r) => r.phase_errors.map((e) => Math.abs(e.error_day)));
    const yields = rows.map((r) => r.yield_error_pct).filter((v): v is number => v !== null);
    return {
      runs: rows.length,
      runs_with_phase: rows.filter((r) => r.phases_compared > 0).length,
      mae_day: phaseErrors.length ? round(phaseErrors.reduce((a, b) => a + b, 0) / phaseErrors.length, 1) : null,
      runs_with_yield: yields.length,
      mape_pct: yields.length ? round(yields.reduce((s, v) => s + Math.abs(v), 0) / yields.length, 1) : null,
      bias_pct: yields.length ? round(yields.reduce((s, v) => s + v, 0) / yields.length, 1) : null,
    };
  }

  async toXlsx(rows: AccuracyRow[], summary: AccuracySummary): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Akurasi Model');
    ws.columns = [
      { header: 'Petak', key: 'plant_name', width: 28 },
      { header: 'Musim', key: 'season', width: 12 },
      { header: 'Varietas', key: 'variety', width: 22 },
      { header: 'Tanggal run', key: 'sim_date', width: 14 },
      { header: 'Fase dibandingkan', key: 'phases_compared', width: 18 },
      { header: 'Rata-rata |selisih| (hari)', key: 'mean_abs_error_day', width: 24 },
      { header: 'Prediksi hasil (t/ha)', key: 'pred_yield', width: 20 },
      { header: 'Hasil panen (t/ha)', key: 'actual_yield', width: 18 },
      { header: 'Selisih vs panen (%)', key: 'yield_error_pct', width: 20 },
      { header: 'Ubinan (t/ha)', key: 'ubinan_yield', width: 14 },
      { header: 'Selisih vs ubinan (%)', key: 'ubinan_error_pct', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    // plain strings for text so a spreadsheet never interprets a name as a formula
    const text = (v: unknown) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v);
    for (const r of rows) {
      ws.addRow({
        ...r,
        plant_name: text(r.plant_name),
        variety: text(r.variety),
        sim_date: r.sim_date ? String(r.sim_date instanceof Date ? r.sim_date.toISOString() : r.sim_date).slice(0, 10) : '',
      });
    }
    const sum = wb.addWorksheet('Ringkasan');
    sum.addRows([
      ['Jumlah run', summary.runs],
      ['Run dengan data fase', summary.runs_with_phase],
      ['Rata-rata |selisih fase| (hari)', summary.mae_day ?? '-'],
      ['Run dengan data panen', summary.runs_with_yield],
      ['Rata-rata |selisih hasil| (%)', summary.mape_pct ?? '-'],
      ['Bias hasil (%) (+ = prediksi terlalu tinggi)', summary.bias_pct ?? '-'],
    ]);
    sum.columns = [{ width: 44 }, { width: 14 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
