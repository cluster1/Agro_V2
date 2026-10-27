import { BadRequestException } from '@nestjs/common';

export const P_METHODS = ['OLSEN', 'BRAY1', 'BRAY2'] as const;
export const DRAINAGE = ['BAIK', 'SEDANG', 'TERHAMBAT', 'TERGENANG'] as const;
export const LAND_CLASSES = ['S1', 'S2', 'S3', 'N'] as const;
export type NutrientStatus = 'RENDAH' | 'SEDANG' | 'TINGGI';

/**
 * Default class limits for rice paddy soils (Balittanah/PPT guidance): a value up to `low` is
 * RENDAH, up to `medium` is SEDANG, above is TINGGI. These are defaults until the model
 * configuration table of Tahap 4 supplies them (FSD F-ENV-03 / F-MDL-04).
 */
export const SOIL_THRESHOLDS = {
  p: {
    OLSEN: { low: 10, medium: 25 }, // mg P/kg
    BRAY1: { low: 15, medium: 25 }, // mg P/kg
    BRAY2: { low: 15, medium: 30 }, // mg P/kg
  },
  k: { low: 0.3, medium: 0.5 }, // cmol(+)/kg dapat tukar
} as const;

const classify = (value: number, t: { low: number; medium: number }): NutrientStatus =>
  value <= t.low ? 'RENDAH' : value <= t.medium ? 'SEDANG' : 'TINGGI';

export interface NutrientStatuses {
  p_status: NutrientStatus | null;
  k_status: NutrientStatus | null;
}

/** P and K status from lab values; null when the value (or the P method) is missing. */
export function nutrientStatus(s: {
  soil_p_avail?: number | null;
  soil_p_method?: string | null;
  soil_k_exch?: number | null;
}): NutrientStatuses {
  const method = (s.soil_p_method ?? '') as keyof typeof SOIL_THRESHOLDS.p;
  const p =
    s.soil_p_avail != null && SOIL_THRESHOLDS.p[method] ? classify(s.soil_p_avail, SOIL_THRESHOLDS.p[method]) : null;
  const k = s.soil_k_exch != null ? classify(s.soil_k_exch, SOIL_THRESHOLDS.k) : null;
  return { p_status: p, k_status: k };
}

type Num = number | null | undefined;
const has = (v: Num) => v !== undefined && v !== null;

export interface SoilValues {
  soil_sand?: Num;
  soil_silt?: Num;
  soil_clay?: Num;
  soil_ph_h2o?: Num;
  soil_ph_kcl?: Num;
  soil_fc?: Num;
  soil_wp?: Num;
  soil_depth_top?: Num;
  soil_depth_bottom?: Num;
  soil_p_avail?: Num;
  soil_p_method?: string | null;
  soil_base_sat?: Num;
  soil_c_org?: Num;
}

/** F-ENV-03 validation; collects every problem. */
export function validateSoil(v: SoilValues): void {
  const errors: string[] = [];

  const fractions = [v.soil_sand, v.soil_silt, v.soil_clay];
  if (fractions.some(has)) {
    if (!fractions.every(has)) {
      errors.push('Tekstur: pasir, debu, dan liat harus diisi bersamaan');
    } else {
      if (fractions.some((f) => (f as number) < 0 || (f as number) > 100)) errors.push('Fraksi tekstur harus 0-100%');
      const sum = (fractions as number[]).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 1) errors.push(`Fraksi tekstur harus berjumlah 100% ±1 (sekarang ${Math.round(sum * 10) / 10}%)`);
    }
  }

  for (const [label, value] of [['pH H₂O', v.soil_ph_h2o], ['pH KCl', v.soil_ph_kcl]] as const) {
    if (has(value) && ((value as number) < 3 || (value as number) > 10)) errors.push(`${label} harus 3-10`);
  }

  if (has(v.soil_fc) && has(v.soil_wp) && (v.soil_fc as number) <= (v.soil_wp as number)) {
    errors.push('Kapasitas lapang harus lebih besar dari titik layu');
  }

  if (has(v.soil_depth_top) && has(v.soil_depth_bottom) && (v.soil_depth_bottom as number) <= (v.soil_depth_top as number)) {
    errors.push('Kedalaman bawah harus lebih besar dari kedalaman atas');
  }
  if ((has(v.soil_depth_top) && (v.soil_depth_top as number) < 0) || (has(v.soil_depth_bottom) && (v.soil_depth_bottom as number) < 0)) {
    errors.push('Kedalaman tidak boleh negatif');
  }

  if (has(v.soil_base_sat) && ((v.soil_base_sat as number) < 0 || (v.soil_base_sat as number) > 100)) {
    errors.push('Kejenuhan basa harus 0-100%');
  }
  if (has(v.soil_c_org) && ((v.soil_c_org as number) < 0 || (v.soil_c_org as number) > 100)) {
    errors.push('C-organik harus 0-100%');
  }
  if (has(v.soil_p_avail) && !v.soil_p_method) errors.push('Metode P tersedia wajib diisi bila P tersedia diisi');

  if (errors.length) throw new BadRequestException(errors.join('; '));
}
