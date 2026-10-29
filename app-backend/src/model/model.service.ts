import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Simulation } from './entities/simulation.entity';
import { SimPhase } from './entities/sim-phase.entity';
import { WeatherDailyRow } from './entities/weather-daily.entity';
import { ClimateNormal } from './entities/climate-normal.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Schedule, SCHEDULE_STATUS } from '../schedule/entities/schedule.entity';
import { Observation, OBSERVATION_STATUS } from '../observation/entities/observation.entity';
import { Activity } from '../activity/entities/activity.entity';
import { SoilProfile } from '../soil/entities/soil-profile.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { Material } from '../ref/entities/material.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { scoped } from '../common/utils/scope';
import { addDays, dayOf, daysBetween, today } from '../plant/plant-rules';
import { nutrientInput, parseAmount } from '../activity/activity-rules';
import { nutrientStatus } from '../soil/soil-rules';
import {
  MODEL_NAME,
  MODEL_VERSION,
  NORMAL_SCENARIO,
  OBSERVATION_MAX_AGE_DAYS,
  RECOMMENDATION_LEAD_DAYS,
  RECOMMENDATION_WINDOW_DAYS,
  Scenario,
  GROWTH_STUNTED_BELOW,
  NITROGEN,
  PHOSPHORUS,
  POTASSIUM,
  YIELD,
  round,
} from './model-config';
import { WeatherDay, dailyGdd, phaseOn, projectTimeline } from './phase-engine';
import { buildCurves, growthIndex } from './growth-engine';
import { advice, hasAdvice, nitrogenDeficit, pkDeficit } from './nutrient-engine';
import { predictYield } from './yield-engine';

const RICE_PTYPE = 'PT-PADI';
const KG_UNIT = 'UNIT-KG';
const PHASE_REACHED_PCT = 50;
const FORECAST_LOOKAHEAD_DAYS = 60;

const doyOf = (day: string): number => {
  const d = Date.parse(`${day}T00:00:00Z`);
  return Math.floor((d - Date.parse(`${day.slice(0, 4)}-01-01T00:00:00Z`)) / 86_400_000) + 1;
};

export interface SimulationView {
  simulation: Simulation;
  phases: SimPhase[];
  detail: Record<string, unknown>;
}

@Injectable()
export class ModelService {
  private readonly logger = new Logger(ModelService.name);

  constructor(
    @InjectRepository(Simulation)
    private readonly simulations: Repository<Simulation>,
  ) {}

  private get manager() {
    return this.simulations.manager;
  }

  // ---------------------------------------------------------------- weather

  /** Weather for one calendar day: actual (past), forecast, then the scenario's climate normal. */
  private async weatherSource(plant: Plant, from: string, scenario: Scenario, now: string) {
    const to = addDays(now, FORECAST_LOOKAHEAD_DAYS);
    const rows = (await this.manager.getRepository(WeatherDailyRow).find({ where: { site_id: plant.site_id } })) as WeatherDailyRow[];
    const actual = new Map<string, WeatherDay>();
    const forecast = new Map<string, WeatherDay>();
    let forecastUntil: string | null = null;
    for (const r of rows) {
      if (r.wd_tmin === null || r.wd_tmax === null || r.wd_tmin === undefined || r.wd_tmax === undefined) continue;
      const day = dayOf(r.wd_date);
      if (day < from || day > to) continue;
      if (r.wd_type === 'ACTUAL') actual.set(day, { tmin: r.wd_tmin, tmax: r.wd_tmax, type: 'ACTUAL' });
      else if (r.wd_type === 'FORECAST') {
        forecast.set(day, { tmin: r.wd_tmin, tmax: r.wd_tmax, type: 'FORECAST' });
        if (!forecastUntil || day > forecastUntil) forecastUntil = day;
      }
    }
    const normalRows = (await this.manager
      .getRepository(ClimateNormal)
      .find({ where: { site_id: plant.site_id, cn_scenario: NORMAL_SCENARIO[scenario] } })) as ClimateNormal[];
    const normal = new Map<number, WeatherDay>();
    for (const n of normalRows) {
      if (n.cn_tmin != null && n.cn_tmax != null) normal.set(n.cn_doy, { tmin: n.cn_tmin, tmax: n.cn_tmax, type: 'NORMAL' });
    }

    const weatherFor = (day: string): WeatherDay | null => {
      if (day < now) return actual.get(day) ?? normal.get(doyOf(day)) ?? null;
      return forecast.get(day) ?? actual.get(day) ?? normal.get(doyOf(day)) ?? null;
    };
    return { weatherFor, forecastUntil };
  }

  // ---------------------------------------------------------------- run

  /**
   * One model run for a plant (F-MDL-01..06): phase projection, growth index, N/P/K deficits,
   * yield prediction. Writes tm_plant_simulation + td_plant_sim_phase, makes it the latest run for
   * its scenario and, for BASE, refreshes the plant phase and the model's fertiliser recommendation.
   */
  async simulate(
    plantId: string,
    scope: string | undefined,
    userId: string | null,
    scenario: Scenario = 'BASE',
    opts: { note?: string } = {},
  ): Promise<SimulationView> {
    const plant = (await this.manager.getRepository(Plant).findOne({ where: scoped({ plant_id: plantId }, scope) })) as Plant | null;
    if (!plant) throw new NotFoundException(`Tanaman ${plantId} tidak ditemukan`);
    if (plant.plant_sts === 0) throw new BadRequestException('Musim tanaman sudah ditutup; simulasi tidak dijalankan');
    if (!plant.plant_date || !plant.plant_sow_date) throw new BadRequestException('Tanggal sebar dan tanam tanaman wajib diisi');

    const now = today();
    const variety = (await this.manager.getRepository(PlantVariety).findOne({ where: { var_id: plant.var_id } })) as PlantVariety | null;
    if (!variety) throw new BadRequestException('Tanaman belum memiliki varietas');

    const phases = (await this.manager.getRepository(PlantPhase).find({ where: { ptype_id: RICE_PTYPE } })) as PlantPhase[];
    const varietyPhases = (await this.manager.getRepository(VarietyPhase).find({ where: { var_id: variety.var_id } })) as VarietyPhase[];

    const { weatherFor, forecastUntil } = await this.weatherSource(plant, plant.plant_sow_date, scenario, now);

    const timeline = projectTimeline({
      sowDate: plant.plant_sow_date,
      plantDate: plant.plant_date,
      today: now,
      tbase: variety.var_tbase ?? 10,
      tmaxVar: variety.var_tmax ?? 42,
      phases,
      varietyPhases,
      weatherFor,
    });
    const current = phaseOn(timeline.phases, now);
    const ageNow = daysBetween(plant.plant_date, now);

    // accumulated GDD from planting to yesterday (null when the weather series has gaps)
    let gddNow: number | null = 0;
    for (let d = 0; d < ageNow && gddNow !== null; d++) {
      const w = weatherFor(addDays(plant.plant_date, d));
      gddNow = w ? gddNow + dailyGdd(w.tmin, w.tmax, variety.var_tbase ?? 10, variety.var_tmax ?? 42) : null;
    }

    // ---- observations (verified only)
    const observations = (await this.manager
      .getRepository(Observation)
      .find({ where: { plant_id: plant.plant_id, obs_sts: OBSERVATION_STATUS.VERIFIED }, order: { obs_date: 'DESC' } })) as Observation[];
    const recentFrom = addDays(now, -OBSERVATION_MAX_AGE_DAYS);
    const recent = observations.filter((o) => dayOf(o.obs_date) >= recentFrom);
    const latest = recent[0] ?? null;
    const firstWith = <K extends keyof Observation>(key: K, list = recent) => list.find((o) => o[key] !== null && o[key] !== undefined);

    const curve = buildCurves(varietyPhases.map((v) => ({ end_age: v.vp_end_age, height: v.vp_height_ref, tiller: v.vp_tiller_ref })));
    const growth = growthIndex(
      latest ? { height: latest.obs_height ?? null, tiller: latest.obs_tiller ?? null } : null,
      latest?.obs_age ?? ageNow,
      curve,
    );

    const vpNow = varietyPhases.find((v) => v.phase_id === current?.phase_id);
    const bwdObs = firstWith('obs_bwd');
    const nitrogen = nitrogenDeficit(bwdObs?.obs_bwd ?? null, vpNow?.vp_bwd_min ?? null, Number(now.slice(5, 7)));

    // ---- soil + fertiliser inputs this season
    const soil = await this.latestSoil(plant);
    const status = soil ? nutrientStatus(soil) : { p_status: null, k_status: null };
    const inputs = await this.fertiliserInputs(plant);
    const pk = pkDeficit(status.p_status, status.k_status, inputs);

    // ---- yield
    const comp = observations.find((o) => o.obs_panicle != null && o.obs_grain != null && o.obs_filled_pct != null);
    const pestObs = firstWith('obs_pest_pct');
    const prediction = predictYield({
      phaseSeq: current?.seq ?? null,
      avgYield: variety.var_yield_avg ?? null,
      potentialYield: variety.var_yield_potential ?? null,
      growthIndex: growth.index,
      bwd: bwdObs?.obs_bwd ?? null,
      pestPct: pestObs?.obs_pest_pct ?? null,
      panicle: comp?.obs_panicle ?? null,
      grain: comp?.obs_grain ?? null,
      filledPct: comp?.obs_filled_pct ?? null,
      hillsPerHa: plant.plant_count && plant.plant_area ? plant.plant_count / plant.plant_area : null,
      grainWeight1000: variety.var_grain_weight ?? null,
    });

    const fert = advice(nitrogen.n_def, pk.p_def, pk.k_def);

    // ---- notes
    const notes: string[] = [];
    if (opts.note) notes.push(opts.note);
    if (timeline.method === 'HST') notes.push('fase dihitung dari umur (cuaca tidak lengkap)');
    if (pk.assumed) notes.push('tanpa data lab tanah');
    if (growth.index === null) notes.push('perlu observasi');
    else if (growth.stunted) notes.push(`pertumbuhan terhambat (GI ${growth.index})`);
    if (nitrogen.n_def > 0) notes.push(`N kurang (BWD ${nitrogen.bwd})`);
    if (pk.p_def > 0 || pk.k_def > 0) notes.push('P/K di bawah rekomendasi');
    const symptoms = (latest?.obs_symptom ?? '').split(',').filter(Boolean);
    if ((symptoms.includes('P_GELAP') && pk.p_def === 0) || (symptoms.includes('K_TEPI') && pk.k_def === 0)) {
      notes.push('gejala P/K perlu dicek');
    }

    const param = {
      scenario,
      weather: timeline.method === 'GDD' ? 'GDD' : 'HST',
      variety: { tbase: variety.var_tbase, topt: variety.var_topt, tmax: variety.var_tmax, yield_avg: variety.var_yield_avg },
      growth: { height_ref: growth.height_ref, tiller_ref: growth.tiller_ref, stunted_below: GROWTH_STUNTED_BELOW },
      bwd: nitrogen.bwd,
      bwd_min: nitrogen.bwd_min,
      urea_koreksi: nitrogen.urea_dose,
      urea_n: NITROGEN.ureaN,
      soil_p: pk.p_status,
      soil_k: pk.k_status,
      p_rek: pk.p_rec,
      k_rek: pk.k_rec,
      p_masuk: pk.p_in,
      k_masuk: pk.k_in,
      sp36_content: PHOSPHORUS.content,
      kcl_content: POTASSIUM.content,
      f_growth: prediction.factors.f_growth,
      f_n: prediction.factors.f_n,
      f_pest: prediction.factors.f_pest,
      target_yield: variety.var_yield_avg,
      yield_method: prediction.method,
      yield_range: prediction.method === 'FAKTOR' ? YIELD.FAKTOR.range : YIELD.KOMPONEN.range,
    };

    const simId = uuidv4().replace(/-/g, '');
    const created = new Date();
    const sim = this.simulations.create({
      sim_id: simId,
      tenant_id: plant.tenant_id,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      var_id: variety.var_id,
      phase_id: current?.phase_id,
      user_id: userId ?? undefined,
      sim_date: created,
      sim_model: MODEL_NAME,
      sim_model_ver: MODEL_VERSION,
      sim_scenario: scenario,
      sim_param: JSON.stringify(param),
      sim_cutoff_date: addDays(now, -1),
      sim_forecast_until: forecastUntil ?? now,
      sim_age_now: ageNow,
      sim_gdd_now: gddNow !== null ? round(gddNow, 0) : undefined,
      sim_growth_idx: growth.index ?? undefined,
      sim_n_def: nitrogen.n_def,
      sim_p2o5_def: pk.p_def,
      sim_k2o_def: pk.k_def,
      sim_harvest_date: timeline.harvest_date ?? undefined,
      sim_yield: prediction.value ?? undefined,
      sim_yield_low: prediction.low ?? undefined,
      sim_yield_high: prediction.high ?? undefined,
      sim_confidence: prediction.confidence,
      sim_note: notes.join('; ').slice(0, 255) || undefined,
      sim_is_latest: 1,
      sim_sts: 1,
      sim_created: created,
    });

    // verified phase observations give the actual start date of a phase (F-MDL-08)
    const actualByPhase = new Map<string, string>();
    for (const o of [...observations].reverse()) {
      if (o.phase_id && (o.obs_phase_pct ?? 0) >= PHASE_REACHED_PCT && !actualByPhase.has(o.phase_id)) {
        actualByPhase.set(o.phase_id, dayOf(o.obs_date));
      }
    }
    const simPhases = timeline.phases.map((p) => {
      const actual = actualByPhase.get(p.phase_id);
      return this.manager.getRepository(SimPhase).create({
        sp_id: uuidv4().replace(/-/g, ''),
        sim_id: simId,
        phase_id: p.phase_id,
        sp_seq: p.seq,
        sp_start_date: p.start_date,
        sp_end_date: p.end_date ?? undefined,
        sp_start_age: p.start_age,
        sp_gdd_start: p.gdd_start ?? undefined,
        sp_data_type: p.data_type,
        sp_actual_date: actual,
        sp_error_day: actual ? daysBetween(actual, p.start_date) : undefined,
      });
    });

    await this.manager.transaction(async (em) => {
      await em.update(Simulation, { plant_id: plant.plant_id, sim_scenario: scenario, sim_is_latest: 1 }, { sim_is_latest: 0 });
      await em.insert(Simulation, sim);
      if (simPhases.length) await em.insert(SimPhase, simPhases);
      if (scenario === 'BASE' && plant.plant_phase_mode !== 'MANUAL' && current && current.phase_id !== plant.phase_id) {
        await em.update(
          Plant,
          { plant_id: plant.plant_id },
          { phase_id: current.phase_id, plant_phase_date: current.start_date > now ? now : current.start_date, plant_update: created },
        );
      }
    });

    let recommendation: Schedule | null = null;
    if (scenario === 'BASE' && hasAdvice(fert)) {
      recommendation = await this.upsertRecommendation(plant, fert, current?.seq ?? 0, now, userId);
    }

    return {
      simulation: sim,
      phases: simPhases,
      detail: {
        method: timeline.method,
        growth,
        nitrogen,
        pk,
        advice: fert,
        yield: prediction,
        soil: soil ? { soil_id: soil.soil_id, sample_date: soil.soil_sample_date, ...status } : null,
        recommendation_sched_id: recommendation?.sched_id ?? null,
      },
    };
  }

  /**
   * GDD accumulated from planting up to (not including) `day` for a plant, using actual weather and
   * the climate normal where actual data is missing. Null when the weather series has a gap.
   */
  async gddUntil(plant: Plant, variety: PlantVariety, day: string): Promise<number | null> {
    if (!plant.plant_date || !plant.plant_sow_date) return null;
    const { weatherFor } = await this.weatherSource(plant, plant.plant_sow_date, 'BASE', today());
    let sum = 0;
    const days = daysBetween(plant.plant_date, day);
    for (let d = 0; d < days; d++) {
      const w = weatherFor(addDays(plant.plant_date, d));
      if (!w) return null;
      sum += dailyGdd(w.tmin, w.tmax, variety.var_tbase ?? 10, variety.var_tmax ?? 42);
    }
    return round(sum, 0);
  }

  /** Never lets a model failure break the caller (observation verification, weekly job). */
  async simulateSafely(plantId: string, userId: string | null, scenario: Scenario = 'BASE', note?: string): Promise<boolean> {
    try {
      await this.simulate(plantId, undefined, userId, scenario, { note });
      return true;
    } catch (error) {
      this.logger.warn(`Simulation of ${plantId} skipped: ${(error as Error)?.message}`);
      return false;
    }
  }

  // ---------------------------------------------------------------- inputs

  private async latestSoil(plant: Plant): Promise<SoilProfile | null> {
    const repo = this.manager.getRepository(SoilProfile);
    const rows = (await repo.find({ where: { cluster_id: plant.cluster_id }, order: { soil_sample_date: 'DESC' } })) as SoilProfile[];
    const own = rows.find((r) => r.plant_id === plant.plant_id) ?? rows.find((r) => !r.plant_id) ?? rows[0];
    return own ?? null;
  }

  /** Sum of nutrients from fertiliser activities of this plant (F-BDY-03 x F-MDL-04). */
  private async fertiliserInputs(plant: Plant) {
    const acts = (await this.manager.getRepository(Activity).find({ where: { plant_id: plant.plant_id } })) as Activity[];
    const matIds = [...new Set(acts.map((a) => a.mat_id).filter(Boolean))] as string[];
    const mats = matIds.length ? ((await this.manager.getRepository(Material).find({ where: { mat_id: In(matIds) } })) as Material[]) : [];
    const byId = new Map(mats.map((m) => [m.mat_id, m]));
    const total = { n_kg_ha: 0, p2o5_kg_ha: 0, k2o_kg_ha: 0 };
    for (const a of acts) {
      if (a.unit_id !== KG_UNIT || !a.mat_id) continue;
      const n = nutrientInput(parseAmount(a.pact_value), byId.get(a.mat_id), plant.plant_area);
      if (!n) continue;
      total.n_kg_ha += n.n_kg_ha;
      total.p2o5_kg_ha += n.p2o5_kg_ha;
      total.k2o_kg_ha += n.k2o_kg_ha;
    }
    return total;
  }

  // ---------------------------------------------------------------- recommendation (F-MDL-05)

  /**
   * Writes the fertiliser advice onto the next open fertilising schedule near the target date, or a
   * new schedule 3 days ahead; `sched_source` becomes MODEL.
   */
  private async upsertRecommendation(
    plant: Plant,
    fert: { urea_kg_ha: number; sp36_kg_ha: number; kcl_kg_ha: number },
    phaseSeq: number,
    now: string,
    userId: string | null,
  ): Promise<Schedule | null> {
    const target = addDays(now, RECOMMENDATION_LEAD_DAYS);
    const area = plant.plant_area ?? 0;
    const part = (label: string, perHa: number) =>
      perHa > 0 ? `${label} ${perHa} kg/ha${area ? ` (${Math.ceil(perHa * area)} kg untuk ${area} ha)` : ''}` : null;
    const desc = `Rekomendasi model: ${[part('Urea', fert.urea_kg_ha), part('SP-36', fert.sp36_kg_ha), part('KCl', fert.kcl_kg_ha)].filter(Boolean).join(', ')}`.slice(0, 255);
    const planValue = [fert.urea_kg_ha && `Urea ${fert.urea_kg_ha}`, fert.sp36_kg_ha && `SP-36 ${fert.sp36_kg_ha}`, fert.kcl_kg_ha && `KCl ${fert.kcl_kg_ha}`]
      .filter(Boolean)
      .join('; ')
      .concat(' kg/ha')
      .slice(0, 64);

    const types = (await this.manager.getRepository(ActivityType).find({ where: { ptype_id: RICE_PTYPE, actype_category: 'PEMUPUKAN' } })) as ActivityType[];
    const fertTypeIds = new Set(types.map((t) => t.actype_id));
    const open = (await this.manager.getRepository(Schedule).find({ where: { plant_id: plant.plant_id } })) as Schedule[];
    const candidates = open
      .filter((s) => fertTypeIds.has(s.actype_id) && (s.sched_sts === SCHEDULE_STATUS.PLANNED || s.sched_sts === SCHEDULE_STATUS.OVERDUE))
      .filter((s) => Math.abs(daysBetween(target, dayOf(s.sched_start_date))) <= RECOMMENDATION_WINDOW_DAYS)
      .sort((a, b) => Math.abs(daysBetween(target, dayOf(a.sched_start_date))) - Math.abs(daysBetween(target, dayOf(b.sched_start_date))));

    const nowDate = new Date();
    if (candidates[0]) {
      const row = candidates[0];
      await this.manager
        .getRepository(Schedule)
        .update({ sched_id: row.sched_id }, { sched_desc: desc, sched_plan_value: planValue, sched_source: 'MODEL', sched_update: nowDate });
      return { ...row, sched_desc: desc, sched_plan_value: planValue, sched_source: 'MODEL' };
    }

    const actypeId = phaseSeq <= 4 ? 'ACT-PD-PUPUK-S1' : 'ACT-PD-PUPUK-S2';
    const type = types.find((t) => t.actype_id === actypeId) ?? types[0];
    if (!type) return null;
    const row = this.manager.getRepository(Schedule).create({
      sched_id: uuidv4().replace(/-/g, ''),
      tenant_id: plant.tenant_id,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      actype_id: type.actype_id,
      user_id: userId ?? undefined,
      sched_title: `${type.actype_name} (rekomendasi model)`,
      sched_desc: desc,
      sched_start_date: `${target} 06:00:00`,
      sched_end_date: `${target} 17:00:00`,
      sched_repeat: 'NONE',
      sched_plan_value: planValue,
      unit_id: KG_UNIT,
      sched_remind: 24,
      sched_source: 'MODEL',
      sched_sts: SCHEDULE_STATUS.PLANNED,
      sched_created: nowDate,
      sched_update: nowDate,
    });
    await this.manager.getRepository(Schedule).insert(row);
    return row;
  }

  // ---------------------------------------------------------------- accuracy (F-MDL-08)

  /** A verified observation reached a phase: stamp the actual date on every run that contains it. */
  async recordPhaseActual(plantId: string, phaseId: string, actualDay: string): Promise<void> {
    const sims = (await this.manager.getRepository(Simulation).find({ where: { plant_id: plantId } })) as Simulation[];
    if (!sims.length) return;
    const rows = (await this.manager
      .getRepository(SimPhase)
      .find({ where: { sim_id: In(sims.map((s) => s.sim_id)), phase_id: phaseId } })) as SimPhase[];
    for (const r of rows) {
      await this.manager
        .getRepository(SimPhase)
        .update({ sp_id: r.sp_id }, { sp_actual_date: actualDay, sp_error_day: daysBetween(actualDay, dayOf(r.sp_start_date)) });
    }
  }

  // ---------------------------------------------------------------- reads

  async history(plantId: string, scope: string | undefined, scenario?: string): Promise<Simulation[]> {
    await this.assertPlant(plantId, scope);
    const where: Record<string, unknown> = { plant_id: plantId };
    if (scenario) where.sim_scenario = scenario;
    return (await this.simulations.find({ where, order: { sim_date: 'DESC' }, take: 100 })) as Simulation[];
  }

  async findOne(simId: string, scope: string | undefined): Promise<{ simulation: Simulation; phases: SimPhase[] }> {
    const sim = await this.simulations.findOne({ where: scoped({ sim_id: simId }, scope) });
    if (!sim) throw new NotFoundException(`Simulasi ${simId} tidak ditemukan`);
    const phases = (await this.manager.getRepository(SimPhase).find({ where: { sim_id: simId }, order: { sp_seq: 'ASC' } })) as SimPhase[];
    return { simulation: sim, phases };
  }

  async latest(plantId: string, scenario = 'BASE'): Promise<{ simulation: Simulation; phases: SimPhase[] } | null> {
    const sim = await this.simulations.findOne({ where: { plant_id: plantId, sim_scenario: scenario, sim_is_latest: 1 } });
    if (!sim) return null;
    const phases = (await this.manager.getRepository(SimPhase).find({ where: { sim_id: sim.sim_id }, order: { sp_seq: 'ASC' } })) as SimPhase[];
    return { simulation: sim, phases };
  }

  private async assertPlant(plantId: string, scope: string | undefined): Promise<Plant> {
    const plant = (await this.manager.getRepository(Plant).findOne({ where: scoped({ plant_id: plantId }, scope) })) as Plant | null;
    if (!plant) throw new NotFoundException(`Tanaman ${plantId} tidak ditemukan`);
    return plant;
  }

  /** All active plants, for the weekly job (scheduler arrives with Tahap 2). */
  async runAllActive(): Promise<{ ran: number; failed: number }> {
    const plants = (await this.manager.getRepository(Plant).find({ where: { plant_sts: 1 } })) as Plant[];
    let ran = 0;
    for (const p of plants) (await this.simulateSafely(p.plant_id, null, 'BASE', 'Run terjadwal mingguan')) ? ran++ : undefined;
    return { ran, failed: plants.length - ran };
  }
}

