/** Tipe dan fungsi murni untuk halaman Digital Twin (data dari GET /plants/:id/twin). */

export interface TwinPhase {
  phase_id: string
  name: string
  code: string | null
  seq: number
  color: string | null
}

export interface TimelineEntry {
  phase_id: string
  seq: number
  start: string
  end: string | null
  start_age: number
  data_type: 'ACTUAL' | 'FORECAST' | 'NORMAL'
  actual_date: string | null
  error_day: number | null
  name: string
  color: string | null
}

export interface TwinObservation {
  obs_id: string
  date: string
  age: number | null
  phase_id: string | null
  height: number | null
  tiller: number | null
  bwd: number | null
  panicle: number | null
  grain: number | null
  filled_pct: number | null
  phase_pct: number | null
  pest_name: string | null
  pest_pct: number | null
  symptoms: string[]
  status: number
  source: string | null
}

export interface TwinMedia {
  media_id: string
  type: string | null
  path: string | null
  description: string | null
  date: string | null
  age: number | null
  lon: number | null
  lat: number | null
  pact_id: string | null
  obs_id: string | null
}

export interface PlantTwin {
  plant: {
    plant_id: string
    name: string | null
    season: string | null
    status: number
    area_ha: number | null
    hills: number | null
    sow_date: string | null
    plant_date: string | null
    harvest_date: string | null
    phase_mode: string | null
    health: string | null
    lon: number | null
    lat: number | null
    geom: GeoJsonPolygon | null
    cluster_id: string
    site_id: string
  }
  variety: { var_id: string; name: string; maturity: number | null; yield_avg: number | null; yield_potential: number | null } | null
  now: { date: string; age: number | null; phase: TwinPhase | null }
  phases: TwinPhase[]
  reference: { height: AgePoint[]; tiller: AgePoint[]; bwd_min: number | null }
  observations: TwinObservation[]
  simulation: {
    sim_id: string
    date: string
    scenario: string
    note: string | null
    param: Record<string, any> | null
    timeline: TimelineEntry[]
  } | null
  growth: { index: number | null; stunted: boolean; needs_observation: boolean }
  nutrients: {
    n_def: number | null
    p2o5_def: number | null
    k2o_def: number | null
    bwd: number | null
    symptoms: string[]
    soil_p: string | null
    soil_k: string | null
  }
  yield: {
    value: number | null
    low: number | null
    high: number | null
    confidence: number | null
    method: string | null
    factors: { f_growth: number; f_n: number; f_pest: number } | null
    harvest_date: string | null
    avg: number | null
    potential: number | null
  } | null
  scenarios: { scenario: string; harvest_date: string | null; yield: number | null }[]
  recommendation: { sched_id: string; title: string; start: string | null; description: string | null; plan_value: string | null } | null
  sensors: { ds_id: string; dev_id: string; name: string; kt_id: string | null; value: number | null; read_at: string | null; warn_min: number | null; warn_max: number | null }[]
  weather: { latest: WeatherDay | null; forecast: WeatherDay[] }
  media: TwinMedia[]
}

export interface WeatherDay {
  date: string
  type: string
  tmin: number | null
  tmax: number | null
  rain: number | null
  rh: number | null
}

export interface SitePlant {
  plant_id: string
  name: string | null
  cluster_id: string
  site_id: string
  season: string | null
  area_ha: number | null
  age: number | null
  health: string | null
  phase: TwinPhase | null
  lon: number | null
  lat: number | null
  geom: GeoJsonPolygon | null
  harvest_date: string | null
  yield: number | null
  growth_index: number | null
}

export interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface AgePoint {
  age: number
  value: number
}

const DAY_MS = 86_400_000
const parse = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`)

export const addDays = (day: string, n: number) => new Date(parse(day) + n * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY_MS)

/** Nilai acuan pada umur tertentu (interpolasi linier antar titik akhir fase; 0 saat tanam; datar setelah titik terakhir). */
export function interpolate(points: AgePoint[] | null | undefined, age: number): number | null {
  const pts = [...(points ?? [])].sort((a, b) => a.age - b.age)
  if (!pts.length) return null
  if (age <= 0) return 0
  if (age <= pts[0].age) return pts[0].age > 0 ? (pts[0].value * age) / pts[0].age : pts[0].value
  for (let i = 1; i < pts.length; i++) {
    if (age <= pts[i].age) {
      const a = pts[i - 1]
      const b = pts[i]
      return a.value + ((b.value - a.value) * (age - a.age)) / (b.age - a.age)
    }
  }
  return pts[pts.length - 1].value
}

/** Fase pada tanggal tertentu: yang terakhir sudah dimulai; fase pertama sebelum apa pun dimulai. */
export function phaseOnDay(timeline: TimelineEntry[], day: string): TimelineEntry | undefined {
  if (!timeline.length) return undefined
  let cur = timeline[0]
  for (const p of timeline) if (p.start <= day) cur = p
  return cur
}

/** Rentang slider: tanggal sebar sampai panen proyeksi (atau umur panen varietas), ditambah sedikit sisa. */
export function sliderRange(twin: PlantTwin): { start: string; end: string } | null {
  const start = twin.plant.sow_date ?? twin.plant.plant_date
  if (!start) return null
  const tl = twin.simulation?.timeline ?? []
  const harvest =
    twin.yield?.harvest_date ??
    (tl.length ? tl[tl.length - 1].start : twin.plant.plant_date && twin.variety?.maturity ? addDays(twin.plant.plant_date, twin.variety.maturity) : null)
  if (!harvest) return null
  const end = addDays(harvest, 7)
  return { start, end: end > start ? end : addDays(start, 120) }
}

export type NStatus = 'ENOUGH' | 'LOW' | 'DEFICIENT' | 'UNMEASURED'

export const N_STATUS: Record<NStatus, { label: string; color: string }> = {
  ENOUGH: { label: 'Cukup', color: '#2E7D32' },
  LOW: { label: 'Mulai kurang', color: '#F9A825' },
  DEFICIENT: { label: 'Kurang', color: '#C62828' },
  UNMEASURED: { label: 'Tidak diukur', color: '#757575' },
}

/** Status N dari BWD terhadap batas fase: >= batas cukup; dalam 0,5 di bawah mulai kurang; selebihnya kurang. */
export function nStatus(bwd: number | null, bwdMin: number | null): NStatus {
  if (bwd === null || bwdMin === null) return 'UNMEASURED'
  if (bwd >= bwdMin) return 'ENOUGH'
  return bwdMin - bwd <= 0.5 ? 'LOW' : 'DEFICIENT'
}

/** Warna daun dari BWD (skala 2 hijau muda ... 5 hijau tua); abu-abu bila tidak diukur. */
export function leafColor(bwd: number | null): string {
  if (bwd === null) return '#9CCC65'
  const t = Math.max(0, Math.min(1, (bwd - 2) / 3))
  const from = [197, 225, 165]
  const to = [27, 94, 32]
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * t))
  return `rgb(${rgb.join(',')})`
}

/** BWD observasi terdekat sebelum/di tanggal tertentu (untuk warna daun saat slider bergerak). */
export function bwdAt(observations: TwinObservation[], day: string): number | null {
  const past = observations.filter((o) => o.date <= day && o.bwd !== null)
  return past.length ? (past[past.length - 1].bwd as number) : null
}

export interface ProjectedShape {
  points: string
  viewBox: string
}

/**
 * Memproyeksikan polygon lon/lat ke koordinat SVG (equirectangular dengan koreksi lintang),
 * sehingga bentuk petak tidak melar. Sumbu y dibalik (utara di atas).
 */
export function projectPolygons(rings: { id: string; ring: number[][] }[], size = 400, pad = 16) {
  const all = rings.flatMap((r) => r.ring)
  if (!all.length) return null
  const lat0 = (all.reduce((s, p) => s + p[1], 0) / all.length) * (Math.PI / 180)
  const xy = (p: number[]) => [p[0] * Math.cos(lat0), p[1]]
  const pts = all.map(xy)
  const minX = Math.min(...pts.map((p) => p[0]))
  const maxX = Math.max(...pts.map((p) => p[0]))
  const minY = Math.min(...pts.map((p) => p[1]))
  const maxY = Math.max(...pts.map((p) => p[1]))
  const span = Math.max(maxX - minX, maxY - minY) || 1e-6
  const scale = (size - pad * 2) / span
  const offX = (size - (maxX - minX) * scale) / 2
  const offY = (size - (maxY - minY) * scale) / 2
  const project = (p: number[]): [number, number] => {
    const [x, y] = xy(p)
    return [offX + (x - minX) * scale, size - (offY + (y - minY) * scale)]
  }
  return {
    size,
    project,
    shapes: rings.map((r) => ({ id: r.id, points: r.ring.map((p) => project(p).join(',')).join(' ') })),
  }
}

export const ringOf = (geom: GeoJsonPolygon | null | undefined): number[][] | null =>
  geom?.type === 'Polygon' && Array.isArray(geom.coordinates?.[0]) && geom.coordinates[0].length >= 4 ? geom.coordinates[0] : null

/** Perbandingan petugas vs model pada tanggal gambar: sama fase = Sesuai, selisih BWD <= 0,3 = Sesuai. */
export function compareTruth(
  observation: TwinObservation | undefined,
  modelPhase: TimelineEntry | undefined,
  modelBwd: number | null,
): { status: 'MATCH' | 'DIFF' | 'NONE'; officer: string; model: string } {
  if (!observation || !modelPhase) return { status: 'NONE', officer: '-', model: modelPhase?.name ?? '-' }
  const samePhase = observation.phase_id === modelPhase.phase_id
  const bwdClose = observation.bwd !== null && modelBwd !== null && Math.abs(observation.bwd - modelBwd) <= 0.3
  return {
    status: samePhase || bwdClose ? 'MATCH' : 'DIFF',
    officer: [observation.phase_id ? `fase ${observation.phase_id}` : null, observation.bwd !== null ? `BWD ${observation.bwd}` : null].filter(Boolean).join(', ') || '-',
    model: [modelPhase.name, modelBwd !== null ? `BWD ${modelBwd}` : null].filter(Boolean).join(', '),
  }
}
