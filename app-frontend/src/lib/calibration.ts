export interface PhaseObservation {
  plant_id: string
  plant_name: string | null
  date: string
  age: number
  gdd: number | null
  diff_age: number | null
  diff_gdd: number | null
}

export interface CalibrationPhase {
  phase_id: string
  name: string
  seq: number
  vp_id: string
  source: string | null
  estimate: { start_age: number | null; end_age: number | null; gdd_start: number | null; gdd_end: number | null }
  observed: PhaseObservation[]
  n_plots: number
  mean_age: number | null
  mean_gdd: number | null
  diff_age: number | null
  diff_gdd: number | null
  proposal: { start_age: number; gdd_start: number } | null
}

export interface CalibrationReport {
  variety: { var_id: string; name: string }
  min_plots: number
  phases: CalibrationPhase[]
}

export interface ApplyResult {
  applied: { phase_id: string; vp_id: string; gdd_start: number; start_age: number }[]
  skipped: { phase_id: string; reason: string }[]
}

export interface AccuracyRow {
  plant_id: string
  plant_name: string | null
  season: string | null
  variety: string | null
  sim_id: string
  sim_date: string | null
  phases_compared: number
  mean_abs_error_day: number | null
  phase_errors: { phase_id: string; name: string; error_day: number }[]
  pred_yield: number | null
  actual_yield: number | null
  yield_error_pct: number | null
  ubinan_yield: number | null
  ubinan_error_pct: number | null
}

export interface AccuracySummary {
  runs: number
  runs_with_phase: number
  mae_day: number | null
  runs_with_yield: number
  mape_pct: number | null
  bias_pct: number | null
}

export const SOURCE_LABEL: Record<string, string> = {
  ESTIMASI: 'Estimasi',
  LITERATUR: 'Literatur',
  KALIBRASI: 'Kalibrasi',
}

/** Selisih bertanda: tampil dengan + untuk positif; kosong bila tidak ada. */
export const signed = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? '-' : `${v > 0 ? '+' : ''}${v.toLocaleString('id-ID', { maximumFractionDigits: digits })}`
