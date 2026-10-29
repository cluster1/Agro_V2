'use client'

import { Check, Home, RotateCcw, RotateCw, Tag, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber } from '@/lib/format'
import { N_STATUS, nStatus, paramState, type PlantTwin, type TimelineEntry, type TwinPhase } from '@/lib/twin'
import type { Plot3DApi } from '@/components/twin/plot-3d'

function Kpi({ label, value, hint, dot }: { label: string; value: string; hint: string; dot?: string | null }) {
  return (
    <div className="min-w-[8.5rem] rounded-md border bg-background/90 px-3 py-2 text-xs shadow backdrop-blur-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-base font-bold tabular-nums">
        {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ backgroundColor: dot }} aria-hidden="true" />}
        <span className="truncate">{value}</span>
      </p>
      <p className="mt-0.5 text-muted-foreground tabular-nums">{hint}</p>
    </div>
  )
}

interface StageKpisProps {
  twin: PlantTwin
  age: number | null
  phase: TimelineEntry | undefined
  bwd: number | null
  isProjection: boolean
}

/** Kartu ringkasan kiri atas: fase dan HST, status N, prediksi hasil, sensor di luar batas. */
export function StageKpis({ twin, age, phase, bwd, isProjection }: StageKpisProps) {
  const phaseName = phase?.name ?? twin.now.phase?.name ?? '-'
  const phaseColor = phase?.color ?? twin.now.phase?.color ?? null
  const status = nStatus(bwd, twin.reference.bwd_min)
  const y = twin.yield
  const params = twin.sensors
  const outOfRange = params.filter((p) => {
    const st = paramState(p)
    return st === 'low' || st === 'high'
  }).length

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap" aria-label="Ringkasan petak">
      <Kpi label="Fase" value={phaseName} dot={phaseColor} hint={`${age !== null ? `HST ${age} · ` : ''}${isProjection ? 'proyeksi' : 'aktual'}`} />
      <Kpi
        label="Status N"
        value={N_STATUS[status].label}
        dot={N_STATUS[status].color}
        hint={`BWD ${bwd !== null ? String(bwd).replace('.', ',') : '-'}${twin.reference.bwd_min !== null ? ` / batas ${twin.reference.bwd_min}` : ''}`}
      />
      <Kpi
        label="Prediksi hasil"
        value={y?.value != null ? `${formatNumber(y.value)} t/ha` : '-'}
        hint={y?.low != null && y.high != null ? `${formatNumber(y.low)}-${formatNumber(y.high)}${y.harvest_date ? ` · panen ${formatDateTime(y.harvest_date, 'dd MMM')}` : ''}` : y?.harvest_date ? `panen ${formatDateTime(y.harvest_date, 'dd MMM')}` : 'belum ada simulasi'}
      />
      <Kpi label="Sensor" value={params.length ? `${outOfRange} dari ${params.length}` : '-'} hint={params.length ? 'parameter di luar batas' : 'belum ada sensor'} />
    </div>
  )
}

/** Kartu identitas petak di atas kolom panel kanan. */
export function PlotCard({ twin }: { twin: PlantTwin }) {
  return (
    <section aria-label="Petak" className="shrink-0 rounded-md border bg-background/90 p-3 text-xs shadow backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Petak</p>
      <h3 className="mt-0.5 text-base font-bold">{twin.plant.name ?? twin.plant.plant_id}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {twin.variety && <Badge variant="outline">{twin.variety.name}</Badge>}
        {twin.plant.season && <Badge variant="outline">{twin.plant.season}</Badge>}
        {twin.plant.area_ha != null && <Badge variant="outline">{formatNumber(twin.plant.area_ha)} ha</Badge>}
      </div>
    </section>
  )
}

/** Tracker fase di kiri bawah: fase yang sudah lewat, fase sekarang, dan fase berikutnya dengan tanggal mulainya. */
export function PhaseStepper({ phases, timeline, currentSeq }: { phases: TwinPhase[]; timeline: TimelineEntry[]; currentSeq: number | null }) {
  const ordered = [...phases].sort((a, b) => a.seq - b.seq)
  if (ordered.length === 0) return null
  return (
    <section aria-label="Tahap pertumbuhan" className="rounded-md border bg-background/90 px-3 py-2 text-xs shadow backdrop-blur-sm">
      <p className="mb-1.5 font-semibold">Tahap pertumbuhan</p>
      <ol className="flex gap-3 overflow-x-auto pb-1">
        {ordered.map((p) => {
          const start = timeline.find((t) => t.phase_id === p.phase_id)?.start
          const state = currentSeq === null ? 'next' : p.seq < currentSeq ? 'done' : p.seq === currentSeq ? 'now' : 'next'
          return (
            <li key={p.phase_id} className="flex w-20 shrink-0 flex-col items-center gap-1 text-center" aria-current={state === 'now' ? 'step' : undefined}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 font-semibold tabular-nums ${
                  state === 'done' ? 'border-primary bg-primary text-primary-foreground' : state === 'now' ? 'border-primary bg-background text-primary ring-2 ring-primary/30' : 'border-muted-foreground/40 text-muted-foreground'
                }`}
              >
                {state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : p.seq}
              </span>
              <span className={`leading-tight ${state === 'now' ? 'font-semibold' : ''}`}>{p.name}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{start ? formatDateTime(start, 'dd MMM') : '-'}</span>
              <span className="sr-only">{state === 'done' ? 'selesai' : state === 'now' ? 'sedang berlangsung' : 'berikutnya'}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

interface StageToolbarProps {
  api: React.MutableRefObject<Plot3DApi | null>
  showLabels: boolean
  onToggleLabels: () => void
  hasSensors: boolean
}

/** Toolbar kamera: zoom, putar seperempat putaran, reset, dan label sensor. */
export function StageToolbar({ api, showLabels, onToggleLabels, hasSensors }: StageToolbarProps) {
  const btn = 'h-11 w-11 bg-background/90 shadow'
  return (
    <div role="toolbar" aria-label="Kontrol kamera 3D" className="flex gap-2 lg:flex-col">
      <Button type="button" variant="outline" size="icon" className={btn} aria-label="Perbesar" onClick={() => api.current?.zoomIn()}>
        <ZoomIn className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="outline" size="icon" className={btn} aria-label="Perkecil" onClick={() => api.current?.zoomOut()}>
        <ZoomOut className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="outline" size="icon" className={btn} aria-label="Putar ke kiri" onClick={() => api.current?.rotate(1)}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="outline" size="icon" className={btn} aria-label="Putar ke kanan" onClick={() => api.current?.rotate(-1)}>
        <RotateCw className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="outline" size="icon" className={btn} aria-label="Reset tampilan" onClick={() => api.current?.reset()}>
        <Home className="h-4 w-4" aria-hidden="true" />
      </Button>
      {hasSensors && (
        <Button type="button" variant="outline" size="icon" className={btn} aria-label="Label sensor" aria-pressed={showLabels} onClick={onToggleLabels}>
          <Tag className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
