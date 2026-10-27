import { FLOWERING_SEQ, N_FACTOR_BELOW, N_FACTOR_BY_BWD, PEST_LOSS_AT_FULL, YIELD, round } from './model-config';

export const nFactor = (bwd: number | null): number => {
  if (bwd === null) return 1;
  for (const step of N_FACTOR_BY_BWD) if (bwd >= step.min) return step.factor;
  return N_FACTOR_BELOW;
};

export const pestFactor = (pestPct: number | null): number =>
  round(1 - ((pestPct ?? 0) / 100) * PEST_LOSS_AT_FULL, 4);

export interface YieldInput {
  /** generic phase sequence now */
  phaseSeq: number | null;
  avgYield: number | null;
  potentialYield: number | null;
  growthIndex: number | null;
  bwd: number | null;
  pestPct: number | null;
  /** component data from the latest verified observation after flowering */
  panicle: number | null;
  grain: number | null;
  filledPct: number | null;
  /** hills per hectare (plant_count / plant_area) */
  hillsPerHa: number | null;
  grainWeight1000: number | null;
}

export interface YieldResult {
  method: 'FAKTOR' | 'KOMPONEN';
  value: number | null;
  low: number | null;
  high: number | null;
  confidence: number;
  factors: { f_growth: number; f_n: number; f_pest: number; bwd: number | null };
  note: string | null;
}

/**
 * F-MDL-06. Before flowering (or without component data): Y = Yavg x f_growth x f_N x f_pest, +-15%,
 * confidence 0.5. After flowering with panicles, grains and filled %: component method, +-8%, 0.7.
 */
export function predictYield(i: YieldInput): YieldResult {
  const factors = {
    f_growth: i.growthIndex ?? 1,
    f_n: nFactor(i.bwd),
    f_pest: pestFactor(i.pestPct),
    bwd: i.bwd,
  };

  const flowered = (i.phaseSeq ?? 0) >= FLOWERING_SEQ;
  const complete =
    i.panicle !== null &&
    i.grain !== null &&
    i.filledPct !== null &&
    i.hillsPerHa !== null &&
    i.hillsPerHa > 0 &&
    i.grainWeight1000 !== null;

  if (flowered && complete) {
    // rumpun/ha x malai/rumpun x gabah/malai x %isi(0-1) x bobot1000(g) / 1e9 = t/ha
    const y = (i.hillsPerHa! * i.panicle! * i.grain! * (i.filledPct! / 100) * i.grainWeight1000!) / 1e9;
    const spec = YIELD.KOMPONEN;
    return {
      method: 'KOMPONEN',
      value: round(y, 1),
      low: round(y * (1 - spec.range), 1),
      high: round(y * (1 + spec.range), 1),
      confidence: spec.confidence,
      factors,
      note: null,
    };
  }

  const spec = YIELD.FAKTOR;
  if (i.avgYield === null) {
    return { method: 'FAKTOR', value: null, low: null, high: null, confidence: spec.confidence, factors, note: 'varietas belum punya rata-rata hasil' };
  }
  const y = i.avgYield * factors.f_growth * factors.f_n * factors.f_pest;
  return {
    method: 'FAKTOR',
    value: round(y, 1),
    low: round(y * (1 - spec.range), 1),
    high: round(y * (1 + spec.range), 1),
    confidence: spec.confidence,
    factors,
    note: i.growthIndex === null ? 'tanpa indeks pertumbuhan (perlu observasi)' : null,
  };
}
