/** Tipe dan fungsi murni untuk halaman Digital Twin (data dari GET /plants/:id/twin). */

import { formatNumber } from '@/lib/format'

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
  sensors: {
    ds_id: string
    dev_id: string
    sens_id: string | null
    name: string
    kt_id: string | null
    value: number | null
    read_at: string | null
    warn_min: number | null
    warn_max: number | null
    norm_min?: number | null
    norm_max?: number | null
  }[]
  weather: { latest: WeatherDay | null; forecast: WeatherDay[] }
  media: TwinMedia[]
}

export type SensorParam = PlantTwin['sensors'][number]

export const isCamera = (type: string | null | undefined): boolean => /camera|cctv/i.test(type ?? '')

/** Parameter (tm_device_sensor) dikelompokkan per sensor (tm_sensor); hanya untuk keterangan, tidak diposisikan. */
export function parametersBySensor(params: SensorParam[]): Map<string, SensorParam[]> {
  const out = new Map<string, SensorParam[]>()
  for (const p of params) if (p.sens_id) out.set(p.sens_id, [...(out.get(p.sens_id) ?? []), p])
  return out
}

export const paramLine = (p: SensorParam): string => `${p.name}: ${p.value === null ? 'belum ada data' : formatNumber(p.value)}`

/** Status satu parameter terhadap batas peringatan: di bawah, di atas, normal, atau belum ada data / batas. */
export type ParamState = 'low' | 'high' | 'ok' | 'none'

export function paramState(p: Pick<SensorParam, 'value' | 'warn_min' | 'warn_max'>): ParamState {
  if (p.value === null) return 'none'
  if (p.warn_min !== null && p.value < p.warn_min) return 'low'
  if (p.warn_max !== null && p.value > p.warn_max) return 'high'
  return p.warn_min === null && p.warn_max === null ? 'none' : 'ok'
}

export interface SceneController {
  dev_id: string
  name: string
  lat: number | null
  lon: number | null
  location: string | null
  number_id: string | null
  /** gambar perangkat; hanya dipakai bila berupa URL http(s) */
  image: string | null
  status: number | null
  /** kamera disimpan bersama pengendali, digambar menyatu dengannya */
  cameras: string[]
  /** sensor (bukan kamera) milik pengendali ini */
  sensors: { sens_id: string; name: string; type: string | null }[]
}

export interface SceneSensor {
  sens_id: string
  dev_id: string
  /** nama pengendali induk */
  dev_name: string
  name: string
  type: string | null
  location: string | null
  lat: number
  lon: number
  /** nilai parameter sebagai keterangan */
  info: string
  params: SensorParam[]
}

/** Objek 3D yang sedang dipilih (diklik) untuk ditampilkan infonya. */
export interface SceneSelection {
  kind: 'controller' | 'sensor'
  id: string
}

/**
 * Pengendali dan sensor milik cluster petak untuk model 3D. Sensor diposisikan dari koordinat tabel
 * sensor (bila kosong, dari pengendalinya); kamera tidak digambar sendiri, tetapi ikut pengendali.
 */
export function sensorScene(map: TwinMapData | undefined, clusterId: string | null | undefined, params: SensorParam[]) {
  const devices = (map?.devices ?? []).filter((d) => !!clusterId && d.cluster_id === clusterId)
  const byDev = new Map(devices.map((d) => [d.dev_id, d]))
  const sensors = (map?.sensors ?? []).filter((s) => byDev.has(s.dev_id))
  const bySens = parametersBySensor(params)

  const controllers: SceneController[] = devices.map((d) => ({
    dev_id: d.dev_id,
    name: d.name ?? d.dev_id,
    lat: d.lat,
    lon: d.lon,
    location: d.location ?? null,
    number_id: d.number_id ?? null,
    image: d.image ?? null,
    status: d.status ?? null,
    cameras: sensors.filter((s) => s.dev_id === d.dev_id && isCamera(s.type)).map((s) => s.name ?? s.sens_id),
    sensors: sensors.filter((s) => s.dev_id === d.dev_id && !isCamera(s.type)).map((s) => ({ sens_id: s.sens_id, name: s.name ?? s.sens_id, type: s.type })),
  }))

  const placed = sensors
    .filter((s) => !isCamera(s.type))
    .flatMap((s): SceneSensor[] => {
      const dev = byDev.get(s.dev_id)
      const coord = resolveCoord({ lat: s.lat, lon: s.lon }, [{ source: 'device', lat: dev?.lat, lon: dev?.lon }])
      if (!coord) return []
      return [
        {
          sens_id: s.sens_id,
          dev_id: s.dev_id,
          dev_name: dev?.name ?? s.dev_id,
          name: s.name ?? s.sens_id,
          type: s.type,
          location: s.location ?? null,
          lat: coord.lat,
          lon: coord.lon,
          info: (bySens.get(s.sens_id) ?? []).map(paramLine).join(', '),
          params: bySens.get(s.sens_id) ?? [],
        },
      ]
    })
  return { controllers, sensors: placed }
}

export interface DeviceSummary {
  controller: SceneController
  /** semua sensor (bukan kamera) milik pengendali, termasuk yang belum punya koordinat */
  sensors: { sens_id: string; name: string; type: string | null; params: SensorParam[] }[]
  /** parameter pengendali yang tidak terkait ke sensor mana pun */
  loose: SensorParam[]
}

/** Keterangan lengkap tiap pengendali: sensornya dengan semua parameter, plus parameter yang tidak terkait sensor. */
export function deviceSummaries(controllers: SceneController[], params: SensorParam[]): DeviceSummary[] {
  const bySens = parametersBySensor(params)
  return controllers.map((c) => {
    const own = new Set(c.sensors.map((s) => s.sens_id))
    return {
      controller: c,
      sensors: c.sensors.map((s) => ({ ...s, params: bySens.get(s.sens_id) ?? [] })),
      loose: params.filter((p) => p.dev_id === c.dev_id && (!p.sens_id || !own.has(p.sens_id))),
    }
  })
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

export type CoordSource = 'own' | 'plant' | 'device' | 'site'

export interface ResolvedCoord {
  lat: number
  lon: number
  source: CoordSource
}

const validCoord = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' &&
  typeof lon === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180 &&
  !(lat === 0 && lon === 0) // 0,0 = belum diisi, bukan lokasi nyata

/**
 * Koordinat sebuah objek: milik sendiri bila valid, lalu fallback berurutan (petak, site).
 * Cluster tidak punya koordinat, jadi rantainya: data sendiri -> petak -> site.
 */
export function resolveCoord(
  own: { lat: number | null | undefined; lon: number | null | undefined } | null | undefined,
  fallbacks: { source: Exclude<CoordSource, 'own'>; lat: number | null | undefined; lon: number | null | undefined }[] = [],
): ResolvedCoord | null {
  if (own && validCoord(own.lat, own.lon)) return { lat: own.lat as number, lon: own.lon as number, source: 'own' }
  for (const f of fallbacks) if (validCoord(f.lat, f.lon)) return { lat: f.lat as number, lon: f.lon as number, source: f.source }
  return null
}

/** Warna pin foto di peta dan model 3D. */
export const PIN_COLOR = '#1565C0'
export const PIN_COLOR_ACTIVE = '#C62828'

export const COORD_SOURCE_LABEL: Record<CoordSource, string> = {
  own: 'koordinat sendiri',
  plant: 'koordinat petak (perkiraan)',
  device: 'koordinat perangkat (perkiraan)',
  site: 'koordinat site (perkiraan)',
}

/** Cincin GeoJSON [lon,lat] -> [lat,lon] untuk Leaflet; titik tak valid dibuang. */
export function polygonLatLngs(geom: GeoJsonPolygon | null | undefined): [number, number][] | null {
  const ring = ringOf(geom)
  if (!ring) return null
  const pts = ring.filter((p) => validCoord(p[1], p[0])).map((p): [number, number] => [p[1], p[0]])
  return pts.length >= 4 ? pts : null
}

/** Ray casting; titik dan cincin dalam sistem koordinat yang sama. */
function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Titik sampel BWD: pola diagonal pada kotak pembatas, hanya yang jatuh di dalam petak. Cincin [lat,lon]. */
export function samplePoints(ring: [number, number][], count = 20): [number, number][] {
  const lats = ring.map((p) => p[0])
  const lons = ring.map((p) => p[1])
  const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)]
  const out: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const p: [number, number] = [la0 + (la1 - la0) * t, lo0 + (lo1 - lo0) * t]
    if (pointInRing(p, ring)) out.push(p)
  }
  return out
}

export interface TwinMapData {
  sites: { site_id: string; name: string | null; lat: number | null; lon: number | null }[]
  devices: {
    dev_id: string
    name: string | null
    site_id: string
    cluster_id: string | null
    lat: number | null
    lon: number | null
    location?: string | null
    number_id?: string | null
    image?: string | null
    status?: number | null
  }[]
  sensors: { sens_id: string; dev_id: string; name: string | null; type: string | null; lat: number | null; lon: number | null; location?: string | null }[]
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

/**
 * Tinggi (cm) atau anakan pada umur tertentu untuk model 3D. Sampai observasi terakhir: interpolasi
 * linier antar observasi (dari 0 saat tanam). Sesudahnya: nilai observasi terakhir mengikuti bentuk
 * kurva acuan (proyeksi). Tanpa observasi: kurva acuan.
 */
export function valueAtAge(twin: PlantTwin, field: 'height' | 'tiller', age: number): number | null {
  const ref = field === 'height' ? twin.reference.height : twin.reference.tiller
  const pts: AgePoint[] = twin.observations
    .filter((o) => o.age !== null && o.age >= 0 && o[field] !== null)
    .map((o) => ({ age: o.age as number, value: o[field] as number }))
    .sort((a, b) => a.age - b.age)
  if (!pts.length) return interpolate(ref, age)
  const last = pts[pts.length - 1]
  if (age <= last.age) return interpolate(pts, age)
  const refLast = interpolate(ref, last.age)
  const refNow = interpolate(ref, age)
  if (refLast === null || refNow === null || refLast <= 0) return last.value
  return last.value * (refNow / refLast)
}

/** Warna malai/gabah menurut urutan fase: hijau saat berbunga, kuning, lalu oranye saat masak. */
export function grainColor(phaseSeq: number | null): string {
  if (phaseSeq === null || phaseSeq < 7) return '#9CCC65'
  if (phaseSeq === 7) return '#C5E1A5'
  if (phaseSeq === 8) return '#FDD835'
  if (phaseSeq === 9) return '#F9A825'
  return '#EF6C00'
}

/** Sawah tergenang sampai pengeringan (awal masak kuning, fase 9). */
export const hasWater = (phaseSeq: number | null): boolean => phaseSeq === null || phaseSeq < 9

/** WebGL tersedia di browser ini? (tanpa itu model 3D diganti peta 2D) */
export function webglSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}
