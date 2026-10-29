import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Plant } from '../plant/entities/plant.entity';
import { Schedule, SCHEDULE_STATUS } from '../schedule/entities/schedule.entity';
import { effectiveStatus } from '../schedule/schedule.service';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { Simulation } from '../model/entities/simulation.entity';
import { round } from '../model/model-config';
import { addDays, dayOf, today } from '../plant/plant-rules';
import { scoped } from '../common/utils/scope';

export const SCHEDULE_WINDOW_DAYS = 7;
const SCHEDULE_LIMIT = 20;
export const NO_PHASE_LABEL = 'Belum ada fase';
export const NO_HEALTH_LABEL = 'Belum dinilai';

export interface PhaseCount {
  phase_id: string | null;
  name: string;
  color: string | null;
  seq: number;
  count: number;
  area_ha: number;
}

export interface UpcomingSchedule {
  sched_id: string;
  title: string | null;
  start_date: string;
  plant_id: string | null;
  plant_name: string | null;
  activity: string | null;
  status: number;
}

export interface FarmDashboard {
  plants: number;
  area_ha: number;
  phases: PhaseCount[];
  health: { health: string; count: number }[];
  next_harvest: { date: string; plant_id: string; plant_name: string | null; source: 'MODEL' | 'RENCANA' } | null;
  schedules: { window_days: number; total: number; items: UpcomingSchedule[] };
  open_alerts: number;
}

@Injectable()
export class FarmDashboardService {
  constructor(
    @InjectRepository(Plant)
    private readonly plants: Repository<Plant>,
  ) {}

  private get manager() {
    return this.plants.manager;
  }

  /**
   * F-DSB-01: farm cards from the active plots: monitored area, plots per phase and health,
   * nearest projected harvest, schedules of the coming week and open alerts.
   */
  async summary(scope: string | undefined, siteId?: string, now = new Date()): Promise<FarmDashboard> {
    const where: Record<string, unknown> = { plant_sts: 1 };
    if (siteId) where.site_id = siteId;
    const plots = (await this.plants.find({ where: scoped(where, scope) })) as Plant[];
    const day = today();

    const [phases, sims, schedules, openAlerts] = await Promise.all([
      this.manager.getRepository(PlantPhase).find({}),
      plots.length
        ? this.manager.getRepository(Simulation).find({ where: { plant_id: In(plots.map((p) => p.plant_id)), sim_scenario: 'BASE', sim_is_latest: 1 } })
        : [],
      this.manager.getRepository(Schedule).find({
        where: scoped(
          {
            ...(siteId ? { site_id: siteId } : {}),
            sched_start_date: Between(`${day} 00:00:00`, `${addDays(day, SCHEDULE_WINDOW_DAYS)} 23:59:59`),
          },
          scope,
        ),
      }),
      this.openAlerts(scope),
    ]);

    return {
      plants: plots.length,
      area_ha: round(plots.reduce((s, p) => s + (p.plant_area ?? 0), 0), 2),
      phases: this.phaseCounts(plots, phases as PlantPhase[]),
      health: this.healthCounts(plots),
      next_harvest: this.nextHarvest(plots, sims as Simulation[], day),
      schedules: await this.upcoming(schedules as Schedule[], plots, now),
      open_alerts: openAlerts,
    };
  }

  private phaseCounts(plots: Plant[], phases: PlantPhase[]): PhaseCount[] {
    const byId = new Map(phases.map((p) => [p.phase_id, p]));
    const out = new Map<string, PhaseCount>();
    for (const plot of plots) {
      const key = plot.phase_id ?? '';
      const ref = byId.get(key);
      const cur = out.get(key) ?? {
        phase_id: ref ? ref.phase_id : null,
        name: ref?.phase_name ?? NO_PHASE_LABEL,
        color: ref?.phase_color ?? null,
        seq: ref?.phase_seq ?? 999,
        count: 0,
        area_ha: 0,
      };
      cur.count += 1;
      cur.area_ha = round(cur.area_ha + (plot.plant_area ?? 0), 2);
      out.set(key, cur);
    }
    return [...out.values()].sort((a, b) => a.seq - b.seq);
  }

  /** plant_health is free text, so it is grouped as written; empty means not assessed yet. */
  private healthCounts(plots: Plant[]): { health: string; count: number }[] {
    const out = new Map<string, number>();
    for (const plot of plots) {
      const label = plot.plant_health?.trim() || NO_HEALTH_LABEL;
      out.set(label, (out.get(label) ?? 0) + 1);
    }
    return [...out.entries()].map(([health, count]) => ({ health, count })).sort((a, b) => b.count - a.count);
  }

  /** Earliest harvest that is still ahead: the model's projection, else the planned harvest date. */
  private nextHarvest(plots: Plant[], sims: Simulation[], day: string): FarmDashboard['next_harvest'] {
    const simByPlant = new Map(sims.map((s) => [s.plant_id, s]));
    let best: FarmDashboard['next_harvest'] = null;
    for (const plot of plots) {
      const projected = simByPlant.get(plot.plant_id)?.sim_harvest_date;
      const source = projected ? 'MODEL' : 'RENCANA';
      const raw = projected ?? plot.plant_harvest_date;
      if (!raw) continue;
      const date = dayOf(raw as Date | string);
      if (date < day) continue;
      if (!best || date < best.date) best = { date, plant_id: plot.plant_id, plant_name: plot.plant_name ?? null, source };
    }
    return best;
  }

  private async upcoming(rows: Schedule[], plots: Plant[], now: Date): Promise<FarmDashboard['schedules']> {
    const open = rows
      .map((r) => ({ row: r, status: effectiveStatus(r, now) }))
      .filter((r) => r.status === SCHEDULE_STATUS.PLANNED || r.status === SCHEDULE_STATUS.OVERDUE)
      .sort((a, b) => String(a.row.sched_start_date).localeCompare(String(b.row.sched_start_date)));
    const shown = open.slice(0, SCHEDULE_LIMIT);
    const typeIds = [...new Set(shown.map((r) => r.row.actype_id).filter(Boolean))];
    const types = typeIds.length ? ((await this.manager.getRepository(ActivityType).find({ where: { actype_id: In(typeIds) } })) as ActivityType[]) : [];
    const typeName = new Map(types.map((t) => [t.actype_id, t.actype_name]));
    const plotName = new Map(plots.map((p) => [p.plant_id, p.plant_name ?? null]));
    return {
      window_days: SCHEDULE_WINDOW_DAYS,
      total: open.length,
      items: shown.map(({ row, status }) => ({
        sched_id: row.sched_id,
        title: row.sched_title ?? null,
        start_date: dayOf(row.sched_start_date),
        plant_id: row.plant_id ?? null,
        plant_name: plotName.get(row.plant_id) ?? null,
        activity: typeName.get(row.actype_id) ?? null,
        status,
      })),
    };
  }

  /** Alarms still waiting for acknowledgement (alm_sts 0) in the caller's tenant; all tenants for a global admin. */
  private async openAlerts(scope: string | undefined): Promise<number> {
    const rows = (await this.manager.query(
      `SELECT COUNT(*) AS total FROM tm_alarm WHERE IFNULL(alm_sts, 0) = 0${scope ? ' AND tenant_id = ?' : ''}`,
      scope ? [scope] : [],
    )) as { total: number | string }[];
    return Number(rows[0]?.total ?? 0);
  }
}
