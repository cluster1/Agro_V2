import { BadRequestException } from '@nestjs/common';

/** Standard moisture of milled-ready dry unhusked rice (GKG). */
export const GKG_MOISTURE = 14;
export const MOISTURE_MIN = 5;
export const MOISTURE_MAX = 40;
/** Harvested area may exceed the plant area by this tolerance (measurement error). */
export const AREA_TOLERANCE = 1.1;

export interface HarvestResult {
  hv_weight_dry: number;
  hv_yield: number;
}

/**
 * GKG = GKP x (100 - kadar air) / (100 - 14); produktivitas = GKG / 1000 / luas (t/ha).
 * GKP 6.000 kg, kadar air 25%, 1 ha -> GKG 5.233 kg, 5,23 t/ha (BR-13).
 */
export function computeHarvest(gkpKg: number, moisturePct: number, areaHa: number): HarvestResult {
  const gkg = (gkpKg * (100 - moisturePct)) / (100 - GKG_MOISTURE);
  return {
    hv_weight_dry: Math.round(gkg),
    hv_yield: Math.round((gkg / 1000 / areaHa) * 100) / 100,
  };
}

export function validateHarvest(v: { weight: number; moisture: number; area: number; plantArea?: number | null }): void {
  const errors: string[] = [];
  if (!(v.weight > 0)) errors.push('Berat GKP harus lebih dari 0');
  if (v.moisture < MOISTURE_MIN || v.moisture > MOISTURE_MAX) {
    errors.push(`Kadar air harus ${MOISTURE_MIN}-${MOISTURE_MAX}%`);
  }
  if (!(v.area > 0)) errors.push('Luas dipanen harus lebih dari 0');
  else if (v.plantArea && v.area > v.plantArea * AREA_TOLERANCE) {
    errors.push(`Luas dipanen melebihi luas tanaman (${v.plantArea} ha)`);
  }
  if (errors.length) throw new BadRequestException(errors.join('; '));
}
