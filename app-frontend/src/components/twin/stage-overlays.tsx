'use client'

import { Home, PanelRightClose, PanelRightOpen, RotateCcw, RotateCw, Tag, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber } from '@/lib/format'
import { N_STATUS, nStatus, paramState, type PlantTwin, type TimelineEntry } from '@/lib/twin'
import type { Plot3DApi } from '@/components/twin/plot-3d'

function Kpi({ label, value, hint, dot }: { label: string; value: string; hint: string; dot?: string | null }) {
  return (
    <div className="min-w-[7rem] rounded-md border bg-background/90 px-2.5 py-1.5 text-[11px] leading-tight shadow backdrop-blur-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold tabular-nums">
        {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ backgroundColor: dot }} aria-hidden="true" />}
        <span className="truncate">{value}</span>
      </p>
      <p className="text-muted-foreground tabular-nums">{hint}</p>
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

/** Kartu ringkasan kiri atas: tahap tumbuh dan umur, nitrogen, perkiraan hasil, sensor di luar batas. */
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
      <Kpi label="Tahap tumbuh" value={phaseName} dot={phaseColor} hint={`${age !== null ? `umur ${age} hari · ` : ''}${isProjection ? 'perkiraan' : 'kenyataan'}`} />
      <Kpi
        label="Nitrogen"
        value={N_STATUS[status].label}
        dot={N_STATUS[status].color}
        hint={`warna daun ${bwd !== null ? String(bwd).replace('.', ',') : '-'}${twin.reference.bwd_min !== null ? ` (minimal ${twin.reference.bwd_min})` : ''}`}
      />
      <Kpi
        label="Perkiraan hasil"
        value={y?.value != null ? `${formatNumber(y.value)} ton/ha` : '-'}
        hint={y?.low != null && y.high != null ? `${formatNumber(y.low)}-${formatNumber(y.high)}${y.harvest_date ? ` · panen ${formatDateTime(y.harvest_date, 'dd MMM')}` : ''}` : y?.harvest_date ? `panen ${formatDateTime(y.harvest_date, 'dd MMM')}` : 'belum dihitung'}
      />
      <Kpi label="Sensor" value={params.length ? `${outOfRange} dari ${params.length}` : '-'} hint={params.length ? 'nilai di luar batas' : 'belum ada sensor'} />
    </div>
  )
}

/** Kartu identitas petak di atas kolom panel kanan. */
export function PlotCard({ twin }: { twin: PlantTwin }) {
  return (
    <section aria-label="Petak" className="shrink-0 rounded-md border bg-background/90 px-2.5 py-2 text-[11px] shadow backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Petak</p>
      <h3 className="mt-0.5 text-sm font-bold leading-tight">{twin.plant.name ?? twin.plant.plant_id}</h3>
      <div className="mt-1 flex flex-wrap gap-1">
        {twin.variety && <Badge variant="outline">{twin.variety.name}</Badge>}
        {twin.plant.season && <Badge variant="outline">{twin.plant.season}</Badge>}
        {twin.plant.area_ha != null && <Badge variant="outline">{formatNumber(twin.plant.area_ha)} ha</Badge>}
      </div>
    </section>
  )
}

interface StageToolbarProps {
  api: React.MutableRefObject<Plot3DApi | null>
  panelsOpen: boolean
  onTogglePanels: () => void
  /** id elemen panel yang dikendalikan tombol sembunyikan */
  panelsId: string
}

/** Toolbar kamera: sembunyikan/tampilkan panel info, zoom, putar seperempat putaran, dan reset. */
export function StageToolbar({ api, panelsOpen, onTogglePanels, panelsId }: StageToolbarProps) {
  const btn = 'h-11 w-11 bg-background/90 shadow'
  return (
    <div role="toolbar" aria-label="Kontrol kamera 3D" className="flex gap-2 lg:flex-col">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btn}
        aria-label={panelsOpen ? 'Sembunyikan panel info' : 'Tampilkan panel info'}
        aria-expanded={panelsOpen}
        aria-controls={panelsId}
        onClick={onTogglePanels}
      >
        {panelsOpen ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
      </Button>
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
    </div>
  )
}

/** Tombol aktif/nonaktif label data sensor di atas model; ditaruh di kiri bawah kanvas. */
export function SensorLabelToggle({ showLabels, onToggle }: { showLabels: boolean; onToggle: () => void }) {
  return (
    <Button type="button" variant="outline" className="h-11 bg-background/90 shadow" aria-pressed={showLabels} onClick={onToggle}>
      <Tag className="mr-2 h-4 w-4" aria-hidden="true" />
      Label sensor: {showLabels ? 'aktif' : 'nonaktif'}
    </Button>
  )
}
