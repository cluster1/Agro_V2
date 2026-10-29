import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Plant } from '../plant/entities/plant.entity';
import { Observation, OBSERVATION_STATUS } from '../observation/entities/observation.entity';
import { Schedule, SCHEDULE_STATUS } from '../schedule/entities/schedule.entity';
import { Media } from '../media/entities/media.entity';
import { Site } from '../site/entities/site.entity';
import { Device } from '../device/entities/device.entity';
import { Sensor } from '../sensor/entities/sensor.entity';
import { DeviceSensor } from '../device-sensor/entities/device-sensor.entity';
import { SensorReadUpdate } from '../monitoring/entities/sensor-read-update.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { Simulation } from './entities/simulation.entity';
import { WeatherDailyRow } from './entities/weather-daily.entity';
import { ModelService } from './model.service';
import { buildCurves } from './growth-engine';
import { scoped } from '../common/utils/scope';
import { addDays, daysBetween, today } from '../plant/plant-rules';

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (v: Date | string | null | undefined): string | null =>
  !v ? null : v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : String(v).slice(0, 10);

const safeJson = (text: string | null | undefined): Record<string, unknown> | null => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const FORECAST_DAYS = 7;
const OBS_LIMIT = 60;
const MEDIA_LIMIT = 200;

@Injectable()
export class TwinService {
  constructor(
    @InjectRepository(Plant)
    private readonly plants: Repository<Plant>,
    private readonly model: ModelService,
  ) {}

  private get manager() {
    return this.plants.manager;
  }

  /**
   * One object for the Digital Twin page of a plant (NFR-03: a single call, no N+1):
   * identity, phase and age, reference curves, observations, latest run, nutrients, yield,
   * nearest model recommendation, linked sensors, weather and media.
   */
  async plantTwin(plantId: string, scope: string | undefined) {
    const plant = await this.plants.findOne({ where: scoped({ plant_id: plantId }, scope) });
    if (!plant) throw new NotFoundException(`Tanaman ${plantId} tidak ditemukan`);
    const now = today();

    const [variety, phases, varietyPhases] = await Promise.all([
      plant.var_id ? this.manager.getRepository(PlantVariety).findOne({ where: { var_id: plant.var_id } }) : null,
      this.manager.getRepository(PlantPhase).find({ where: { ptype_id: plant.ptype_id }, order: { phase_seq: 'ASC' } }),
      plant.var_id ? this.manager.getRepository(VarietyPhase).find({ where: { var_id: plant.var_id } }) : [],
    ]);
    const [latest, scenarioRuns] = await Promise.all([
      this.model.latest(plant.plant_id, 'BASE'),
      Promise.all(['KERING', 'BASAH'].map((s) => this.model.latest(plant.plant_id, s))),
    ]);

    const observationRows = (await this.manager
      .getRepository(Observation)
      .find({ where: { plant_id: plant.plant_id }, order: { obs_date: 'DESC' }, take: OBS_LIMIT })) as Observation[];
    const observations = observationRows
      .filter((o) => o.obs_sts === OBSERVATION_STATUS.SAVED || o.obs_sts === OBSERVATION_STATUS.VERIFIED)
      .reverse()
      .map((o) => ({
        obs_id: o.obs_id,
        date: dayOf(o.obs_date),
        age: o.obs_age,
        phase_id: o.phase_id,
        height: o.obs_height ?? null,
        tiller: o.obs_tiller ?? null,
        bwd: o.obs_bwd ?? null,
        panicle: o.obs_panicle ?? null,
        grain: o.obs_grain ?? null,
        filled_pct: o.obs_filled_pct ?? null,
        phase_pct: o.obs_phase_pct ?? null,
        pest_name: o.obs_pest_name ?? null,
        pest_pct: o.obs_pest_pct ?? null,
        symptoms: (o.obs_symptom ?? '').split(',').filter(Boolean),
        status: o.obs_sts,
        source: o.obs_source ?? null,
      }));

    const phaseById = new Map(phases.map((p) => [p.phase_id, p as PlantPhase]));
    const phaseNow = this.currentPhase(latest?.phases ?? [], now, phaseById) ?? (plant.phase_id ? phaseById.get(plant.phase_id) : undefined);

    const curve = buildCurves(
      (varietyPhases as VarietyPhase[]).map((v) => ({ end_age: v.vp_end_age, height: v.vp_height_ref, tiller: v.vp_tiller_ref })),
    );
    const refPoints = (points: { age: number; value: number }[]) => [{ age: 0, value: 0 }, ...points];

    const sim = latest?.simulation;
    const param = safeJson(sim?.sim_param);
    const bwdLatest = [...observations].reverse().find((o) => o.bwd !== null)?.bwd ?? null;
    const symptomsLatest = observations.length ? observations[observations.length - 1].symptoms : [];

    const recommendation = await this.nearestRecommendation(plant.plant_id, now);
    const [sensors, weather, media] = await Promise.all([this.sensors(plant), this.weather(plant, now), this.media(plant)]);

    return {
      plant: {
        plant_id: plant.plant_id,
        name: plant.plant_name,
        season: plant.plant_season,
        status: plant.plant_sts,
        area_ha: plant.plant_area,
        hills: plant.plant_count,
        sow_date: dayOf(plant.plant_sow_date),
        plant_date: dayOf(plant.plant_date),
        harvest_date: dayOf(plant.plant_harvest_date),
        phase_mode: plant.plant_phase_mode,
        health: plant.plant_health,
        lon: plant.plant_lon,
        lat: plant.plant_lat,
        geom: safeJson(plant.plant_geom),
        cluster_id: plant.cluster_id,
        site_id: plant.site_id,
      },
      variety: variety
        ? {
            var_id: variety.var_id,
            name: variety.var_name,
            maturity: variety.var_maturity,
            yield_avg: variety.var_yield_avg,
            yield_potential: variety.var_yield_potential,
            grain_weight: variety.var_grain_weight,
            tbase: variety.var_tbase,
            tmax: variety.var_tmax,
          }
        : null,
      now: {
        date: now,
        age: plant.plant_date ? daysBetween(dayOf(plant.plant_date) as string, now) : null,
        phase: phaseNow ? { phase_id: phaseNow.phase_id, name: phaseNow.phase_name, code: phaseNow.phase_code, seq: phaseNow.phase_seq, color: phaseNow.phase_color } : null,
      },
      phases: phases.map((p) => ({ phase_id: p.phase_id, name: p.phase_name, code: p.phase_code, seq: p.phase_seq, color: p.phase_color })),
      reference: { height: refPoints(curve.height), tiller: refPoints(curve.tiller), bwd_min: this.bwdMin(varietyPhases as VarietyPhase[], phaseNow?.phase_id) },
      observations,
      simulation: sim
        ? {
            sim_id: sim.sim_id,
            date: sim.sim_date,
            model: sim.sim_model,
            version: sim.sim_model_ver,
            scenario: sim.sim_scenario,
            age_now: sim.sim_age_now,
            gdd_now: sim.sim_gdd_now,
            note: sim.sim_note,
            param,
            timeline: (latest!.phases).map((p) => ({
              phase_id: p.phase_id,
              seq: p.sp_seq,
              start: dayOf(p.sp_start_date),
              end: dayOf(p.sp_end_date),
              start_age: p.sp_start_age,
              data_type: p.sp_data_type,
              actual_date: dayOf(p.sp_actual_date),
              error_day: p.sp_error_day,
              name: phaseById.get(p.phase_id)?.phase_name ?? p.phase_id,
              color: phaseById.get(p.phase_id)?.phase_color ?? null,
            })),
          }
        : null,
      growth: { index: sim?.sim_growth_idx ?? null, stunted: sim?.sim_growth_idx != null && sim.sim_growth_idx < 0.85, needs_observation: sim ? sim.sim_growth_idx == null : true },
      nutrients: {
        n_def: sim?.sim_n_def ?? null,
        p2o5_def: sim?.sim_p2o5_def ?? null,
        k2o_def: sim?.sim_k2o_def ?? null,
        bwd: bwdLatest,
        symptoms: symptomsLatest,
        soil_p: param?.soil_p ?? null,
        soil_k: param?.soil_k ?? null,
      },
      yield: sim
        ? {
            value: sim.sim_yield ?? null,
            low: sim.sim_yield_low ?? null,
            high: sim.sim_yield_high ?? null,
            confidence: sim.sim_confidence ?? null,
            method: param?.yield_method ?? null,
            factors: param ? { f_growth: param.f_growth, f_n: param.f_n, f_pest: param.f_pest } : null,
            harvest_date: dayOf(sim.sim_harvest_date),
            avg: variety?.var_yield_avg ?? null,
            potential: variety?.var_yield_potential ?? null,
          }
        : null,
      scenarios: scenarioRuns
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => ({ scenario: r.simulation.sim_scenario, harvest_date: dayOf(r.simulation.sim_harvest_date), yield: r.simulation.sim_yield ?? null })),
      recommendation,
      sensors,
      weather,
      media,
    };
  }

  /** Plants of a site for the twin's plot selector and 2D map (one query per table, no per-plant calls). */
  async siteTwin(siteId: string | undefined, scope: string | undefined) {
    const where: Record<string, unknown> = { plant_sts: 1 };
    if (siteId) where.site_id = siteId;
    const plants = (await this.plants.find({ where: scoped(where, scope), order: { plant_name: 'ASC' } })) as Plant[];
    if (!plants.length) return [];

    const phases = (await this.manager.getRepository(PlantPhase).find({ where: { ptype_id: In([...new Set(plants.map((p) => p.ptype_id).filter(Boolean))]) } })) as PlantPhase[];
    const phaseById = new Map(phases.map((p) => [p.phase_id, p]));
    const sims = (await this.manager
      .getRepository(Simulation)
      .find({ where: { plant_id: In(plants.map((p) => p.plant_id)), sim_scenario: 'BASE', sim_is_latest: 1 } })) as Simulation[];
    const simByPlant = new Map(sims.map((s) => [s.plant_id, s]));
    const now = today();

    return plants.map((p) => {
      const phase = p.phase_id ? phaseById.get(p.phase_id) : undefined;
      const sim = simByPlant.get(p.plant_id);
      return {
        plant_id: p.plant_id,
        name: p.plant_name,
        cluster_id: p.cluster_id,
        site_id: p.site_id,
        season: p.plant_season,
        area_ha: p.plant_area,
        age: p.plant_date ? daysBetween(dayOf(p.plant_date) as string, now) : null,
        health: p.plant_health,
        phase: phase ? { phase_id: phase.phase_id, name: phase.phase_name, color: phase.phase_color, seq: phase.phase_seq } : null,
        lon: p.plant_lon,
        lat: p.plant_lat,
        geom: safeJson(p.plant_geom),
        harvest_date: dayOf(sim?.sim_harvest_date),
        yield: sim?.sim_yield ?? null,
        growth_index: sim?.sim_growth_idx ?? null,
      };
    });
  }

  /**
   * Coordinates for the twin map: sites of the active plants, plus their devices and sensors.
   * Raw coordinates are returned (null when unset); the client falls back to the site point.
   */
  async mapData(siteId: string | undefined, scope: string | undefined) {
    const where: Record<string, unknown> = { plant_sts: 1 };
    if (siteId) where.site_id = siteId;
    const plants = (await this.plants.find({ where: scoped(where, scope) })) as Plant[];
    const siteIds = [...new Set(plants.map((p) => p.site_id).filter(Boolean))];
    if (!siteIds.length) return { sites: [], devices: [], sensors: [] };

    const [sites, devices] = await Promise.all([
      this.manager.getRepository(Site).find({ where: scoped({ site_id: In(siteIds) }, scope) }) as Promise<Site[]>,
      this.manager.getRepository(Device).find({ where: scoped({ site_id: In(siteIds) }, scope) }) as Promise<Device[]>,
    ]);
    const sensors = devices.length
      ? ((await this.manager.getRepository(Sensor).find({ where: scoped({ dev_id: In(devices.map((d) => d.dev_id)) }, scope) })) as Sensor[])
      : [];
    const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

    return {
      sites: sites.map((s) => ({ site_id: s.site_id, name: s.site_name, lat: num(s.site_lat), lon: num(s.site_lon) })),
      devices: devices.map((d) => ({
        dev_id: d.dev_id,
        name: d.dev_name,
        site_id: d.site_id,
        cluster_id: d.cluster_id ?? null,
        lat: num(d.dev_lat),
        lon: num(d.dev_lon),
        location: d.dev_location ?? null,
        number_id: d.dev_number_id ?? null,
        image: d.dev_img ?? null,
        status: d.dev_sts ?? null,
      })),
      sensors: sensors.map((s) => ({
        sens_id: s.sens_id,
        dev_id: s.dev_id,
        name: s.sens_name,
        type: s.sens_type ?? null,
        location: s.sens_location ?? null,
        lat: num(s.sens_lat),
        lon: num(s.sens_lon),
      })),
    };
  }

  private currentPhase(timeline: { phase_id: string; sp_start_date: Date | string }[], now: string, byId: Map<string, PlantPhase>) {
    let cur: string | undefined;
    for (const p of timeline) if ((dayOf(p.sp_start_date) as string) <= now) cur = p.phase_id;
    return cur ? byId.get(cur) : undefined;
  }

  private bwdMin(varietyPhases: VarietyPhase[], phaseId: string | undefined): number | null {
    return varietyPhases.find((v) => v.phase_id === phaseId)?.vp_bwd_min ?? null;
  }

  private async nearestRecommendation(plantId: string, now: string) {
    const rows = (await this.manager.getRepository(Schedule).find({ where: { plant_id: plantId, sched_source: 'MODEL' } })) as Schedule[];
    const open = rows
      .filter((s) => s.sched_sts === SCHEDULE_STATUS.PLANNED || s.sched_sts === SCHEDULE_STATUS.OVERDUE)
      .sort((a, b) => (dayOf(a.sched_start_date) as string).localeCompare(dayOf(b.sched_start_date) as string));
    const next = open.find((s) => (dayOf(s.sched_start_date) as string) >= addDays(now, -RECENT_DAYS)) ?? open[0];
    return next
      ? { sched_id: next.sched_id, title: next.sched_title, start: dayOf(next.sched_start_date), description: next.sched_desc, plan_value: next.sched_plan_value }
      : null;
  }

  private async sensors(plant: Plant) {
    const links = (await this.manager.getRepository(DeviceSensor).find({ where: { cluster_id: plant.cluster_id } })) as DeviceSensor[];
    const own = links.filter((d) => !d.plant_id || d.plant_id === plant.plant_id);
    if (!own.length) return [];
    const reads = (await this.manager
      .getRepository(SensorReadUpdate)
      .find({ where: { ds_id: In(own.map((d) => d.ds_id)) } })) as SensorReadUpdate[];
    const last = new Map(reads.map((r) => [`${r.dev_id}|${r.ds_id}`, r]));
    return own.map((d) => {
      const r = last.get(`${d.dev_id}|${d.ds_id}`);
      return {
        ds_id: d.ds_id,
        dev_id: d.dev_id,
        sens_id: d.sens_id ?? null,
        name: d.ds_name,
        kt_id: d.kt_id ?? null,
        value: r ? Number(r.read_update_value) : null,
        read_at: r?.read_update_date ?? null,
        warn_min: d.ds_min_val_warn ?? null,
        warn_max: d.ds_max_val_warn ?? null,
        norm_min: d.ds_min_norm_value ?? null,
        norm_max: d.ds_max_norm_value ?? null,
      };
    });
  }

  private async weather(plant: Plant, now: string) {
    const rows = (await this.manager.getRepository(WeatherDailyRow).find({ where: { site_id: plant.site_id }, order: { wd_date: 'DESC' }, take: 40 })) as WeatherDailyRow[];
    const row = (r: WeatherDailyRow) => ({
      date: dayOf(r.wd_date),
      type: r.wd_type,
      tmin: r.wd_tmin ?? null,
      tmax: r.wd_tmax ?? null,
      rain: r.wd_rain ?? null,
      rh: r.wd_rh_mean ?? null,
    });
    const actual = rows.filter((r) => r.wd_type === 'ACTUAL' && (dayOf(r.wd_date) as string) < now);
    const forecast = rows
      .filter((r) => r.wd_type === 'FORECAST' && (dayOf(r.wd_date) as string) >= now)
      .sort((a, b) => (dayOf(a.wd_date) as string).localeCompare(dayOf(b.wd_date) as string))
      .slice(0, FORECAST_DAYS);
    return { latest: actual[0] ? row(actual[0]) : null, forecast: forecast.map(row) };
  }

  private async media(plant: Plant) {
    const rows = (await this.manager.getRepository(Media).find({ where: { plant_id: plant.plant_id }, order: { media_date: 'DESC' }, take: MEDIA_LIMIT })) as Media[];
    return rows.map((m) => ({
      media_id: m.media_id,
      type: m.media_type,
      path: m.media_path,
      description: m.media_desc,
      date: m.media_date,
      age: m.media_date && plant.plant_date ? daysBetween(dayOf(plant.plant_date) as string, dayOf(m.media_date) as string) : null,
      lon: m.media_lon ?? null,
      lat: m.media_lat ?? null,
      pact_id: m.pact_id ?? null,
      obs_id: m.obs_id ?? null,
    }));
  }
}

const RECENT_DAYS = 3;
