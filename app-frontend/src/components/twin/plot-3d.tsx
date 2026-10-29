'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { N_STATUS, PIN_COLOR, PIN_COLOR_ACTIVE, grainColor, hasWater, leafColor, nStatus, ringOf, type GeoJsonPolygon, type TwinMedia } from '@/lib/twin'
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
  sensors: { ds_id: string; dev_id: string; name: string; value: number | null }[]
  onSelectMedia: (id: string) => void
  label: string
}

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

function StationKit({ onHover }: { onHover: (label: string | null) => void }) {
  return (
    <group position={[-HALF - 0.4, 0, -HALF - 0.4]} onPointerOver={() => onHover('Station Kit')} onPointerOut={() => onHover(null)}>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[0.35, 0.25, 0.2]} />
        <meshStandardMaterial color="#1565C0" />
      </mesh>
    </group>
  )
}

function Camera({ onHover }: { onHover: (label: string | null) => void }) {
  return (
    <group position={[HALF + 0.4, 0, -HALF - 0.4]} onPointerOver={() => onHover('Kamera CCTV')} onPointerOut={() => onHover(null)}>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[0.25, 0.18, 0.3]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* area pandang */}
      <mesh position={[-1.9, 1.2, 1.9]} rotation={[0.5, -0.78, 0]}>
        <coneGeometry args={[1.6, 3.6, 4, 1, true]} />
        <meshBasicMaterial color="#42A5F5" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
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

/** Model 3D cuplikan petak: rumpun jajar legowo, air sawah, Station Kit, kamera, sensor, titik sampel, pin foto. */
export default function Plot3D(props: Plot3DProps) {
  const { heightCm, tillers, bwd, bwdMin, mode, phaseSeq, geom, media, selectedMediaId, sensors, onSelectMedia, label } = props
  const [hover, setHover] = useState<string | null>(null)
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

  return (
    <figure className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-gradient-to-b from-sky-100 to-sky-50 dark:from-slate-800 dark:to-slate-900">
        <Canvas
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

          <StationKit onHover={setHover} />
          <Camera onHover={setHover} />

          {sensors.slice(0, 6).map((s, i) => (
            <mesh
              key={`${s.dev_id}-${s.ds_id}`}
              position={[-HALF + 0.5 + i * 0.9, 0.12, HALF + 0.35]}
              onPointerOver={() => setHover(`Sensor ${s.name}${s.value !== null ? `: ${s.value}` : ''}`)}
              onPointerOut={() => setHover(null)}
            >
              <cylinderGeometry args={[0.07, 0.07, 0.24, 12]} />
              <meshStandardMaterial color="#8E24AA" />
            </mesh>
          ))}

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
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="absolute bottom-3 right-3 bg-background/90"
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
