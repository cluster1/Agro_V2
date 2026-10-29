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
import { BUND_CENTER, FieldBase, HALF, HIGHLIGHT, RiceCanopy, StationKitModel, hillPositions } from '@/components/twin/scene-parts'

/** Perintah kamera untuk toolbar di luar kanvas (diisi Plot3D lewat prop `api`). */
export interface Plot3DApi {
  zoomIn: () => void
  zoomOut: () => void
  /** 1 atau -1: putar seperempat putaran mendatar */
  rotate: (dir: 1 | -1) => void
  reset: () => void
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
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
  /** piksel kanvas yang tertutup panel mengambang; model dipasang di area bebas sisanya */
  insets: Insets
  /** diisi dengan perintah kamera; ref dipakai karena next/dynamic tidak meneruskan `ref` */
  api: React.MutableRefObject<Plot3DApi | null>
  /** pengendali atau sensor yang diklik; disorot di model */
  selected: SceneSelection | null
  onSelectDevice: (selection: SceneSelection | null) => void
  onSelectMedia: (id: string) => void
  label: string
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

/** Pengendali berdiri di pematang, bukan di tengah sawah: titik di dalam petak digeser ke pematang terdekat. */
function onBund([x, z]: [number, number]): [number, number] {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return [x, z]
  return Math.abs(x) >= Math.abs(z) ? [(x < 0 ? -1 : 1) * BUND_CENTER, z] : [x, (z < 0 ? -1 : 1) * BUND_CENTER]
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

/** Luas cuplikan di layar pada zoom 1 (satuan dunia): lebar diagonal petak + label, dan tinggi miring + tiang Station Kit 2,9 m. */
const FIT_WIDTH = 12.5
const FIT_HEIGHT = 10.3

/**
 * Zoom awal menyesuaikan ukuran kanvas dan area yang tidak tertutup panel, supaya cuplikan 6 x 6 m dan tiangnya
 * selalu muat; model digeser ke tengah area bebas. Batas zoom 0,6x sampai 3x dari zoom awal. Tombol Reset kembali ke sini.
 */
function CameraRig({ controls, insets }: { controls: React.RefObject<Controls>; insets: Insets }) {
  const { size, camera } = useThree()
  const { top, right, bottom, left } = insets
  useLayoutEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const freeW = Math.max(160, size.width - left - right)
    const freeH = Math.max(160, size.height - top - bottom)
    const base = Math.max(12, Math.min(freeW / FIT_WIDTH, freeH / FIT_HEIGHT))
    cam.zoom = base
    if (left || right || top || bottom) cam.setViewOffset(size.width, size.height, (right - left) / 2, (bottom - top) / 2, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
    const c = controls.current
    if (c) {
      c.minZoom = base * 0.6
      c.maxZoom = base * 3
      c.saveState()
      c.update()
    }
  }, [size.width, size.height, top, right, bottom, left, camera, controls])
  return null
}

/** Model 3D cuplikan petak: rumpun jajar legowo, air sawah, pengendali (dengan kamera), sensor, titik sampel, pin foto. */
export default function Plot3D(props: Plot3DProps) {
  const { heightCm, tillers, bwd, bwdMin, mode, phaseSeq, geom, media, selectedMediaId, controllers, sensors, showLabels, insets, api, selected, onSelectDevice, onSelectMedia, label } = props
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
        xz: onBund(
          (c.lon !== null && c.lat !== null ? mapToPlot(geom, c.lon, c.lat) : null) ?? ([-HALF - 0.4 + i * 0.7, -HALF - 0.4] as [number, number]),
        ),
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
        shadows
        onPointerMissed={() => onSelectDevice(null)}
        dpr={[1, 2]}
        camera={{ position: [8, 8, 8], zoom: 40, near: -100, far: 200 }}
        role="img"
        aria-label={label}
        gl={{ antialias: true, powerPreference: 'default' }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[6, 9, 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
          shadow-camera-near={0.5}
          shadow-camera-far={30}
          shadow-bias={-0.0005}
        />

        {/* alas tanah, pematang di tepi, lumpur dan air biru di tengah sawah */}
        <FieldBase flooded={hasWater(phaseSeq)} />

        <RiceCanopy hills={HILLS} heightCm={heightCm} tillers={tillers} color={leaf} flowering={flowering} grainColor={grainColor(phaseSeq)} />

        {kits.map(({ c, xz }) => (
          <StationKitModel
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
          <mesh key={i} position={[x, 0.13, z]} onPointerOver={() => setHover(`Titik sampel BWD ${i + 1}`)} onPointerOut={() => setHover(null)}>
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
        <CameraRig controls={controls} insets={insets} />
      </Canvas>

      {hover && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[45%] rounded bg-background/90 px-2 py-1 text-xs shadow lg:left-1/2" role="status">
          {hover}
        </div>
      )}
    </div>
  )
}
