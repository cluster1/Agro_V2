/** Bentuk respons `GET /reports/farm-dashboard`, `/reports/production` dan `/reports/costs`. */

export interface PhaseCount {
  phase_id: string | null
  name: string
  color: string | null
  seq: number
  count: number
  area_ha: number
}

export interface UpcomingSchedule {
  sched_id: string
  title: string | null
  start_date: string
  plant_id: string | null
  plant_name: string | null
  activity: string | null
  /** 0 rencana, 4 terlambat */
  status: number
}

export interface FarmDashboard {
  plants: number
  area_ha: number
  phases: PhaseCount[]
  health: { health: string; count: number }[]
  next_harvest: { date: string; plant_id: string; plant_name: string | null; source: 'MODEL' | 'RENCANA' } | null
  schedules: { window_days: number; total: number; items: UpcomingSchedule[] }
  open_alerts: number
}

export interface ProductionRow {
  plant_id: string
  plant_name: string | null
  site_id: string | null
  site_name: string | null
  season: string | null
  var_id: string | null
  variety: string | null
  harvests: number
  last_date: string | null
  area_ha: number
  gkp_kg: number
  gkg_kg: number
  yield_t_ha: number | null
}

export interface ProductionSummary {
  plots: number
  area_ha: number
  gkp_kg: number
  gkg_kg: number
  yield_t_ha: number | null
}

export interface CostRow {
  pact_id: string
  date: string | null
  plant_id: string | null
  plant_name: string | null
  activity: string | null
  category: string | null
  material: string | null
  amount: string | null
  n_kg_ha: number | null
  p2o5_kg_ha: number | null
  k2o_kg_ha: number | null
  workers: number | null
  cost: number | null
}

export interface PlanRow {
  sched_id: string
  title: string | null
  date: string | null
  plant_name: string | null
  activity: string | null
  status: string
  done_date: string | null
}

export interface CostSummary {
  activities: number
  workers: number
  cost: number
  cost_missing: number
  n_kg_ha: number
  p2o5_kg_ha: number
  k2o_kg_ha: number
  plan: { planned: number; done: number; open: number; overdue: number; cancelled: number; completion_pct: number | null }
}

export interface CostReport {
  rows: CostRow[]
  plan: PlanRow[]
  summary: CostSummary
}

export const rupiah = (value: number | null | undefined): string =>
  value === null || value === undefined ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

/** Status jadwal dari server (kata, bukan angka) ke varian Badge. */
export const PLAN_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  Selesai: 'success',
  Rencana: 'outline',
  Terlambat: 'destructive',
  Batal: 'warning',
}
