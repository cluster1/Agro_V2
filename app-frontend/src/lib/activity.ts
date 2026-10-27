/** Kategori jenis kegiatan yang wajib bahan dan jumlah numerik (cermin aturan backend). */
const MATERIAL_CATEGORIES = ['PEMUPUKAN', 'PROTEKSI']

export const requiresMaterial = (category: string | null | undefined): boolean =>
  !!category && MATERIAL_CATEGORIES.includes(category)

export interface NutrientPreview {
  n_kg_ha: number
  p2o5_kg_ha: number
  k2o_kg_ha: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Pratinjau hara masuk per hektare: jumlah (kg) x kandungan (%) / 100 / luas (ha).
 * Hanya bermakna untuk satuan kg; angka final dihitung ulang oleh backend.
 */
export function nutrientPreview(
  value: string | undefined,
  unitId: string | null | undefined,
  material: { mat_n?: number | null; mat_p2o5?: number | null; mat_k2o?: number | null } | undefined,
  areaHa: number | null | undefined,
): NutrientPreview | null {
  if (unitId !== 'UNIT-KG' || !material || !areaHa || areaHa <= 0) return null
  const amount = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const per = (pct: number | null | undefined) => round2((amount * (pct ?? 0)) / 100 / areaHa)
  const out = { n_kg_ha: per(material.mat_n), p2o5_kg_ha: per(material.mat_p2o5), k2o_kg_ha: per(material.mat_k2o) }
  return out.n_kg_ha || out.p2o5_kg_ha || out.k2o_kg_ha ? out : null
}
