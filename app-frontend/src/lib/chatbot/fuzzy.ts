// Logika fuzzy untuk kalimat jawaban chatbot. Hanya memperhalus kata-kata; status resmi (nStatus, ambang
// pertumbuhan model) tetap disebut apa adanya oleh pemanggil dan tidak pernah diganti oleh hasil di sini.

/** Fungsi keanggotaan trapesium [a, b, c, d]: 0 di luar a..d, naik ke 1 di b, 1 sampai c, turun ke 0 di d. */
export type Trapezoid = [a: number, b: number, c: number, d: number]

export function membership(x: number, [a, b, c, d]: Trapezoid): number {
  if (x < a || x > d) return 0
  if (x < b) return (x - a) / (b - a)
  if (x <= c) return 1
  return d === c ? 1 : (d - x) / (d - c)
}

export interface FuzzySet {
  label: string
  mf: Trapezoid
}

export interface Graded {
  label: string
  degree: number
  /** himpunan terdekat berikutnya bila derajatnya cukup besar (peralihan) */
  second: { label: string; degree: number } | null
}

const TRANSITION = 0.3

/** Himpunan dengan derajat tertinggi, beserta himpunan kedua bila derajatnya minimal 0,3. */
export function grade(x: number, sets: FuzzySet[]): Graded {
  const scored = sets.map((s) => ({ label: s.label, degree: membership(x, s.mf) })).sort((a, b) => b.degree - a.degree)
  const [top, next] = scored
  return { label: top.label, degree: top.degree, second: next && next.degree >= TRANSITION ? next : null }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// ---------------------------------------------------------------------------------------------
// Warna daun (BWD) terhadap batas minimal tahap tumbuh

export interface LeafColorGrade {
  /** selisih BWD terhadap batas minimal */
  diff: number
  degrees: { kurang: number; cukup: number; lebih: number }
  phrase: string
}

/**
 * Derajat kurang/cukup/lebih dari selisih d = BWD - batas. Kata-kata mengikuti status resmi: BWD di bawah
 * batas tidak pernah disebut "cukup", dan BWD di atas batas tidak pernah disebut "kurang".
 */
export function leafColorGrade(bwd: number | null, bwdMin: number | null): LeafColorGrade | null {
  if (bwd === null || bwdMin === null) return null
  const d = bwd - bwdMin
  const degrees = {
    kurang: d < 0 ? clamp01(-d) : 0,
    cukup: d < 0 ? clamp01(1 + d) : d <= 1 ? 1 : clamp01(2 - d),
    lebih: clamp01(d - 1),
  }
  let phrase: string
  if (d < 0) {
    phrase = degrees.kurang <= 0.3 ? 'sedikit di bawah batas' : degrees.kurang <= 0.5 ? 'agak kurang, mendekati batas' : 'di bawah batas'
  } else if (d < 0.3) {
    phrase = 'cukup, tepat di batas'
  } else if (degrees.lebih <= 0.3) {
    phrase = 'cukup'
  } else if (degrees.lebih < 0.7) {
    phrase = 'cukup, di atas batas'
  } else {
    phrase = 'jauh di atas batas'
  }
  return { diff: d, degrees, phrase }
}

// ---------------------------------------------------------------------------------------------
// Indeks pertumbuhan (GI)

const GROWTH_SETS: FuzzySet[] = [
  { label: 'terhambat', mf: [0, 0, 0.84, 0.9] },
  { label: 'sedikit di bawah standar', mf: [0.84, 0.9, 0.93, 0.97] },
  { label: 'baik', mf: [0.93, 0.97, 1, 1.01] },
]

export interface GrowthGrade {
  stunted: boolean
  phrase: string
}

/** `stunted` memakai ambang resmi model (GI di bawah 0,85); fuzzy hanya memberi nuansa di atas ambang. */
export function growthGrade(gi: number | null, stuntedBelow = 0.85): GrowthGrade | null {
  if (gi === null) return null
  if (gi < stuntedBelow) return { stunted: true, phrase: 'terhambat (kerdil)' }
  const near = membership(gi, GROWTH_SETS[0].mf)
  const g = grade(gi, GROWTH_SETS.slice(1))
  let phrase = g.label
  if (g.label === 'baik' && g.second) phrase = 'baik, tapi mulai mendekati standar bawah'
  if (g.label === 'sedikit di bawah standar' && g.second) phrase = 'sedikit di bawah standar, mendekati baik'
  if (near >= TRANSITION) phrase = `${phrase.split(',')[0]}, mendekati batas terhambat`
  return { stunted: false, phrase }
}

// ---------------------------------------------------------------------------------------------
// Perkiraan hasil terhadap rata-rata varietas (rasio = perkiraan / rata-rata)

const YIELD_SETS: FuzzySet[] = [
  { label: 'di bawah rata-rata varietas', mf: [0, 0, 0.85, 0.97] },
  { label: 'dekat rata-rata varietas', mf: [0.85, 0.97, 1.03, 1.15] },
  { label: 'di atas rata-rata varietas', mf: [1.03, 1.15, 99, 99] },
]

export function yieldGrade(value: number | null, avg: number | null, potential: number | null): string | null {
  if (value === null || avg === null || avg <= 0) return null
  const g = grade(value / avg, YIELD_SETS)
  let phrase = g.label
  if (g.second) {
    const below = g.second.label.startsWith('di bawah')
    const above = g.second.label.startsWith('di atas')
    if (g.label.startsWith('dekat')) phrase = `${g.label}, sedikit ${below ? 'di bawahnya' : 'di atasnya'}`
    else if (g.label.startsWith('di bawah') && g.second.label.startsWith('dekat')) phrase = `${g.label}, mendekati rata-rata`
    else if (g.label.startsWith('di atas') && above === false) phrase = `${g.label}, belum jauh`
  }
  if (potential !== null && potential > 0 && value >= potential * 0.9) phrase += ', mendekati potensi varietas'
  return phrase
}

// ---------------------------------------------------------------------------------------------
// Tingkat kepastian (sama dengan label di kartu Perkiraan hasil: ambang 0,6 dan 0,8)

export function confidenceWord(c: number | null): string | null {
  if (c === null) return null
  return c >= 0.8 ? 'tinggi' : c >= 0.6 ? 'sedang' : 'rendah'
}
