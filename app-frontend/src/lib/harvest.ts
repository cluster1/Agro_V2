/** Standar kadar air GKG (%). */
export const GKG_MOISTURE = 14
export const MOISTURE_MIN = 5
export const MOISTURE_MAX = 40

export interface HarvestPreview {
  gkg: number
  yield: number
}

/**
 * Pratinjau GKG = GKP x (100 - kadar air) / (100 - 14) dan produktivitas t/ha.
 * Angka final dihitung ulang oleh backend; contoh: 6.000 kg pada 25% di 1 ha -> 5.233 kg, 5,23 t/ha.
 */
export function harvestPreview(
  gkp: number | undefined,
  moisture: number | undefined,
  area: number | undefined,
): HarvestPreview | null {
  if (!gkp || gkp <= 0 || moisture === undefined || !area || area <= 0) return null
  if (moisture < MOISTURE_MIN || moisture > MOISTURE_MAX) return null
  const gkg = (gkp * (100 - moisture)) / (100 - GKG_MOISTURE)
  return { gkg: Math.round(gkg), yield: Math.round((gkg / 1000 / area) * 100) / 100 }
}
