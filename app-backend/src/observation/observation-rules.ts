import { BadRequestException } from '@nestjs/common';

export const SYMPTOM_CODES = ['N_KUNING', 'P_GELAP', 'K_TEPI', 'KERDIL', 'ZN_BERCAK', 'S_PUCAT'] as const;
export const REJECT_PREFIX = 'Ditolak: ';

/** Rice growth stages by generic phase sequence (tr_plant_phase.phase_seq). */
const SEQ_FLOWERING = 7; // Keluar Malai dan Berbunga
const SEQ_MILK = 8; // Masak Susu
const SEQ_FULL = 10; // Masak Penuh
const BWD_FIRST_HST = 14;
const BWD_LAST_HST = 62;

export interface Measurements {
  obs_height?: number | null;
  obs_tiller?: number | null;
  obs_bwd?: number | null;
  obs_panicle?: number | null;
  obs_grain?: number | null;
  obs_filled_pct?: number | null;
  obs_phase_pct?: number | null;
  obs_pest_name?: string | null;
  obs_pest_pct?: number | null;
  obs_symptom?: string | null;
}

const has = (v: unknown) => v !== undefined && v !== null && v !== '';

const MEASURE_KEYS: (keyof Measurements)[] = [
  'obs_height',
  'obs_tiller',
  'obs_bwd',
  'obs_panicle',
  'obs_grain',
  'obs_filled_pct',
  'obs_phase_pct',
  'obs_pest_name',
  'obs_pest_pct',
  'obs_symptom',
];

/**
 * Rice observation rules of F-BDY-04. `phaseSeq` is the generic phase at the observation date and
 * `age` the HST. Collects every problem so the form can show them at once.
 */
export function validateMeasurements(m: Measurements, ctx: { age: number; phaseSeq?: number }): void {
  const errors: string[] = [];

  if (!MEASURE_KEYS.some((k) => has(m[k]))) {
    errors.push('Isi minimal satu hasil pengamatan (tinggi, anakan, BWD, gejala, hama, dst.)');
  }

  if (has(m.obs_height) && (m.obs_height! < 5 || m.obs_height! > 160)) errors.push('Tinggi tanaman harus 5-160 cm');
  if (has(m.obs_tiller) && (m.obs_tiller! < 1 || m.obs_tiller! > 60)) errors.push('Jumlah anakan harus 1-60');
  if (has(m.obs_filled_pct) && (m.obs_filled_pct! < 0 || m.obs_filled_pct! > 100)) errors.push('Persen gabah isi harus 0-100');
  if (has(m.obs_phase_pct) && (m.obs_phase_pct! < 0 || m.obs_phase_pct! > 100)) errors.push('Persen populasi fase harus 0-100');
  if (has(m.obs_pest_pct) && (m.obs_pest_pct! < 0 || m.obs_pest_pct! > 100)) errors.push('Intensitas hama harus 0-100');
  if (has(m.obs_pest_pct) && !has(m.obs_pest_name)) errors.push('Nama hama wajib diisi bila intensitas hama diisi');

  if (has(m.obs_bwd)) {
    if (m.obs_bwd! < 2 || m.obs_bwd! > 5 || !Number.isInteger(m.obs_bwd! * 2)) {
      errors.push('BWD harus 2-5 dengan kelipatan 0,5');
    }
    if (ctx.age < BWD_FIRST_HST || ctx.age > BWD_LAST_HST) {
      errors.push(`BWD hanya diukur pada HST ${BWD_FIRST_HST}-${BWD_LAST_HST}`);
    }
  }

  if (has(m.obs_panicle) && (ctx.phaseSeq ?? 0) < SEQ_FLOWERING) errors.push('Malai per rumpun dicatat mulai fase berbunga');
  if ((has(m.obs_grain) || has(m.obs_filled_pct)) && ((ctx.phaseSeq ?? 0) < SEQ_MILK || (ctx.phaseSeq ?? 0) > SEQ_FULL)) {
    errors.push('Gabah per malai dan persen gabah isi dicatat pada fase masak susu sampai masak penuh');
  }

  if (has(m.obs_symptom)) {
    const unknown = String(m.obs_symptom)
      .split(',')
      .filter((c) => !(SYMPTOM_CODES as readonly string[]).includes(c));
    if (unknown.length) errors.push(`Kode gejala tidak dikenal: ${unknown.join(', ')}`);
  }

  if (errors.length) throw new BadRequestException(errors.join('; '));
}

/** Rejection reason kept in obs_desc (the table has no dedicated column): "Ditolak: alasan | catatan". */
export function withRejection(reason: string, original: string | null | undefined): string {
  const base = stripRejection(original);
  return `${REJECT_PREFIX}${reason}${base ? ` | ${base}` : ''}`.slice(0, 255);
}

export function stripRejection(desc: string | null | undefined): string {
  if (!desc || !desc.startsWith(REJECT_PREFIX)) return desc ?? '';
  const i = desc.indexOf(' | ');
  return i === -1 ? '' : desc.slice(i + 3);
}
