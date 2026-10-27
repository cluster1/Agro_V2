import type { BadgeProps } from '@/components/ui/badge'

export type NutrientStatus = 'RENDAH' | 'SEDANG' | 'TINGGI'

/** Status hara P/K. Tinggi/rendah ditandai dengan teks, bukan warna saja. */
export const NUTRIENT_STATUS: Record<NutrientStatus, { label: string; variant: BadgeProps['variant'] }> = {
  RENDAH: { label: 'Rendah', variant: 'destructive' },
  SEDANG: { label: 'Sedang', variant: 'warning' },
  TINGGI: { label: 'Tinggi', variant: 'success' },
}

export const P_METHODS = ['OLSEN', 'BRAY1', 'BRAY2'] as const
export const DRAINAGE = ['BAIK', 'SEDANG', 'TERHAMBAT', 'TERGENANG'] as const
export const LAND_CLASSES = ['S1', 'S2', 'S3', 'N'] as const

export const DRAINAGE_LABEL: Record<string, string> = {
  BAIK: 'Baik',
  SEDANG: 'Sedang',
  TERHAMBAT: 'Terhambat',
  TERGENANG: 'Tergenang',
}

export const LAND_CLASS_LABEL: Record<string, string> = {
  S1: 'S1 - sangat sesuai',
  S2: 'S2 - cukup sesuai',
  S3: 'S3 - sesuai marginal',
  N: 'N - tidak sesuai',
}

/** Jumlah fraksi tekstur harus 100% ±1 (cermin backend). */
export function textureError(sand?: number, silt?: number, clay?: number): string | null {
  const given = [sand, silt, clay].filter((v) => v !== undefined)
  if (given.length === 0) return null
  if (given.length < 3) return 'Pasir, debu, dan liat harus diisi bersamaan'
  const sum = (sand as number) + (silt as number) + (clay as number)
  return Math.abs(sum - 100) > 1 ? `Jumlah tekstur harus 100% ±1 (sekarang ${Math.round(sum * 10) / 10}%)` : null
}
