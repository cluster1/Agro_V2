import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Activity, ACTIVITY_STATUS } from '../activity/entities/activity.entity';
import { nutrientInput, parseAmount } from '../activity/activity-rules';
import { Plant } from '../plant/entities/plant.entity';
import { Schedule, SCHEDULE_STATUS } from '../schedule/entities/schedule.entity';
import { effectiveStatus } from '../schedule/schedule.service';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { Material } from '../ref/entities/material.entity';
import { Unit } from '../unit/entities/unit.entity';
import { round } from '../model/model-config';
import { dayOf } from '../plant/plant-rules';
import { scoped } from '../common/utils/scope';
import { safeText } from './report-utils';

const KG_UNIT = 'UNIT-KG';
const SCHEDULE_LABEL: Record<number, string> = {
  [SCHEDULE_STATUS.PLANNED]: 'Rencana',
  [SCHEDULE_STATUS.DONE]: 'Selesai',
  [SCHEDULE_STATUS.CANCELLED]: 'Batal',
  [SCHEDULE_STATUS.OVERDUE]: 'Terlambat',
};

export interface CostFilter {
  siteId?: string;
  plantId?: string;
  from?: string;
  to?: string;
}

export interface CostRow {
  pact_id: string;
  date: string | null;
  plant_id: string | null;
  plant_name: string | null;
  activity: string | null;
  category: string | null;
  material: string | null;
  amount: string | null;
  /** nutrient input per hectare, only for fertiliser given in kg */
  n_kg_ha: number | null;
  p2o5_kg_ha: number | null;
  k2o_kg_ha: number | null;
  workers: number | null;
  cost: number | null;
}

export interface PlanRow {
  sched_id: string;
  title: string | null;
  date: string | null;
  plant_name: string | null;
  activity: string | null;
  status: string;
  /** date of the activity that fulfilled the schedule, when linked */
  done_date: string | null;
}

export interface PlanCounts {
  planned: number;
  done: number;
  open: number;
  overdue: number;
  cancelled: number;
}

export interface CostSummary {
  activities: number;
  workers: number;
  /** sum of the costs that were filled in */
  cost: number;
  /** activities without a cost, so the total can be read as a lower bound */
  cost_missing: number;
  n_kg_ha: number;
  p2o5_kg_ha: number;
  k2o_kg_ha: number;
  plan: PlanCounts & { completion_pct: number | null };
}

export interface CostReport {
  rows: CostRow[];
  plan: PlanRow[];
  summary: CostSummary;
}

const sum = (values: (number | null)[]) => values.reduce<number>((s, v) => s + (v ?? 0), 0);

@Injectable()
export class CostReportService {
  constructor(
    @InjectRepository(Activity)
    private readonly activities: Repository<Activity>,
  ) {}

  private get manager() {
    return this.activities.manager;
  }

  /** F-RPT-01 "Kegiatan & Biaya": activities, materials, nutrient input per ha, workers, cost and plan vs actual. */
  async report(scope: string | undefined, filter: CostFilter = {}): Promise<CostReport> {
    const base: Record<string, unknown> = {};
    if (filter.siteId) base.site_id = filter.siteId;
    if (filter.plantId) base.plant_id = filter.plantId;
    const ranged = filter.from || filter.to;
    const from = `${filter.from ?? '1970-01-01'} 00:00:00`;
    const to = `${filter.to ?? '9999-12-31'} 23:59:59`;

    const [acts, scheds] = await Promise.all([
      this.activities.find({
        where: scoped({ ...base, pact_sts: In([ACTIVITY_STATUS.SAVED, ACTIVITY_STATUS.VERIFIED]), ...(ranged ? { pact_date: Between(from, to) } : {}) }, scope),
      }) as Promise<Activity[]>,
      this.manager.getRepository(Schedule).find({
        where: scoped({ ...base, ...(ranged ? { sched_start_date: Between(from, to) } : {}) }, scope),
      }) as Promise<Schedule[]>,
    ]);

    const ids = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))];
    const plantIds = ids([...acts.map((a) => a.plant_id), ...scheds.map((s) => s.plant_id)]);
    const typeIds = ids([...acts.map((a) => a.actype_id), ...scheds.map((s) => s.actype_id)]);
    const matIds = ids(acts.map((a) => a.mat_id));
    const unitIds = ids(acts.map((a) => a.unit_id));
    const [plants, types, materials, units] = await Promise.all([
      plantIds.length ? this.manager.getRepository(Plant).find({ where: { plant_id: In(plantIds) } }) : [],
      typeIds.length ? this.manager.getRepository(ActivityType).find({ where: { actype_id: In(typeIds) } }) : [],
      matIds.length ? this.manager.getRepository(Material).find({ where: { mat_id: In(matIds) } }) : [],
      unitIds.length ? this.manager.getRepository(Unit).find({ where: { unit_id: In(unitIds) } }) : [],
    ]);
    const plantBy = new Map((plants as Plant[]).map((p) => [p.plant_id, p]));
    const typeBy = new Map((types as ActivityType[]).map((t) => [t.actype_id, t]));
    const materialBy = new Map((materials as Material[]).map((m) => [m.mat_id, m]));
    const symbol = new Map((units as Unit[]).map((u) => [u.unit_id, u.unit_symbol]));

    const rows = acts
      .map((a): CostRow => {
        const plant = plantBy.get(a.plant_id);
        const material = a.mat_id ? materialBy.get(a.mat_id) : undefined;
        const inKg = a.unit_id === KG_UNIT;
        const nutrients = inKg ? nutrientInput(parseAmount(a.pact_value), material, plant?.plant_area) : null;
        return {
          pact_id: a.pact_id,
          date: a.pact_date ? dayOf(a.pact_date) : null,
          plant_id: a.plant_id ?? null,
          plant_name: plant?.plant_name ?? null,
          activity: typeBy.get(a.actype_id)?.actype_name ?? null,
          category: typeBy.get(a.actype_id)?.actype_category ?? null,
          material: material?.mat_name ?? a.pact_material ?? null,
          amount: a.pact_value ? `${a.pact_value}${a.unit_id && symbol.get(a.unit_id) ? ` ${symbol.get(a.unit_id)}` : ''}` : null,
          n_kg_ha: nutrients?.n_kg_ha ?? null,
          p2o5_kg_ha: nutrients?.p2o5_kg_ha ?? null,
          k2o_kg_ha: nutrients?.k2o_kg_ha ?? null,
          workers: a.pact_worker ?? null,
          cost: a.pact_cost ?? null,
        };
      })
      .sort((x, y) => String(x.date).localeCompare(String(y.date)) || String(x.plant_name).localeCompare(String(y.plant_name)));

    const plan = this.planRows(scheds, acts, plantBy, typeBy);
    return { rows, plan: plan.rows, summary: this.summarise(rows, plan.counts) };
  }

  /** Schedules of the period against the activities that fulfilled them (linked by sched_id). */
  private planRows(scheds: Schedule[], acts: Activity[], plantBy: Map<string, Plant>, typeBy: Map<string, ActivityType>) {
    const doneBy = new Map<string, string>();
    for (const a of acts) if (a.sched_id && a.pact_date) doneBy.set(a.sched_id, dayOf(a.pact_date));
    const counts: PlanCounts = { planned: scheds.length, done: 0, open: 0, overdue: 0, cancelled: 0 };
    const rows = scheds
      .map((s): PlanRow => {
        let status = effectiveStatus(s);
        // an activity linked to the schedule fulfils it even if the schedule row was not closed
        if ((status === SCHEDULE_STATUS.PLANNED || status === SCHEDULE_STATUS.OVERDUE) && doneBy.has(s.sched_id)) status = SCHEDULE_STATUS.DONE;
        if (status === SCHEDULE_STATUS.DONE) counts.done += 1;
        else if (status === SCHEDULE_STATUS.OVERDUE) counts.overdue += 1;
        else if (status === SCHEDULE_STATUS.CANCELLED) counts.cancelled += 1;
        else counts.open += 1;
        return {
          sched_id: s.sched_id,
          title: s.sched_title ?? null,
          date: s.sched_start_date ? dayOf(s.sched_start_date) : null,
          plant_name: plantBy.get(s.plant_id)?.plant_name ?? null,
          activity: typeBy.get(s.actype_id)?.actype_name ?? null,
          status: SCHEDULE_LABEL[status] ?? String(status),
          done_date: doneBy.get(s.sched_id) ?? null,
        };
      })
      .sort((x, y) => String(x.date).localeCompare(String(y.date)));
    return { rows, counts };
  }

  private summarise(rows: CostRow[], counts: PlanCounts): CostSummary {
    const active = counts.planned - counts.cancelled;
    return {
      activities: rows.length,
      workers: sum(rows.map((r) => r.workers)),
      cost: round(sum(rows.map((r) => r.cost)), 0),
      cost_missing: rows.filter((r) => r.cost === null).length,
      n_kg_ha: round(sum(rows.map((r) => r.n_kg_ha)), 2),
      p2o5_kg_ha: round(sum(rows.map((r) => r.p2o5_kg_ha)), 2),
      k2o_kg_ha: round(sum(rows.map((r) => r.k2o_kg_ha)), 2),
      plan: { ...counts, completion_pct: active > 0 ? round((counts.done / active) * 100, 1) : null },
    };
  }

  async toXlsx(report: CostReport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Kegiatan & Biaya');
    ws.columns = [
      { header: 'Tanggal', key: 'date', width: 12 },
      { header: 'Petak', key: 'plant_name', width: 28 },
      { header: 'Kegiatan', key: 'activity', width: 24 },
      { header: 'Bahan', key: 'material', width: 24 },
      { header: 'Jumlah', key: 'amount', width: 14 },
      { header: 'N (kg/ha)', key: 'n_kg_ha', width: 11 },
      { header: 'P2O5 (kg/ha)', key: 'p2o5_kg_ha', width: 13 },
      { header: 'K2O (kg/ha)', key: 'k2o_kg_ha', width: 12 },
      { header: 'Pekerja', key: 'workers', width: 10 },
      { header: 'Biaya (Rp)', key: 'cost', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of report.rows) {
      ws.addRow({
        ...r,
        plant_name: safeText(r.plant_name),
        activity: safeText(r.activity),
        material: safeText(r.material),
        amount: safeText(r.amount),
        n_kg_ha: r.n_kg_ha ?? '',
        p2o5_kg_ha: r.p2o5_kg_ha ?? '',
        k2o_kg_ha: r.k2o_kg_ha ?? '',
        workers: r.workers ?? '',
        cost: r.cost ?? '',
      });
    }
    const plan = wb.addWorksheet('Rencana vs Realisasi');
    plan.columns = [
      { header: 'Tanggal rencana', key: 'date', width: 16 },
      { header: 'Petak', key: 'plant_name', width: 28 },
      { header: 'Kegiatan', key: 'activity', width: 24 },
      { header: 'Judul', key: 'title', width: 32 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Tanggal realisasi', key: 'done_date', width: 16 },
    ];
    plan.getRow(1).font = { bold: true };
    for (const r of report.plan) {
      plan.addRow({ ...r, plant_name: safeText(r.plant_name), activity: safeText(r.activity), title: safeText(r.title), done_date: r.done_date ?? '' });
    }
    const s = report.summary;
    const sheet = wb.addWorksheet('Ringkasan');
    sheet.addRows([
      ['Jumlah kegiatan', s.activities],
      ['Total pekerja', s.workers],
      ['Total biaya terisi (Rp)', s.cost],
      ['Kegiatan tanpa biaya', s.cost_missing],
      ['Hara masuk N (kg/ha)', s.n_kg_ha],
      ['Hara masuk P2O5 (kg/ha)', s.p2o5_kg_ha],
      ['Hara masuk K2O (kg/ha)', s.k2o_kg_ha],
      ['Jadwal direncanakan', s.plan.planned],
      ['Jadwal selesai', s.plan.done],
      ['Jadwal terlambat', s.plan.overdue],
      ['Jadwal masih terbuka', s.plan.open],
      ['Jadwal batal', s.plan.cancelled],
      ['Realisasi (%)', s.plan.completion_pct ?? '-'],
    ]);
    sheet.columns = [{ width: 32 }, { width: 14 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
