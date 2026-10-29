import { BadRequestException } from '@nestjs/common';

export const SEASON_RE = /^MT[1-3]-\d{4}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;
const EARTH_RADIUS_M = 6_371_008.8;

/** Parses YYYY-MM-DD strictly (rejects 2026-02-31); returns epoch ms at UTC midnight. */
export function parseDay(value: string, label: string): number {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new BadRequestException(`${label} harus berformat YYYY-MM-DD`);
  }
  const t = Date.parse(`${value}T00:00:00Z`);
  if (isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} bukan tanggal yang valid`);
  }
  return t;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** 'YYYY-MM-DD' (local calendar day) from a date column value (string or Date). */
export function dayOf(value: Date | string): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PhaseLike {
  phase_id: string;
  phase_seq: number;
  phase_start_age: number | null;
  phase_end_age: number | null;
}

/** Generic phase for an age in HST: start <= age < end; the last phase has no end. */
export function phaseForAge<T extends PhaseLike>(phases: T[], age: number): T | undefined {
  const ordered = [...phases].sort((a, b) => a.phase_seq - b.phase_seq);
  if (!ordered.length) return undefined;
  if (age < (ordered[0].phase_start_age ?? 0)) return ordered[0];
  return ordered.find((p) => age >= (p.phase_start_age ?? 0) && (p.phase_end_age == null || age < p.phase_end_age));
}

type Ring = [number, number][];

/** Validates a GeoJSON Polygon and returns its outer ring. */
export function parsePolygon(geom: unknown): Ring {
  const fail = (why: string): never => {
    throw new BadRequestException(`Batas petak tidak valid: ${why}`);
  };
  let obj: any = geom;
  if (typeof geom === 'string') {
    try {
      obj = JSON.parse(geom);
    } catch {
      return fail('bukan JSON');
    }
  }
  if (!obj || obj.type !== 'Polygon' || !Array.isArray(obj.coordinates)) return fail('harus GeoJSON Polygon');
  const ring = obj.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return fail('minimal 4 titik');
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
      return fail('koordinat harus berupa angka [lon, lat]');
    }
    if (!isFinite(pt[0]) || !isFinite(pt[1]) || Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90) {
      return fail('koordinat di luar jangkauan');
    }
  }
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) return fail('cincin harus tertutup');
  return ring.map((p: number[]) => [p[0], p[1]] as [number, number]);
}

/** Polygon area in hectares (local equirectangular projection, fine at field scale). */
export function polygonAreaHa(ring: Ring): number {
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const pts = ring.map(([lon, lat]) => [
    EARTH_RADIUS_M * lon * (Math.PI / 180) * Math.cos(lat0),
    EARTH_RADIUS_M * lat * (Math.PI / 180),
  ]);
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i++) sum += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(sum) / 2 / 10_000;
}

/** Warning text when the drawn polygon differs from the declared area by more than 10%. */
export function areaWarning(declaredHa: number | null | undefined, geom: unknown): string | undefined {
  if (!geom || !declaredHa || declaredHa <= 0) return undefined;
  const drawn = polygonAreaHa(parsePolygon(geom));
  const diff = Math.abs(drawn - declaredHa) / declaredHa;
  if (diff <= 0.1) return undefined;
  return `Luas dari batas petak (${drawn.toFixed(2)} ha) berbeda ${(diff * 100).toFixed(0)}% dari luas yang diisi (${declaredHa} ha)`;
}
