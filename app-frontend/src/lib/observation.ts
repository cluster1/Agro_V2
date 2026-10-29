import { CheckCircle2, FileEdit, Hourglass, XCircle, type LucideIcon } from 'lucide-react'
import type { BadgeProps } from '@/components/ui/badge'

/** Status observasi (tm_plant_observation.obs_sts). */
export const OBSERVATION_STATUS: Record<number, { label: string; variant: BadgeProps['variant']; icon: LucideIcon }> = {
  0: { label: 'Draf', variant: 'secondary', icon: FileEdit },
  1: { label: 'Menunggu verifikasi', variant: 'warning', icon: Hourglass },
  2: { label: 'Terverifikasi', variant: 'success', icon: CheckCircle2 },
  3: { label: 'Ditolak', variant: 'destructive', icon: XCircle },
}

export const observationStatus = (sts: number | null | undefined) => OBSERVATION_STATUS[sts ?? 1] ?? OBSERVATION_STATUS[1]

export const OBSERVATION_SOURCE: Record<string, string> = {
  WEB: 'Web',
  FIELDKIT: 'Field Kit',
  API: 'API',
  AI: 'Analisis citra',
  IMPORT: 'Impor',
}

/** Kode gejala (dipisah koma di obs_symptom) dan labelnya. */
export const SYMPTOMS: { code: string; label: string }[] = [
  { code: 'NORMAL', label: 'Daun normal, tanpa gejala' },
  { code: 'N_KUNING', label: 'Daun menguning (kurang N)' },
  { code: 'P_GELAP', label: 'Daun gelap keunguan (kurang P)' },
  { code: 'K_TEPI', label: 'Tepi daun mengering (kurang K)' },
  { code: 'KERDIL', label: 'Kerdil' },
  { code: 'ZN_BERCAK', label: 'Bercak (kurang Zn)' },
  { code: 'S_PUCAT', label: 'Daun pucat (kurang S)' },
]

export const symptomLabel = (code: string) => SYMPTOMS.find((s) => s.code === code)?.label ?? code
export const splitSymptoms = (value: string | null | undefined): string[] => (value ? value.split(',').filter(Boolean) : [])

/** Nilai BWD yang sah: 2 sampai 5 kelipatan 0,5. */
export const BWD_VALUES = [2, 2.5, 3, 3.5, 4, 4.5, 5]

export interface ObservationFields {
  bwd: boolean
  panicle: boolean
  grain: boolean
}

/**
 * Field yang relevan pada umur (HST) dan urutan fase tertentu; cermin aturan backend:
 * BWD HST 14-62, malai mulai berbunga (fase 7), gabah masak susu s.d. masak penuh (fase 8-10).
 */
export function fieldsFor(age: number | null, phaseSeq: number | null): ObservationFields {
  return {
    bwd: age !== null && age >= 14 && age <= 62,
    panicle: (phaseSeq ?? 0) >= 7,
    grain: (phaseSeq ?? 0) >= 8 && (phaseSeq ?? 0) <= 10,
  }
}

const DAY_MS = 86_400_000

export function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null
  const a = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`)
  return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / DAY_MS)
}

interface PhaseLike {
  phase_id: string
  phase_seq: number
  phase_start_age: number | null
  phase_end_age: number | null
}

/** Fase generik pada umur tertentu (start <= umur < end). */
export function phaseForAge<T extends PhaseLike>(phases: T[], age: number | null): T | undefined {
  if (age === null || !phases.length) return undefined
  const ordered = [...phases].sort((a, b) => a.phase_seq - b.phase_seq)
  if (age < (ordered[0].phase_start_age ?? 0)) return ordered[0]
  return ordered.find((p) => age >= (p.phase_start_age ?? 0) && (p.phase_end_age == null || age < p.phase_end_age))
}
