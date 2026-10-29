'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { AlertTriangle } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import {
  N_STATUS,
  paramState,
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

/** Perintah kamera untuk toolbar di luar kanvas (diisi Plot3D lewat prop `api`). */
export interface Plot3DApi {
  zoomIn: () => void
  zoomOut: () => void
  /** 1 atau -1: putar seperempat putaran mendatar */
  rotate: (dir: 1 | -1) => void
  reset: () => void
}

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
  /** tampilkan label data melayang di atas sensor */
  showLabels: boolean
  /** diisi dengan perintah kamera; ref dipakai karena next/dynamic tidak meneruskan `ref` */
  api: React.MutableRefObject<Plot3DApi | null>
  /** pengendali atau sensor yang diklik; disorot di model */
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

/** Sudut kamera isometrik: sekitar 54,7 derajat dari garis tegak, terkunci agar geser hanya memutar mendatar. */
const ISO_POLAR = Math.acos(1 / Math.sqrt(3))
const ZOOM_STEP = 1.25
const ROTATE_MS = 250
const UP = new THREE.Vector3(0, 1, 0)

type Controls = React.ElementRef<typeof OrbitControls>

/** Zoom awal mengikuti ukuran kanvas supaya cuplikan 6 x 6 m dan tiangnya selalu muat; batas zoom 0,6x sampai 3x. */
function CameraRig({ controls }: { controls: React.RefObject<Controls> }) {
  const { size, camera } = useThree()
  useLayoutEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const base = Math.max(12, Math.min(size.width, size.height) / 11)
    cam.zoom = base
    cam.updateProjectionMatrix()
    const c = controls.current
    if (c) {
      c.minZoom = base * 0.6
      c.maxZoom = base * 3
      c.saveState()
      c.update()
    }
  }, [size.width, size.height, camera, controls])
  return null
}

/** Model 3D cuplikan petak: rumpun jajar legowo, air sawah, pengendali (dengan kamera), sensor, titik sampel, pin foto. */
export default function Plot3D(props: Plot3DProps) {
  const { heightCm, tillers, bwd, bwdMin, mode, phaseSeq, geom, media, selectedMediaId, controllers, sensors, showLabels, api, selected, onSelectDevice, onSelectMedia, label } = props
  const [hoverState, setHoverState] = useState<{ label: string; clickable: boolean } | null>(null)
  const hover = hoverState?.label ?? null
  const setHover = (label: string | null, clickable = false) => setHoverState(label ? { label, clickable } : null)
  const controls = useRef<Controls>(null)

  // perintah kamera untuk toolbar di luar kanvas
  useEffect(() => {
    const zoomBy = (factor: number) => {
      const c = controls.current
      if (!c) return
      const cam = c.object as THREE.OrthographicCamera
      cam.zoom = Math.min(c.maxZoom, Math.max(c.minZoom, cam.zoom * factor))
      cam.updateProjectionMatrix()
      c.update()
    }
    const rotateBy = (angle: number) => {
      const c = controls.current
      if (!c) return
      const step = (delta: number) => {
        const offset = c.object.position.clone().sub(c.target).applyAxisAngle(UP, delta)
        c.object.position.copy(c.target).add(offset)
        c.update()
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return step(angle)
      const start = performance.now()
      let done = 0
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ROTATE_MS)
        const delta = angle * (1 - Math.pow(1 - t, 3)) - done
        done += delta
        step(delta)
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    api.current = {
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(1 / ZOOM_STEP),
      rotate: (dir) => rotateBy((dir * Math.PI) / 2),
      reset: () => controls.current?.reset(),
    }
    return () => {
      api.current = null
    }
  }, [api])

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
    <div
      className={`relative h-full w-full overflow-hidden bg-gradient-to-b from-sky-100 to-sky-50 dark:from-slate-800 dark:to-slate-900 ${hoverState?.clickable ? 'cursor-pointer' : ''}`}
    >
      <Canvas
        orthographic
        onPointerMissed={() => onSelectDevice(null)}
        dpr={[1, 2]}
        camera={{ position: [8, 8, 8], zoom: 40, near: -100, far: 200 }}
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
                setHover(`Sensor ${s.name}${s.info ? ` — ${s.info}` : ''} (klik untuk menyorot)`, true)
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

        <OrbitControls ref={controls} makeDefault enablePan={false} minPolarAngle={ISO_POLAR} maxPolarAngle={ISO_POLAR} target={[0, 0.4, 0]} />
        <CameraRig controls={controls} />
      </Canvas>

      {hover && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[45%] rounded bg-background/90 px-2 py-1 text-xs shadow lg:left-1/2" role="status">
          {hover}
        </div>
      )}
    </div>
  )
}
