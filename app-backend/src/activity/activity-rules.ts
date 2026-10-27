/** Kategori yang wajib bahan (mat_id) dan nilai numerik. */
export const MATERIAL_CATEGORIES = ['PEMUPUKAN', 'PROTEKSI'] as const;

export const requiresMaterial = (category: string | null | undefined): boolean =>
  !!category && (MATERIAL_CATEGORIES as readonly string[]).includes(category);

export interface NutrientInput {
  n_kg_ha: number;
  p2o5_kg_ha: number;
  k2o_kg_ha: number;
}

interface MaterialContent {
  mat_n?: number | null;
  mat_p2o5?: number | null;
  mat_k2o?: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Hara masuk per hektare (F-BDY-03): jumlah (kg) x kandungan (%) / 100 / luas (ha).
 * Urea 150 kg di 2 ha (46% N) -> 34,5 kg N/ha. Null bila bukan perhitungan yang bermakna.
 */
export function nutrientInput(
  amountKg: number | null | undefined,
  material: MaterialContent | null | undefined,
  areaHa: number | null | undefined,
): NutrientInput | null {
  if (!material || !amountKg || amountKg <= 0 || !areaHa || areaHa <= 0) return null;
  const per = (pct: number | null | undefined) => round2(((amountKg * (pct ?? 0)) / 100) / areaHa);
  return { n_kg_ha: per(material.mat_n), p2o5_kg_ha: per(material.mat_p2o5), k2o_kg_ha: per(material.mat_k2o) };
}

/** Numeric reading of pact_value ('150', '150,5'); NaN-safe. */
export function parseAmount(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
