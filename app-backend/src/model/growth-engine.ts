import { GROWTH_STUNTED_BELOW, round } from './model-config';

export interface RefPoint {
  /** age in days after planting (end of a phase) */
  age: number;
  height: number | null;
  tiller: number | null;
}

/**
 * Reference value at `age`, interpolated linearly between phase-end points. Before the first
 * point it ramps up from 0 at planting; after the last it stays flat.
 */
export function interpolate(points: { age: number; value: number }[], age: number): number | null {
  const pts = [...points].sort((a, b) => a.age - b.age);
  if (!pts.length) return null;
  if (age <= 0) return 0;
  if (age <= pts[0].age) return pts[0].age > 0 ? (pts[0].value * age) / pts[0].age : pts[0].value;
  for (let i = 1; i < pts.length; i++) {
    if (age <= pts[i].age) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.value + ((b.value - a.value) * (age - a.age)) / (b.age - a.age);
    }
  }
  return pts[pts.length - 1].value;
}

export interface Curve {
  height: { age: number; value: number }[];
  tiller: { age: number; value: number }[];
}

/** Builds the height/tiller reference curves from the variety phases (value at the end of each phase). */
export function buildCurves(rows: { end_age: number | null; height: number | null; tiller: number | null }[]): Curve {
  const height: Curve['height'] = [];
  const tiller: Curve['tiller'] = [];
  for (const r of rows) {
    if (r.end_age === null) continue;
    if (r.height !== null) height.push({ age: r.end_age, value: r.height });
    if (r.tiller !== null) tiller.push({ age: r.end_age, value: r.tiller });
  }
  return { height, tiller };
}

export interface GrowthResult {
  index: number | null;
  stunted: boolean;
  height_ref: number | null;
  tiller_ref: number | null;
  /** why the index is null */
  note: string | null;
}

/**
 * GI = 1/2 [min(1, Hobs/Href(h)) + min(1, Tobs/Tref(h))] from the latest verified observation
 * (F-MDL-02). With only one of the two measured, that one decides; with neither, no index.
 */
export function growthIndex(
  obs: { height: number | null; tiller: number | null } | null,
  age: number,
  curve: Curve,
): GrowthResult {
  const hRef = interpolate(curve.height, age);
  const tRef = interpolate(curve.tiller, age);
  if (!obs) return { index: null, stunted: false, height_ref: hRef, tiller_ref: tRef, note: 'perlu observasi' };

  const parts: number[] = [];
  if (obs.height !== null && hRef) parts.push(Math.min(1, obs.height / hRef));
  if (obs.tiller !== null && tRef) parts.push(Math.min(1, obs.tiller / tRef));
  if (!parts.length) return { index: null, stunted: false, height_ref: hRef, tiller_ref: tRef, note: 'perlu observasi' };

  const index = round(parts.reduce((a, b) => a + b, 0) / parts.length, 2);
  return { index, stunted: index < GROWTH_STUNTED_BELOW, height_ref: hRef, tiller_ref: tRef, note: null };
}
