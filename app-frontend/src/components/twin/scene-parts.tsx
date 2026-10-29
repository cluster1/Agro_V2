'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { SceneController } from '@/lib/twin'

export const HIGHLIGHT = '#FFC107'

/** Cuplikan petak: 6 x 6 m, jajar legowo 2:1 (25 x 12,5 x 50 cm). */
export const HALF = 3
const SPACING_X = 0.25
const PAIR_GAP = 0.125
const BAND = 0.625
const MAX_HILLS_RENDERED = 700
const MAX_LEAVES_PER_HILL = 14
const LEAF_BENDS = [0.55, 0.9, 1.25]

/** Lebar pematang tanah di sekeliling petak; pengendali berdiri di tengahnya. */
export const BUND = 0.2
const BUND_H = 0.16
const SLAB_H = 0.35
/** Jarak pusat pematang dari tengah petak. */
export const BUND_CENTER = HALF + BUND / 2

/** Pseudo-acak deterministik agar rumpun tidak "berkedip" saat render ulang. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function hillPositions(): [number, number][] {
  const out: [number, number][] = []
  for (let z = -HALF + 0.1; z < HALF - 0.1; z += BAND) {
    for (const dz of [0, PAIR_GAP]) {
      for (let x = -HALF + 0.1; x < HALF - 0.1; x += SPACING_X) out.push([x, z + dz])
    }
  }
  return out.length > MAX_HILLS_RENDERED ? out.filter((_, i) => i % Math.ceil(out.length / MAX_HILLS_RENDERED) === 0) : out
}

/** Alas tanah, pematang di keempat sisi, lumpur di dalamnya, dan air biru di tengah sawah bila tergenang. */
export function FieldBase({ flooded }: { flooded: boolean }) {
  const outer = HALF * 2 + BUND * 2
  const soil = '#8D6E4F'
  return (
    <group>
      <mesh position={[0, -SLAB_H / 2, 0]} receiveShadow>
        <boxGeometry args={[outer, SLAB_H, outer]} />
        <meshStandardMaterial color="#6D4C41" roughness={1} />
      </mesh>
      {/* pematang utara-selatan (penuh) dan timur-barat (di antaranya) */}
      {[-1, 1].map((s) => (
        <mesh key={`ns${s}`} position={[0, BUND_H / 2, s * BUND_CENTER]} castShadow receiveShadow>
          <boxGeometry args={[outer, BUND_H, BUND]} />
          <meshStandardMaterial color={soil} roughness={1} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`ew${s}`} position={[s * BUND_CENTER, BUND_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[BUND, BUND_H, HALF * 2]} />
          <meshStandardMaterial color={soil} roughness={1} />
        </mesh>
      ))}
      {/* lumpur dasar sawah */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
        <meshStandardMaterial color="#4A342A" roughness={1} />
      </mesh>
      {flooded && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
          <planeGeometry args={[HALF * 2, HALF * 2]} />
          <meshStandardMaterial color="#2E86C9" transparent opacity={0.78} roughness={0.15} metalness={0.05} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Helai daun: pita yang menyempit ke ujung, melengkung keluar dan merunduk, dengan lipatan di tulang daun.
 * Tinggi satuan; warna vertex dari gelap di pangkal ke terang di ujung.
 */
function leafGeometry(bend: number): THREE.BufferGeometry {
  const rows = 6
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const phi = bend * t
    const y = Math.sin(bend * t) / bend
    const z = (1 - Math.cos(bend * t)) / bend
    const half = 0.0075 * (1 - 0.9 * t)
    // normal di bidang YZ untuk melipat bagian tengah (tulang daun)
    const ny = -Math.sin(phi)
    const nz = Math.cos(phi)
    const fold = 0.4 * half
    const shade = 0.5 + 0.5 * t
    pos.push(-half, y, z, 0, y + ny * fold, z + nz * fold, half, y, z)
    for (let k = 0; k < 3; k++) col.push(shade, shade, shade)
  }
  for (let r = 0; r < rows; r++) {
    const a = r * 3
    const b = (r + 1) * 3
    idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

interface CanopyProps {
  hills: [number, number][]
  heightCm: number
  tillers: number
  /** warna daun (BWD atau status N) */
  color: string
  flowering: boolean
  grainColor: string
}

/** Tajuk padi: helai daun melengkung (tiga tingkat lengkung) dan, mulai berbunga, malai yang merunduk. */
export function RiceCanopy({ hills, heightCm, tillers, color, flowering, grainColor }: CanopyProps) {
  const leafRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const panicleRef = useRef<THREE.InstancedMesh>(null)
  const geometries = useMemo(() => LEAF_BENDS.map(leafGeometry), [])
  const panicleGeometry = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.014, 0.18, 3, 8)
    g.translate(0, 0.1, 0)
    return g
  }, [])

  const height = Math.max(0.03, heightCm / 100)
  const perHill = Math.max(1, Math.min(MAX_LEAVES_PER_HILL, Math.round(tillers * 1.6)))
  const total = hills.length * perHill
  const capacity = Math.max(1, Math.ceil(total / LEAF_BENDS.length))
  const perHillPanicles = tillers >= 8 ? 2 : 1

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    const rand = rng(42)
    const base = new THREE.Color(color)
    const tmp = new THREE.Color()
    const counters = LEAF_BEND_COUNTERS()
    let n = 0
    for (const [x, z] of hills) {
      for (let b = 0; b < perHill; b++) {
        const v = n++ % LEAF_BENDS.length
        const mesh = leafRefs.current[v]
        const i = counters[v]
        if (!mesh || i >= capacity) continue
        counters[v] = i + 1
        // panjang helai agar puncak tajuk kira-kira setinggi data, dengan variasi antar helai
        const len = (height / 0.8) * (0.7 + rand() * 0.4)
        dummy.position.set(x + (rand() - 0.5) * 0.06, 0.03, z + (rand() - 0.5) * 0.06)
        dummy.rotation.set(0, rand() * Math.PI * 2, 0)
        dummy.scale.set(len, len, len)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, tmp.copy(base).offsetHSL(0, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.1))
      }
    }
    leafRefs.current.forEach((mesh, v) => {
      if (!mesh) return
      mesh.count = counters[v]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  }, [hills, perHill, height, capacity, color])

  useLayoutEffect(() => {
    const mesh = panicleRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const rand = rng(7)
    const base = new THREE.Color(grainColor)
    const tmp = new THREE.Color()
    let i = 0
    for (const [x, z] of hills) {
      for (let p = 0; p < perHillPanicles; p++) {
        dummy.position.set(x + (rand() - 0.5) * 0.08, height * 0.88, z + (rand() - 0.5) * 0.08)
        // merunduk keluar dari tegak lurus: yaw acak lalu miring ke depan
        dummy.rotation.set(0.9 + rand() * 0.6, rand() * Math.PI * 2, 0, 'YXZ')
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, tmp.copy(base).offsetHSL(0, 0, (rand() - 0.5) * 0.08))
        i++
      }
    }
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [hills, height, perHillPanicles, grainColor, flowering])

  return (
    <group>
      {geometries.map((g, v) => (
        <instancedMesh
          key={v}
          ref={(m) => {
            leafRefs.current[v] = m
          }}
          args={[g, undefined, capacity]}
          frustumCulled={false}
        >
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.65} />
        </instancedMesh>
      ))}
      {flowering && (
        <instancedMesh ref={panicleRef} args={[panicleGeometry, undefined, Math.max(1, hills.length * 2)]} frustumCulled={false}>
          <meshStandardMaterial roughness={0.7} />
        </instancedMesh>
      )}
    </group>
  )
}

const LEAF_BEND_COUNTERS = (): number[] => LEAF_BENDS.map(() => 0)

interface StationKitProps {
  controller: SceneController
  position: [number, number]
  selected: boolean
  onHover: (label: string | null, clickable?: boolean) => void
  onSelect: () => void
}

/**
 * Station Kit seperti foto lapangan: tiang hitam, panel surya miring di puncak, kotak panel krem berpintu,
 * unit putih kecil berlensa ganda di sisi tiang, dan dasar berupa gundukan tanah, balok bata, dan dudukan baja.
 * Skala sungguhan (sekitar 2,9 m); menghadap +z.
 */
export function StationKitModel({ controller, position, selected, onHover, onSelect }: StationKitProps) {
  const label = `Station Kit ${controller.name}${controller.cameras.length ? ` · kamera: ${controller.cameras.join(', ')}` : ''} (klik untuk menyorot)`
  const glow = selected ? HIGHLIGHT : '#000000'
  const glowI = selected ? 0.6 : 0
  return (
    <group
      position={[position[0], BUND_H, position[1]]}
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
      {/* dasar: gundukan tanah, balok bata, dudukan baja */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.06, 16]} />
        <meshStandardMaterial color="#5D4037" roughness={1} />
      </mesh>
      <mesh position={[0.17, 0.11, 0.08]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.22, 0.1, 0.14]} />
        <meshStandardMaterial color="#A1887F" roughness={0.95} />
      </mesh>
      <mesh position={[-0.17, 0.09, 0.04]} rotation={[0, -0.3, 0]} castShadow>
        <boxGeometry args={[0.28, 0.06, 0.08]} />
        <meshStandardMaterial color="#263238" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* tiang hitam */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 2.8, 12]} />
        <meshStandardMaterial color="#1B1B1D" roughness={0.45} metalness={0.5} emissive={glow} emissiveIntensity={glowI} />
      </mesh>

      {/* panel surya miring di puncak */}
      <group position={[0, 2.86, 0]} rotation={[0.35, 0, 0]}>
        <mesh position={[0, -0.08, -0.04]} castShadow>
          <boxGeometry args={[0.1, 0.16, 0.05]} />
          <meshStandardMaterial color="#37474F" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.035, 0.6]} />
          <meshStandardMaterial color="#CFD8DC" roughness={0.5} metalness={0.4} emissive={glow} emissiveIntensity={glowI} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.85, 0.012, 0.55]} />
          <meshStandardMaterial color="#1F2F5C" roughness={0.3} metalness={0.3} />
        </mesh>
      </group>

      {/* unit putih kecil berlensa ganda di sisi tiang */}
      <group position={[0.105, 2.42, 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.17, 0.1]} />
          <meshStandardMaterial color="#F5F5F5" roughness={0.5} />
        </mesh>
        {[0.035, -0.035].map((dy) => (
          <mesh key={dy} position={[0, dy, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
            <meshStandardMaterial color="#263238" roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* kotak panel krem berpintu */}
      <group position={[0, 1.75, 0.145]}>
        <mesh castShadow>
          <boxGeometry args={[0.43, 0.5, 0.2]} />
          <meshStandardMaterial color="#E8E2C9" roughness={0.7} emissive={glow} emissiveIntensity={glowI} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.45, 0.02, 0.22]} />
          <meshStandardMaterial color="#D7D0B6" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.107]}>
          <boxGeometry args={[0.37, 0.44, 0.015]} />
          <meshStandardMaterial color="#EFEAD4" roughness={0.7} />
        </mesh>
        <mesh position={[-0.12, 0, 0.13]}>
          <boxGeometry args={[0.02, 0.07, 0.02]} />
          <meshStandardMaterial color="#9E9E9E" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* area klik lebih lebar dari tiang yang tipis */}
      <mesh position={[0, 1.5, 0.1]} visible={false}>
        <cylinderGeometry args={[0.35, 0.35, 3, 8]} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 28]} />
          <meshBasicMaterial color={HIGHLIGHT} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
