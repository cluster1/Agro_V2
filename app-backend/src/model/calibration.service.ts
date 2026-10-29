import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Plant } from '../plant/entities/plant.entity';
import { Observation, OBSERVATION_STATUS } from '../observation/entities/observation.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { ModelService } from './model.service';
import { scoped } from '../common/utils/scope';
import { dayOf, daysBetween } from '../plant/plant-rules';
import { mean, round } from './model-config';

/** Plots needed before a calibration proposal is offered (FSD F-MDL-07). */
export const MIN_PLOTS = 3;
/** A phase counts as reached when this share of the population is in it. */
export const REACHED_PCT = 50;

export interface PhaseObservation {
  plant_id: string;
  plant_name: string | null;
  date: string;
  age: number;
  gdd: number | null;
  diff_age: number | null;
  diff_gdd: number | null;
}

export interface CalibrationPhase {
  phase_id: string;
  name: string;
  seq: number;
  vp_id: string;
  source: string | null;
  estimate: { start_age: number | null; end_age: number | null; gdd_start: number | null; gdd_end: number | null };
  observed: PhaseObservation[];
  n_plots: number;
  mean_age: number | null;
  mean_gdd: number | null;
  diff_age: number | null;
  diff_gdd: number | null;
  proposal: { start_age: number; gdd_start: number } | null;
}

export interface CalibrationReport {
  variety: { var_id: string; name: string };
  min_plots: number;
  phases: CalibrationPhase[];
}

export interface ApplyResult {
  applied: { phase_id: string; vp_id: string; gdd_start: number; start_age: number }[];
  skipped: { phase_id: string; reason: string }[];
}

interface Actor {
  user_id: string;
  user_role: string;
}

@Injectable()
export class CalibrationService {
  private readonly audit = new Logger('RefAudit');

  constructor(
    @InjectRepository(VarietyPhase)
    private readonly varietyPhases: Repository<VarietyPhase>,
    private readonly model: ModelService,
  ) {}

  private get manager() {
    return this.varietyPhases.manager;
  }

  /**
   * Per phase of a variety: the estimate, the dates observed on the caller's plots (verified
   * observations with >= 50% of the population in the phase), their GDD, and the difference.
   * A proposal (mean observed GDD and age) is offered once at least 3 plots agree.
   */
  async report(varId: string, scope: string | undefined): Promise<CalibrationReport> {
    const variety = (await this.manager.getRepository(PlantVariety).findOne({ where: { var_id: varId } })) as PlantVariety | null;
    if (!variety) throw new NotFoundException(`Varietas ${varId} tidak ditemukan`);

    const [generic, rows] = await Promise.all([
      this.manager.getRepository(PlantPhase).find({ where: { ptype_id: variety.ptype_id }, order: { phase_seq: 'ASC' } }),
      this.manager.getRepository(VarietyPhase).find({ where: { var_id: varId } }),
    ]);
    const phases = generic as PlantPhase[];
    const vpByPhase = new Map((rows as VarietyPhase[]).map((v) => [v.phase_id, v]));

    const plants = (await this.manager
      .getRepository(Plant)
      .find({ where: scoped({ var_id: varId }, scope) })) as Plant[];
    const plantById = new Map(plants.map((p) => [p.plant_id, p]));
    const observations = plants.length
      ? ((await this.manager
          .getRepository(Observation)
          .find({ where: { plant_id: In(plants.map((p) => p.plant_id)), obs_sts: OBSERVATION_STATUS.VERIFIED } })) as Observation[])
      : [];

    // earliest verified "reached" observation per plant and phase
    const first = new Map<string, Observation>();
    for (const o of observations) {
      if (!o.phase_id || (o.obs_phase_pct ?? 0) < REACHED_PCT) continue;
      const key = `${o.plant_id}|${o.phase_id}`;
      const cur = first.get(key);
      if (!cur || dayOf(o.obs_date) < dayOf(cur.obs_date)) first.set(key, o);
    }
    const byPhase = new Map<string, Observation[]>();
    for (const o of first.values()) byPhase.set(o.phase_id, [...(byPhase.get(o.phase_id) ?? []), o]);

    // GDD up to a date is the same for every phase of a plant that reaches it on that date
    const gddCache = new Map<string, Promise<number | null>>();
    const gddOf = (plant: Plant, date: string) => {
      const key = `${plant.plant_id}|${date}`;
      if (!gddCache.has(key)) gddCache.set(key, this.model.gddUntil(plant, variety, date));
      return gddCache.get(key)!;
    };

    const out: CalibrationPhase[] = [];
    for (const phase of phases) {
      const vp = vpByPhase.get(phase.phase_id);
      if (!vp) continue;
      const observed: PhaseObservation[] = [];
      for (const o of byPhase.get(phase.phase_id) ?? []) {
        const plant = plantById.get(o.plant_id)!;
        if (!plant.plant_date) continue;
        const date = dayOf(o.obs_date);
        const age = daysBetween(dayOf(plant.plant_date), date);
        const gdd = await gddOf(plant, date);
        observed.push({
          plant_id: plant.plant_id,
          plant_name: plant.plant_name ?? null,
          date,
          age,
          gdd,
          diff_age: vp.vp_start_age !== null && vp.vp_start_age !== undefined ? age - vp.vp_start_age : null,
          diff_gdd: gdd !== null && vp.vp_gdd_start !== null && vp.vp_gdd_start !== undefined ? round(gdd - vp.vp_gdd_start, 0) : null,
        });
      }
      observed.sort((a, b) => a.date.localeCompare(b.date));

      const withGdd = observed.filter((o) => o.gdd !== null);
      const meanAge = mean(observed.map((o) => o.age), 1);
      const meanGdd = mean(withGdd.map((o) => o.gdd as number), 0);
      const enough = withGdd.length >= MIN_PLOTS;

      out.push({
        phase_id: phase.phase_id,
        name: phase.phase_name,
        seq: phase.phase_seq,
        vp_id: vp.vp_id,
        source: vp.vp_source ?? null,
        estimate: { start_age: vp.vp_start_age ?? null, end_age: vp.vp_end_age ?? null, gdd_start: vp.vp_gdd_start ?? null, gdd_end: vp.vp_gdd_end ?? null },
        observed,
        n_plots: withGdd.length,
        mean_age: meanAge,
        mean_gdd: meanGdd,
        diff_age: meanAge !== null && vp.vp_start_age != null ? round(meanAge - vp.vp_start_age, 1) : null,
        diff_gdd: meanGdd !== null && vp.vp_gdd_start != null ? round(meanGdd - vp.vp_gdd_start, 0) : null,
        proposal: enough && meanGdd !== null && meanAge !== null ? { start_age: Math.round(meanAge), gdd_start: meanGdd } : null,
      });
    }
    return { variety: { var_id: variety.var_id, name: variety.var_name }, min_plots: MIN_PLOTS, phases: out };
  }

  /**
   * Writes the proposals into td_variety_phase and sets the source to KALIBRASI. The previous
   * phase's end is moved to the new start so the series stays continuous. A proposal that would
   * break the increasing order of GDD is skipped.
   */
  async apply(actor: Actor, varId: string, scope: string | undefined, phaseIds?: string[]): Promise<ApplyResult> {
    if (actor.user_role !== 'agronom' && actor.user_role !== 'admin') {
      throw new BadRequestException('Hanya admin dan agronom yang dapat menerapkan kalibrasi');
    }
    const report = await this.report(varId, scope);
    const wanted = phaseIds?.length ? new Set(phaseIds) : null;
    const result: ApplyResult = { applied: [], skipped: [] };
    const phases = report.phases;

    // working copy so each accepted phase is checked against the already-updated neighbours
    const gdd = new Map(phases.map((p) => [p.phase_id, p.estimate.gdd_start]));
    const now = new Date();
    const repo = this.manager.getRepository(VarietyPhase);

    for (const [i, p] of phases.entries()) {
      if (wanted && !wanted.has(p.phase_id)) continue;
      if (!p.proposal) {
        if (wanted) result.skipped.push({ phase_id: p.phase_id, reason: `kurang dari ${MIN_PLOTS} petak teramati` });
        continue;
      }
      const prev = phases[i - 1];
      const next = phases[i + 1];
      const prevGdd = prev ? gdd.get(prev.phase_id) : null;
      const nextGdd = next ? gdd.get(next.phase_id) : null;
      if ((prevGdd != null && p.proposal.gdd_start <= prevGdd) || (nextGdd != null && p.proposal.gdd_start >= nextGdd)) {
        result.skipped.push({ phase_id: p.phase_id, reason: 'urutan GDD antar fase akan terganggu' });
        continue;
      }

      await repo.update(
        { vp_id: p.vp_id },
        { vp_gdd_start: p.proposal.gdd_start, vp_start_age: p.proposal.start_age, vp_source: 'KALIBRASI', vp_update: now },
      );
      if (prev) {
        await repo.update({ vp_id: prev.vp_id }, { vp_gdd_end: p.proposal.gdd_start, vp_end_age: p.proposal.start_age, vp_update: now });
      }
      gdd.set(p.phase_id, p.proposal.gdd_start);
      result.applied.push({ phase_id: p.phase_id, vp_id: p.vp_id, gdd_start: p.proposal.gdd_start, start_age: p.proposal.start_age });
      this.audit.log(JSON.stringify({ action: 'calibrate', resource: 'variety-phases', id: p.vp_id, user_id: actor.user_id, role: actor.user_role }));
    }
    return result;
  }
}
