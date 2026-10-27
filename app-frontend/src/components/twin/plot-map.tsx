'use client'

import { useMemo } from 'react'
import {
  N_STATUS,
  leafColor,
  nStatus,
  projectPolygons,
  ringOf,
  type NStatus,
  type SitePlant,
  type TwinMedia,
} from '@/lib/twin'

export type ColorMode = 'visual' | 'nitrogen'

interface PlotMapProps {
  plants: SitePlant[]
  selectedId: string
  mode: ColorMode
  /** warna fase tanaman terpilih pada tanggal slider */
  phaseColor: string | null
  /** BWD pada tanggal slider dan batas fase, untuk warna daun / status N */
  bwd: number | null
  bwdMin: number | null
  media: TwinMedia[]
  selectedMediaId: string | null
  onSelectPlant: (plantId: string) => void
  onSelectMedia: (mediaId: string) => void
}

const SIZE = 400
const SAMPLE_POINTS = 20

function inside(point: [number, number], ring: [number, number][]): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Peta 2D petak: poligon berwarna fase / status N, titik sampel diagonal, dan pin foto bergeotag. */
export function PlotMap({ plants, selectedId, mode, phaseColor, bwd, bwdMin, media, selectedMediaId, onSelectPlant, onSelectMedia }: PlotMapProps) {
  const status: NStatus = nStatus(bwd, bwdMin)

  const projection = useMemo(() => {
    const rings = plants
      .map((p) => ({ id: p.plant_id, ring: ringOf(p.geom) }))
      .filter((r): r is { id: string; ring: number[][] } => !!r.ring)
    return rings.length ? projectPolygons(rings, SIZE) : null
  }, [plants])

  const selected = plants.find((p) => p.plant_id === selectedId)
  const selectedRing = selected ? ringOf(selected.geom) : null

  const samples = useMemo(() => {
    if (!projection || !selectedRing) return []
    const ring = selectedRing.map((p) => projection.project(p))
    const xs = ring.map((p) => p[0])
    const ys = ring.map((p) => p[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    // diagonal pattern, keep only the points that fall inside the plot
    const pts: [number, number][] = []
    for (let i = 0; i < SAMPLE_POINTS; i++) {
      const t = (i + 0.5) / SAMPLE_POINTS
      const p: [number, number] = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
      if (inside(p, ring)) pts.push(p)
    }
    return pts
  }, [projection, selectedRing])

  const fillFor = (id: string, p: SitePlant): string => {
    if (id === selectedId) return mode === 'nitrogen' ? N_STATUS[status].color : leafColor(bwd) === '#9CCC65' ? phaseColor ?? '#9CCC65' : leafColor(bwd)
    return p.phase?.color ?? '#BDBDBD'
  }

  const pins = useMemo(() => {
    if (!projection) return []
    return media
      .filter((m) => m.lon !== null && m.lat !== null)
      .map((m) => ({ m, xy: projection.project([m.lon as number, m.lat as number]) }))
  }, [projection, media])

  const label = selected
    ? `Peta petak ${selected.name ?? selected.plant_id}${mode === 'nitrogen' ? `, status N ${N_STATUS[status].label}` : ''}`
    : 'Peta petak'

  if (!projection) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center">
        <div className="h-16 w-16 rounded-md border" style={{ backgroundColor: phaseColor ?? '#BDBDBD' }} aria-hidden="true" />
        <p className="font-medium">{selected?.name ?? 'Petak'}</p>
        <p className="text-sm text-muted-foreground">Batas petak belum digambar, jadi peta tidak dapat ditampilkan.</p>
      </div>
    )
  }

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={label}
        className="mx-auto aspect-square w-full max-w-[520px] rounded-lg border bg-muted/30"
      >
        {projection.shapes.map((s) => {
          const p = plants.find((x) => x.plant_id === s.id)!
          const active = s.id === selectedId
          return (
            <polygon
              key={s.id}
              points={s.points}
              fill={fillFor(s.id, p)}
              fillOpacity={active ? 0.9 : 0.55}
              stroke={active ? 'currentColor' : '#616161'}
              strokeWidth={active ? 3 : 1}
              className="cursor-pointer text-foreground outline-none focus-visible:stroke-[4px]"
              tabIndex={0}
              role="button"
              aria-label={`${p.name ?? p.plant_id}${p.phase ? `, fase ${p.phase.name}` : ''}${active ? ', terpilih' : ''}`}
              aria-pressed={active}
              onClick={() => onSelectPlant(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectPlant(s.id)
                }
              }}
            >
              <title>{`${p.name ?? p.plant_id}${p.phase ? ` · ${p.phase.name}` : ''}`}</title>
            </polygon>
          )
        })}

        {samples.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#fff" stroke="#212121" strokeWidth={1}>
            <title>{`Titik sampel BWD ${i + 1}`}</title>
          </circle>
        ))}

        {pins.map(({ m, xy }) => {
          const active = m.media_id === selectedMediaId
          return (
            <g
              key={m.media_id}
              transform={`translate(${xy[0]} ${xy[1]})`}
              role="button"
              tabIndex={0}
              aria-label={`Foto ${m.date ? m.date.slice(0, 10) : ''}${m.description ? `, ${m.description}` : ''}`}
              className="cursor-pointer outline-none focus-visible:[&>path]:stroke-[3px]"
              onClick={() => onSelectMedia(m.media_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectMedia(m.media_id)
                }
              }}
            >
              <path d="M0 0 C-7 -9 -7 -17 0 -17 C7 -17 7 -9 0 0Z" fill={active ? '#C62828' : '#1565C0'} stroke="#fff" strokeWidth={1.5} />
              <circle cy={-11} r={2.5} fill="#fff" />
              <title>{`Foto ${m.date ? m.date.slice(0, 10) : ''}`}</title>
            </g>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {mode === 'nitrogen' ? (
          (Object.keys(N_STATUS) as NStatus[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: N_STATUS[k].color }} aria-hidden="true" />
              {N_STATUS[k].label}
            </span>
          ))
        ) : (
          <span>Warna petak terpilih mengikuti BWD terakhir; petak lain mengikuti fase.</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-foreground bg-white" aria-hidden="true" />
          Titik sampel BWD
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#1565C0' }} aria-hidden="true" />
          Lokasi foto
        </span>
      </figcaption>
    </figure>
  )
}
