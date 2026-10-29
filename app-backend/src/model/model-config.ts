/**
 * Default model configuration (FSD F-MDL-03..06). The FSD keeps these in a "configuration table";
 * until that table exists they live here, and every run writes the values it used to `sim_param`.
 * Doses are defaults that an extension officer must validate.
 */
export const MODEL_NAME = 'AGRO-PADI';
export const MODEL_VERSION = 'agro-0.2';

/** Hari terakhir observasi masih dianggap mewakili kondisi tanaman. */
export const OBSERVATION_MAX_AGE_DAYS = 14;
/** GI di bawah ini berarti pertumbuhan terhambat. */
export const GROWTH_STUNTED_BELOW = 0.85;

export const NITROGEN = {
  ureaN: 0.46, // kg N per kg urea
  /** Koreksi urea (kg/ha) bila BWD di bawah batas fase. */
  ureaDose: { RAINY: 50, DRY: 75 },
  materialId: 'MAT-UREA',
};

/** Musim hujan Oktober-Maret, kemarau April-September (pola umum Indonesia). */
export const rainyMonths = [10, 11, 12, 1, 2, 3];

/**
 * Rekomendasi dosis pupuk tunggal per status hara tanah (kg bahan/ha), padi sawah
 * (Permentan 40/2007): SP-36 100/75/50 dan KCl 100/50/50.
 */
export const PHOSPHORUS = { content: 0.36, dose: { RENDAH: 100, SEDANG: 75, TINGGI: 50 }, materialId: 'MAT-SP36' };
export const POTASSIUM = { content: 0.6, dose: { RENDAH: 100, SEDANG: 50, TINGGI: 50 }, materialId: 'MAT-KCL' };

export const SOIL_STATUS_DEFAULT = 'SEDANG' as const;

/** Faktor hasil berdasarkan BWD terakhir (urut dari batas tertinggi). */
export const N_FACTOR_BY_BWD: { min: number; factor: number }[] = [
  { min: 4, factor: 1.0 },
  { min: 3.5, factor: 0.97 },
  { min: 3, factor: 0.95 },
];
export const N_FACTOR_BELOW = 0.9;
/** f_pest = 1 - intensitas/100 x ini. */
export const PEST_LOSS_AT_FULL = 0.3;

export const YIELD = {
  FAKTOR: { range: 0.15, confidence: 0.5 },
  KOMPONEN: { range: 0.08, confidence: 0.7 },
};

/** Fase berbunga ke atas memakai komponen hasil (tr_plant_phase.phase_seq). */
export const FLOWERING_SEQ = 7;

/** Jarak hari ke depan untuk jadwal rekomendasi baru. */
export const RECOMMENDATION_LEAD_DAYS = 3;
/** Jadwal pemupukan sejenis dalam rentang ini diperbarui, bukan dibuat baru. */
export const RECOMMENDATION_WINDOW_DAYS = 7;

export const SCENARIOS = ['BASE', 'KERING', 'BASAH', 'CUSTOM'] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Skenario cuaca -> skenario normal iklim (tm_climate_normal.cn_scenario). */
export const NORMAL_SCENARIO: Record<Scenario, string> = {
  BASE: 'NORMAL',
  KERING: 'KERING',
  BASAH: 'BASAH',
  CUSTOM: 'NORMAL',
};

export const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** Rounded mean, or null for an empty list. */
export const mean = (values: number[], digits: number): number | null =>
  values.length ? round(values.reduce((s, v) => s + v, 0) / values.length, digits) : null;
