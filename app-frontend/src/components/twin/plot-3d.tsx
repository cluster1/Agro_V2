'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Cpu, Radio, RotateCcw, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber } from '@/lib/format'
import {
  N_STATUS,
  deviceSummaries,
  paramState,
  type DeviceSummary,
  type PlantTwin,
  type SensorParam,
  PIN_COLOR,
  PIN_COLOR_ACTIVE,
  grainColor,
  hasWater,
  leafColor,
  nStatus,
  ringOf,
  type GeoJsonPolygon,
  type SceneController,
  type SceneSelection,
  type SceneSensor,
  type TwinMedia,
} from '@/lib/twin'
import type { ColorMode } from '@/components/twin/plot-map'

export interface Plot3DProps {
  /** tinggi rata-rata (cm) dan anakan per rumpun pada tanggal slider */
  heightCm: number
  tillers: number
  bwd: number | null
  bwdMin: number | null
  mode: ColorMode
  phaseSeq: number | null
  geom: GeoJsonPolygon | null
  media: TwinMedia[]
  selectedMediaId: string | null
  /** pengendali (kamera menyatu dengannya) dan sensor, diposisikan dari koordinat tabel sensor */
  controllers: SceneController[]
  sensors: SceneSensor[]
  /** parameter sensor petak (nilai, batas, waktu baca), untuk panel Perangkat & sensor */
  parameters: SensorParam[]
  /** defisit hara dari model (kg/ha), untuk panel status hara di atas model */
  nutrients: PlantTwin['nutrients']
  /** pengendali atau sensor yang diklik; disorot dan infonya ditampilkan di luar kanvas */
  selected: SceneSelection | null
  onSelectDevice: (selection: SceneSelection | null) => void
  onSelectMedia: (id: string) => void
  label: string
}

const HIGHLIGHT = '#FFC107'

/** Cuplikan petak: 6 x 6 m, jajar legowo 2:1 (25 x 12,5 x 50 cm). */
const HALF = 3
const SPACING_X = 0.25
const PAIR_GAP = 0.125
const BAND = 0.625
const MAX_BLADES_PER_HILL = 10
const MAX_HILLS_RENDERED = 700

/** Pseudo-acak deterministik agar rumpun tidak "berkedip" saat render ulang. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function hillPositions(): [number, number][] {
  const out: [number, number][] = []
  for (let z = -HALF + 0.1; z < HALF - 0.1; z += BAND) {
    for (const dz of [0, PAIR_GAP]) {
      for (let x = -HALF + 0.1; x < HALF - 0.1; x += SPACING_X) out.push([x, z + dz])
    }
  }
  return out.length > MAX_HILLS_RENDERED ? out.filter((_, i) => i % Math.ceil(out.length / MAX_HILLS_RENDERED) === 0) : out
}

/** Bilah daun: kerucut ramping yang tingginya mengikuti data, condong acak per rumpun. */
function Blades({ hills, heightCm, tillers, color }: { hills: [number, number][]; heightCm: number; tillers: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const perHill = Math.max(1, Math.min(MAX_BLADES_PER_HILL, Math.round(tillers)))
  const count = hills.length * perHill
  const height = Math.max(0.02, heightCm / 100)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const rand = rng(42)
    let i = 0
    for (const [x, z] of hills) {
      for (let b = 0; b < perHill; b++) {
        const lean = 0.05 + rand() * 0.25
        const dir = rand() * Math.PI * 2
        const h = height * (0.85 + rand() * 0.3)
        dummy.position.set(x + (rand() - 0.5) * 0.05, h / 2, z + (rand() - 0.5) * 0.05)
        dummy.rotation.set(Math.sin(dir) * lean, 0, Math.cos(dir) * lean)
        dummy.scale.set(1, h, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i++, dummy.matrix)
      }
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }, [hills, perHill, height, count])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(count, 1)]} frustumCulled={false}>
      <coneGeometry args={[0.012, 1, 4]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </instancedMesh>
  )
}

/** Malai: elips kecil di ujung rumpun, mulai fase berbunga. */
function Panicles({ hills, heightCm, color }: { hills: [number, number][]; heightCm: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const height = Math.max(0.05, heightCm / 100)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const rand = rng(7)
    hills.forEach(([x, z], i) => {
      dummy.position.set(x + (rand() - 0.5) * 0.06, height * 0.95, z + (rand() - 0.5) * 0.06)
      dummy.rotation.set((rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.8)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [hills, height])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(hills.length, 1)]} frustumCulled={false}>
      <capsuleGeometry args={[0.015, 0.12, 3, 6]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </instancedMesh>
  )
}

/** Pengendali (Station Kit): tiang dan kotak kontrol; kamera yang tersimpan bersamanya dipasang di tiang yang sama. */
function StationKit({
  controller,
  position,
  selected,
  onHover,
  onSelect,
}: {
  controller: SceneController
  position: [number, number]
  selected: boolean
  onHover: (label: string | null, clickable?: boolean) => void
  onSelect: () => void
}) {
  const label = `Station Kit ${controller.name}${controller.cameras.length ? ` · kamera: ${controller.cameras.join(', ')}` : ''} (klik untuk info)`
  return (
    <group
      position={[position[0], 0, position[1]]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(label, true)
      }}
      onPointerOut={() => onHover(null)}
    >
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
        <meshStandardMaterial color="#616161" emissive={selected ? HIGHLIGHT : '#000000'} emissiveIntensity={selected ? 0.7 : 0} />
      </mesh>
      {/* area klik lebih lebar dari tiang yang tipis */}
      <mesh position={[0, 1, 0]} visible={false}>
        <cylinderGeometry args={[0.25, 0.25, 2.2, 8]} />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[0.35, 0.25, 0.2]} />
        <meshStandardMaterial color="#1565C0" emissive={selected ? HIGHLIGHT : '#000000'} emissiveIntensity={selected ? 0.7 : 0} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.38, 24]} />
          <meshBasicMaterial color={HIGHLIGHT} side={THREE.DoubleSide} />
        </mesh>
      )}
      {controller.cameras.length > 0 && (
        <mesh position={[0.1, 2.13, 0.1]}>
          <boxGeometry args={[0.22, 0.14, 0.26]} />
          <meshStandardMaterial color="#212121" />
        </mesh>
      )}
    </group>
  )
}

/** Label data sensor yang melayang di atas sensornya: nama dan sampai dua parameter terbaca. */
function SensorLabel({ sensor, active, onSelect }: { sensor: SceneSensor; active: boolean; onSelect: () => void }) {
  const shown = sensor.params.slice(0, 2)
  const outOfRange = sensor.params.some((p) => {
    const st = paramState(p)
    return st === 'low' || st === 'high'
  })
  return (
    <Html position={[0, 0.5, 0]} center zIndexRange={[10, 0]}>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Sensor ${sensor.name}${sensor.info ? `: ${sensor.info}` : ', belum ada data'}${outOfRange ? ', ada nilai di luar batas peringatan' : ''}`}
        className={`flex max-w-[11rem] flex-col items-start gap-0.5 rounded-md border bg-background/90 px-2 py-1 text-left text-xs shadow-sm backdrop-blur-sm ${active ? 'border-2 border-amber-500' : ''}`}
      >
        <span className="flex w-full items-center gap-1 font-medium">
          {outOfRange && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" aria-hidden="true" />}
          <span className="truncate">{sensor.name}</span>
        </span>
        {shown.length === 0 ? (
          <span className="text-muted-foreground">belum ada data</span>
        ) : (
          shown.map((p) => (
            <span key={p.ds_id} className="w-full truncate tabular-nums text-muted-foreground" title={`${p.name}: ${p.value === null ? 'belum ada data' : formatNumber(p.value)}`}>
              {p.name} <span className="font-medium text-foreground">{p.value === null ? '-' : formatNumber(p.value)}</span>
            </span>
          ))
        )}
      </button>
    </Html>
  )
}

/** Panel status hara di atas model: status N (BWD pada tanggal slider) dan defisit N, P₂O₅, K₂O dari model. */
function NutrientHud({ status, bwd, bwdMin, nutrients }: { status: keyof typeof N_STATUS; bwd: number | null; bwdMin: number | null; nutrients: PlantTwin['nutrients'] }) {
  const [open, setOpen] = useState(true)
  const meta = N_STATUS[status]
  const rows = [
    { label: 'N', value: nutrients.n_def, unit: 'kg N/ha' },
    { label: 'P₂O₅', value: nutrients.p2o5_def, unit: 'kg/ha' },
    { label: 'K₂O', value: nutrients.k2o_def, unit: 'kg/ha' },
  ]
  return (
    <div className="rounded-md border bg-background/90 text-xs shadow backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="twin-hud-nutrient"
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-1.5 font-medium"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ backgroundColor: meta.color }} aria-hidden="true" />
          Status hara · N {meta.label}
        </span>
        {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <div id="twin-hud-nutrient" className="space-y-1.5 border-t px-3 py-2">
          <p className="tabular-nums text-muted-foreground">
            BWD {bwd !== null ? String(bwd).replace('.', ',') : '-'}
            {bwdMin !== null ? ` · batas fase ${bwdMin}` : ' · fase tanpa batas BWD'}
          </p>
          <ul aria-label="Defisit hara dari model" className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3">
                <span className="font-medium">{r.label}</span>
                {r.value === null ? (
                  <span className="text-muted-foreground">belum dihitung</span>
                ) : r.value > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-destructive">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    kurang {formatNumber(r.value)} {r.unit}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    cukup
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ParamRow({ p }: { p: SensorParam }) {
  const st = paramState(p)
  const bad = st === 'low' || st === 'high'
  const title = `${p.name}: ${p.value === null ? 'belum ada data' : formatNumber(p.value)}${p.read_at ? ` · dibaca ${formatDateTime(p.read_at)}` : ''}`
  return (
    <li className="flex items-center justify-between gap-2" title={title}>
      <span className="truncate text-muted-foreground">{p.name}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 font-medium tabular-nums ${bad ? 'text-destructive' : ''}`}>
        {bad && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
        {p.value === null ? '-' : formatNumber(p.value)}
        {bad && <span className="sr-only">{st === 'low' ? 'di bawah batas peringatan' : 'di atas batas peringatan'}</span>}
      </span>
    </li>
  )
}

/** Panel Perangkat & sensor di atas model: keterangan lengkap tiap pengendali dan sensornya, juga yang belum punya koordinat. */
function DeviceHud({ devices, selected, onSelect }: { devices: DeviceSummary[]; selected: SceneSelection | null; onSelect: (s: SceneSelection) => void }) {
  const [open, setOpen] = useState(true)
  const sensorCount = devices.reduce((n, d) => n + d.sensors.length, 0)
  const isSel = (kind: SceneSelection['kind'], id: string) => selected?.kind === kind && selected.id === id
  return (
    <div className="rounded-md border bg-background/90 text-xs shadow backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="twin-hud-devices"
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-1.5 font-medium"
      >
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Perangkat &amp; sensor · {devices.length} perangkat, {sensorCount} sensor
        </span>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />}
      </button>
      {open && (
        <div id="twin-hud-devices" className="max-h-48 space-y-3 overflow-y-auto border-t px-3 py-2">
          {devices.length === 0 ? (
            <p className="text-muted-foreground">Belum ada perangkat di cluster petak ini.</p>
          ) : (
            devices.map(({ controller: c, sensors, loose }) => (
              <section key={c.dev_id} aria-label={`Perangkat ${c.name}`} className="space-y-1">
                <button
                  type="button"
                  onClick={() => onSelect({ kind: 'controller', id: c.dev_id })}
                  aria-pressed={isSel('controller', c.dev_id)}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded px-1 text-left font-semibold ${isSel('controller', c.dev_id) ? 'bg-amber-500/20' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="shrink-0 font-normal text-muted-foreground">{c.status === 1 ? 'Aktif' : c.status === null ? '-' : 'Nonaktif'}</span>
                </button>
                {c.cameras.length > 0 && <p className="px-1 text-muted-foreground">Kamera: {c.cameras.join(', ')}</p>}
                {sensors.length === 0 && loose.length === 0 && <p className="px-1 text-muted-foreground">Belum ada sensor pada perangkat ini.</p>}
                {sensors.map((s) => (
                  <div key={s.sens_id} className="pl-3">
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: 'sensor', id: s.sens_id })}
                      aria-pressed={isSel('sensor', s.sens_id)}
                      className={`flex min-h-11 w-full items-center gap-1.5 rounded px-1 text-left font-medium ${isSel('sensor', s.sens_id) ? 'bg-amber-500/20' : ''}`}
                    >
                      <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{s.name}</span>
                      {s.type && <span className="shrink-0 font-normal text-muted-foreground">· {s.type}</span>}
                    </button>
                    {s.params.length === 0 ? (
                      <p className="px-1 text-muted-foreground">belum ada parameter terhubung</p>
                    ) : (
                      <ul className="space-y-0.5 px-1" aria-label={`Parameter ${s.name}`}>
                        {s.params.map((p) => (
                          <ParamRow key={p.ds_id} p={p} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {loose.length > 0 && (
                  <div className="pl-3">
                    <p className="px-1 font-medium">Parameter lain</p>
                    <ul className="space-y-0.5 px-1" aria-label={`Parameter lain ${c.name}`}>
                      {loose.map((p) => (
                        <ParamRow key={p.ds_id} p={p} />
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** Peta lon/lat ke koordinat cuplikan [-HALF, HALF] berdasarkan kotak batas polygon petak. */
function mapToPlot(geom: GeoJsonPolygon | null, lon: number, lat: number): [number, number] | null {
  const ring = ringOf(geom)
  if (!ring) return null
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  if (x1 === x0 || y1 === y0) return null
  const tx = Math.max(0, Math.min(1, (lon - x0) / (x1 - x0)))
  const ty = Math.max(0, Math.min(1, (lat - y0) / (y1 - y0)))
  return [-HALF + tx * HALF * 2, HALF - ty * HALF * 2]
}

const HILLS = hillPositions()
/** Titik sampel BWD: diagonal cuplikan, 30 cm dari tepi. */
const SAMPLES = Array.from({ length: 20 }, (_, i): [number, number] => {
  const v = -HALF + 0.3 + ((HALF * 2 - 0.6) * (i + 0.5)) / 20
  return [v, v]
})

/** Model 3D cuplikan petak: rumpun jajar legowo, air sawah, pengendali (dengan kamera), sensor, titik sampel, pin foto. */
export default function Plot3D(props: Plot3DProps) {
  const { heightCm, tillers, bwd, bwdMin, mode, phaseSeq, geom, media, selectedMediaId, controllers, sensors, parameters, nutrients, selected, onSelectDevice, onSelectMedia, label } = props
  const [showLabels, setShowLabels] = useState(true)
  const devices = useMemo(() => deviceSummaries(controllers, parameters), [controllers, parameters])
  const [hoverState, setHoverState] = useState<{ label: string; clickable: boolean } | null>(null)
  const hover = hoverState?.label ?? null
  const setHover = (label: string | null, clickable = false) => setHoverState(label ? { label, clickable } : null)
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null)

  const status = nStatus(bwd, bwdMin)
  const leaf = mode === 'nitrogen' ? N_STATUS[status].color : leafColor(bwd)
  const flowering = (phaseSeq ?? 0) >= 7

  const pins = useMemo(
    () =>
      media
        .filter((m) => m.lon !== null && m.lat !== null)
        .map((m) => ({ m, xz: mapToPlot(geom, m.lon as number, m.lat as number) }))
        .filter((p): p is { m: TwinMedia; xz: [number, number] } => !!p.xz),
    [media, geom],
  )

  // pengendali di koordinatnya bila ada dan bisa dipetakan; selain itu berjajar di sudut cuplikan
  const kits = useMemo(
    () =>
      controllers.map((c, i) => ({
        c,
        xz: (c.lon !== null && c.lat !== null ? mapToPlot(geom, c.lon, c.lat) : null) ?? ([-HALF - 0.4 + i * 0.7, -HALF - 0.4] as [number, number]),
      })),
    [controllers, geom],
  )
  const sensorSpots = useMemo(
    () => sensors.map((s) => ({ s, xz: mapToPlot(geom, s.lon, s.lat) })).filter((p): p is { s: SceneSensor; xz: [number, number] } => !!p.xz),
    [sensors, geom],
  )

  return (
    <figure className="space-y-2">
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-gradient-to-b from-sky-100 to-sky-50 dark:from-slate-800 dark:to-slate-900 ${hoverState?.clickable ? 'cursor-pointer' : ''}`}
      >
        <Canvas
          onPointerMissed={() => onSelectDevice(null)}
          dpr={[1, 2]}
          camera={{ position: [5.5, 4.2, 6.5], fov: 45, near: 0.1, far: 80 }}
          role="img"
          aria-label={label}
          gl={{ antialias: true, powerPreference: 'default' }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 9, 4]} intensity={1.1} />

          {/* tanah dan air sawah */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[HALF * 2 + 1.6, HALF * 2 + 1.6]} />
            <meshStandardMaterial color="#6D4C41" roughness={1} />
          </mesh>
          {hasWater(phaseSeq) && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <planeGeometry args={[HALF * 2 + 1.6, HALF * 2 + 1.6]} />
              <meshStandardMaterial color="#4FC3F7" transparent opacity={0.45} roughness={0.2} metalness={0.1} depthWrite={false} />
            </mesh>
          )}

          <Blades hills={HILLS} heightCm={heightCm} tillers={tillers} color={leaf} />
          {flowering && <Panicles hills={HILLS} heightCm={heightCm} color={grainColor(phaseSeq)} />}

          {kits.map(({ c, xz }) => (
            <StationKit
              key={c.dev_id}
              controller={c}
              position={xz}
              selected={selected?.kind === 'controller' && selected.id === c.dev_id}
              onHover={setHover}
              onSelect={() => onSelectDevice({ kind: 'controller', id: c.dev_id })}
            />
          ))}

          {sensorSpots.map(({ s, xz }) => {
            const active = selected?.kind === 'sensor' && selected.id === s.sens_id
            return (
              <group
                key={s.sens_id}
                position={[xz[0], 0, xz[1]]}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectDevice({ kind: 'sensor', id: s.sens_id })
                }}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  setHover(`Sensor ${s.name}${s.info ? ` — ${s.info}` : ''} (klik untuk info)`, true)
                }}
                onPointerOut={() => setHover(null)}
              >
                <mesh position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.24, 12]} />
                  <meshStandardMaterial color="#8E24AA" emissive={active ? HIGHLIGHT : '#000000'} emissiveIntensity={active ? 0.7 : 0} />
                </mesh>
                {/* area klik lebih besar dari silinder kecil */}
                <mesh position={[0, 0.15, 0]} visible={false}>
                  <sphereGeometry args={[0.25, 8, 8]} />
                </mesh>
                {active && (
                  <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.14, 0.2, 24]} />
                    <meshBasicMaterial color={HIGHLIGHT} side={THREE.DoubleSide} />
                  </mesh>
                )}
                {showLabels && <SensorLabel sensor={s} active={active} onSelect={() => onSelectDevice({ kind: 'sensor', id: s.sens_id })} />}
              </group>
            )
          })}

          {SAMPLES.map(([x, z], i) => (
            <mesh key={i} position={[x, 0.06, z]} onPointerOver={() => setHover(`Titik sampel BWD ${i + 1}`)} onPointerOut={() => setHover(null)}>
              <sphereGeometry args={[0.06, 10, 10]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          ))}

          {pins.map(({ m, xz }) => {
            const active = m.media_id === selectedMediaId
            return (
              <group
                key={m.media_id}
                position={[xz[0], 0, xz[1]]}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectMedia(m.media_id)
                }}
                onPointerOver={() => setHover(`Foto ${m.date ? m.date.slice(0, 10) : ''}${m.description ? `: ${m.description}` : ''}`)}
                onPointerOut={() => setHover(null)}
              >
                <mesh position={[0, 0.35, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.09, 0.3, 12]} />
                  <meshStandardMaterial color={active ? PIN_COLOR_ACTIVE : PIN_COLOR} />
                </mesh>
                <mesh position={[0, 0.55, 0]}>
                  <sphereGeometry args={[0.1, 12, 12]} />
                  <meshStandardMaterial color={active ? PIN_COLOR_ACTIVE : PIN_COLOR} />
                </mesh>
              </group>
            )
          })}

          <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={3} maxDistance={16} maxPolarAngle={Math.PI / 2.05} target={[0, 0.4, 0]} />
        </Canvas>

        {hover && (
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-background/90 px-2 py-1 text-xs shadow" role="status">
            {hover}
          </div>
        )}
        <div className="absolute bottom-3 left-3 z-20 flex max-h-[calc(100%-4.5rem)] max-w-[min(18rem,calc(100%-9rem))] flex-col gap-2 overflow-y-auto">
          <DeviceHud devices={devices} selected={selected} onSelect={onSelectDevice} />
          <NutrientHud status={status} bwd={bwd} bwdMin={bwdMin} nutrients={nutrients} />
        </div>
        {sensorSpots.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={showLabels}
            className="absolute right-3 top-3 z-20 bg-background/90"
            onClick={() => setShowLabels((v) => !v)}
          >
            <Tag className="mr-2 h-4 w-4" aria-hidden="true" />
            Label sensor
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="absolute bottom-3 right-3 z-20 bg-background/90"
          onClick={() => controls.current?.reset?.()}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Reset tampilan
        </Button>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        Cuplikan 6 × 6 m, jajar legowo 2:1; bukan skala petak. Geser untuk memutar, gulir untuk memperbesar. Tinggi {Math.round(heightCm)} cm, {Math.round(tillers)} anakan per rumpun.
        {hasWater(phaseSeq) ? ' Sawah tergenang.' : ' Sawah sudah dikeringkan.'}
      </figcaption>
    </figure>
  )
}
