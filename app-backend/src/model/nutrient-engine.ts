import { NITROGEN, PHOSPHORUS, POTASSIUM, SOIL_STATUS_DEFAULT, rainyMonths, round } from './model-config';

export type SoilStatus = 'RENDAH' | 'SEDANG' | 'TINGGI';

export const seasonOf = (month: number): 'RAINY' | 'DRY' => (rainyMonths.includes(month) ? 'RAINY' : 'DRY');

export interface NitrogenResult {
  /** kg N/ha still missing; 0 when BWD is fine or not applicable */
  n_def: number;
  urea_dose: number;
  applicable: boolean;
  bwd: number | null;
  bwd_min: number | null;
}

/**
 * F-MDL-03: applies only in phases with a BWD limit. Latest BWD below the limit asks for a urea
 * correction; N deficit = dose x 0.46.
 */
export function nitrogenDeficit(bwd: number | null, bwdMin: number | null, month: number): NitrogenResult {
  if (bwdMin === null) return { n_def: 0, urea_dose: 0, applicable: false, bwd, bwd_min: bwdMin };
  if (bwd === null || bwd >= bwdMin) return { n_def: 0, urea_dose: 0, applicable: true, bwd, bwd_min: bwdMin };
  const dose = NITROGEN.ureaDose[seasonOf(month)];
  return { n_def: round(dose * NITROGEN.ureaN, 2), urea_dose: dose, applicable: true, bwd, bwd_min: bwdMin };
}

export interface NutrientTotals {
  n_kg_ha: number;
  p2o5_kg_ha: number;
  k2o_kg_ha: number;
}

export interface PkResult {
  p_status: SoilStatus;
  k_status: SoilStatus;
  p_rec: number;
  k_rec: number;
  p_def: number;
  k_def: number;
  p_in: number;
  k_in: number;
  /** true when a status had to be assumed (no lab data) */
  assumed: boolean;
}

/**
 * F-MDL-04: Def = max(0, Rek(status) - sum(inputs this season)). Recommended P2O5/K2O follow the
 * single-fertiliser dose per status (SP-36 36%, KCl 60%). Without a lab value the status is SEDANG.
 */
export function pkDeficit(
  pStatus: SoilStatus | null | undefined,
  kStatus: SoilStatus | null | undefined,
  inputs: NutrientTotals,
): PkResult {
  const p = pStatus ?? SOIL_STATUS_DEFAULT;
  const k = kStatus ?? SOIL_STATUS_DEFAULT;
  const pRec = round(PHOSPHORUS.dose[p] * PHOSPHORUS.content, 2);
  const kRec = round(POTASSIUM.dose[k] * POTASSIUM.content, 2);
  return {
    p_status: p,
    k_status: k,
    p_rec: pRec,
    k_rec: kRec,
    p_in: round(inputs.p2o5_kg_ha, 2),
    k_in: round(inputs.k2o_kg_ha, 2),
    p_def: round(Math.max(0, pRec - inputs.p2o5_kg_ha), 2),
    k_def: round(Math.max(0, kRec - inputs.k2o_kg_ha), 2),
    assumed: !pStatus || !kStatus,
  };
}

export interface FertilizerAdvice {
  urea_kg_ha: number;
  sp36_kg_ha: number;
  kcl_kg_ha: number;
}

const kgOf = (deficit: number, content: number): number => (deficit <= 0 ? 0 : Math.ceil(deficit / content - 1e-9));

/** Converts nutrient deficits into kg of straight fertiliser per hectare, rounded up (F-MDL-05). */
export function advice(nDef: number, pDef: number, kDef: number): FertilizerAdvice {
  return {
    urea_kg_ha: kgOf(nDef, NITROGEN.ureaN),
    sp36_kg_ha: kgOf(pDef, PHOSPHORUS.content),
    kcl_kg_ha: kgOf(kDef, POTASSIUM.content),
  };
}

export const hasAdvice = (a: FertilizerAdvice) => a.urea_kg_ha > 0 || a.sp36_kg_ha > 0 || a.kcl_kg_ha > 0;
