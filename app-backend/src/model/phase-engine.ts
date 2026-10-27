import { addDays, daysBetween } from '../plant/plant-rules';

export type DataType = 'ACTUAL' | 'FORECAST' | 'NORMAL';

export interface WeatherDay {
  tmin: number;
  tmax: number;
  type: DataType;
}

export interface GenericPhase {
  phase_id: string;
  phase_code: string | null;
  phase_name: string;
  phase_seq: number;
  phase_start_age: number | null;
  phase_end_age: number | null;
}

export interface VarietyPhaseRow {
  phase_id: string;
  vp_start_age: number | null;
  vp_end_age: number | null;
  vp_gdd_start: number | null;
  vp_gdd_end: number | null;
  vp_height_ref: number | null;
  vp_tiller_ref: number | null;
  vp_bwd_min: number | null;
}

export interface TimelinePhase {
  phase_id: string;
  phase_code: string | null;
  phase_name: string;
  seq: number;
  start_date: string;
  /** null for the last phase (BERA) */
  end_date: string | null;
  start_age: number;
  gdd_start: number | null;
  data_type: DataType;
}

export interface TimelineResult {
  method: 'GDD' | 'HST';
  phases: TimelinePhase[];
  /** first day of the last phase = projected harvest */
  harvest_date: string | null;
}

/** GDD_d = max(0, (Tmin + min(Tmax, Tmax_var)) / 2 - Tbase) (F-MDL-01). */
export function dailyGdd(tmin: number, tmax: number, tbase: number, tmaxVar: number): number {
  return Math.max(0, (tmin + Math.min(tmax, tmaxVar)) / 2 - tbase);
}

export interface TimelineInput {
  sowDate: string;
  plantDate: string;
  today: string;
  tbase: number;
  tmaxVar: number;
  phases: GenericPhase[];
  varietyPhases: VarietyPhaseRow[];
  /** weather for a calendar day (actual, forecast or normal), or null when unknown */
  weatherFor: (day: string) => WeatherDay | null;
  maxDays?: number;
}

const MAX_DAYS = 420;

/**
 * Projects the start of every phase. Uses accumulated GDD from the planting date when the variety
 * has GDD limits and the weather series is complete; otherwise falls back to days after planting.
 */
export function projectTimeline(input: TimelineInput): TimelineResult {
  const { sowDate, plantDate, today, phases, varietyPhases, weatherFor } = input;
  const maxDays = input.maxDays ?? MAX_DAYS;
  const ordered = [...phases].sort((a, b) => a.phase_seq - b.phase_seq);
  const vp = new Map(varietyPhases.map((v) => [v.phase_id, v]));
  if (!ordered.length) return { method: 'HST', phases: [], harvest_date: null };

  const merged = ordered.map((p) => {
    const v = vp.get(p.phase_id);
    return {
      p,
      startAge: v?.vp_start_age ?? p.phase_start_age,
      gddStart: v?.vp_gdd_start ?? null,
    };
  });
  const planted = merged.filter((m) => m.startAge === null || m.startAge >= 0);
  const useGdd = planted.length > 0 && planted.every((m) => m.gddStart !== null);

  const typeOnDay = (day: string): DataType => {
    if (day < today) return 'ACTUAL';
    return weatherFor(day)?.type ?? 'NORMAL';
  };

  let starts: { day: string; gdd: number | null }[] | null = null;

  if (useGdd) {
    // acc(d) = GDD accumulated over plantDate .. d-1; a phase starts on the first day acc(d) >= gddStart
    starts = [];
    let acc = 0;
    let idx = merged.findIndex((m) => (m.startAge ?? 0) >= 0);
    let complete = true;
    for (let i = 0; i < merged.length && i < idx; i++) starts.push({ day: sowDate, gdd: merged[i].gddStart });
    for (let d = 0; d <= maxDays && idx < merged.length; d++) {
      const day = addDays(plantDate, d);
      while (idx < merged.length && acc >= (merged[idx].gddStart as number)) {
        starts.push({ day, gdd: merged[idx].gddStart });
        idx++;
      }
      const w = weatherFor(day);
      if (!w) {
        complete = false;
        break;
      }
      acc += dailyGdd(w.tmin, w.tmax, input.tbase, input.tmaxVar);
    }
    if (!complete || idx < merged.length) starts = null; // incomplete weather or never reached: use HST
  }

  const method: 'GDD' | 'HST' = starts ? 'GDD' : 'HST';
  if (!starts) {
    starts = merged.map((m) => ({
      day: m.startAge !== null && m.startAge < 0 ? sowDate : addDays(plantDate, m.startAge ?? 0),
      gdd: m.gddStart,
    }));
  }

  const result: TimelinePhase[] = merged.map((m, i) => {
    const start = starts![i].day;
    const next = starts![i + 1]?.day;
    return {
      phase_id: m.p.phase_id,
      phase_code: m.p.phase_code,
      phase_name: m.p.phase_name,
      seq: m.p.phase_seq,
      start_date: start,
      end_date: next ? addDays(next, -1) : null,
      start_age: daysBetween(plantDate, start),
      gdd_start: starts![i].gdd,
      data_type: typeOnDay(start),
    };
  });

  return { method, phases: result, harvest_date: result[result.length - 1].start_date };
}

/** Phase in effect on `day` (the last one that has started; the first one before any start). */
export function phaseOn(phases: TimelinePhase[], day: string): TimelinePhase | undefined {
  if (!phases.length) return undefined;
  let current = phases[0];
  for (const p of phases) if (p.start_date <= day) current = p;
  return current;
}
