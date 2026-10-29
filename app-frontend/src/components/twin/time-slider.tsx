'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { addDays, daysBetween, phaseOnDay, type TimelineEntry } from '@/lib/twin'
import { formatDateTime } from '@/lib/format'

interface TimeSliderProps {
  start: string
  end: string
  today: string
  plantDate: string | null
  value: string
  onChange: (day: string) => void
  timeline: TimelineEntry[]
  /** tanggal rekaman/foto untuk tanda di pita */
  markers: string[]
  followTimeline: boolean
  onFollowChange: (follow: boolean) => void
}

const STEP_MS = 140

/** Slider waktu persemaian sampai panen proyeksi dengan pita fase, tombol Hari ini dan Putar. */
export function TimeSlider({ start, end, today, plantDate, value, onChange, timeline, markers, followTimeline, onFollowChange }: TimeSliderProps) {
  const total = Math.max(1, daysBetween(start, end))
  const offset = Math.min(total, Math.max(0, daysBetween(start, value)))
  const [playing, setPlaying] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const next = addDays(valueRef.current, 1)
      if (next > end) {
        setPlaying(false)
        return
      }
      onChange(next)
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [playing, end, onChange])

  const phase = phaseOnDay(timeline, value)
  const age = plantDate ? daysBetween(plantDate, value) : null
  const isProjection = value > today
  const pct = (day: string) => `${Math.min(100, Math.max(0, (daysBetween(start, day) / total) * 100))}%`

  const segments = timeline.map((p, i) => {
    const from = Math.max(0, daysBetween(start, p.start))
    const to = i + 1 < timeline.length ? daysBetween(start, timeline[i + 1].start) : total
    return { p, left: (from / total) * 100, width: Math.max(0, ((Math.min(total, to) - from) / total) * 100) }
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isProjection ? 'warning' : 'success'}>{isProjection ? 'Perkiraan' : 'Kenyataan'}</Badge>
          <span className="font-semibold tabular-nums">{formatDateTime(value, 'dd MMM yyyy')}</span>
          {age !== null && <span className="text-sm text-muted-foreground tabular-nums">umur {age} hari</span>}
          {phase && <span className="text-sm">· {phase.name}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? <Pause className="mr-2 h-4 w-4" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
            {playing ? 'Jeda' : 'Putar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setPlaying(false)
              onChange(today)
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Hari ini
          </Button>
          <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={followTimeline} onChange={(e) => onFollowChange(e.target.checked)} />
            Ikuti tanggal
          </label>
        </div>
      </div>

      <div className="relative pt-1">
        {/* phase ribbon */}
        <div className="relative h-5 w-full overflow-hidden rounded border" aria-hidden="true">
          {segments.map(({ p, left, width }) => (
            <div
              key={p.phase_id}
              className="absolute top-0 h-full border-r border-background/60"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: p.color ?? '#BDBDBD', opacity: p.start > today ? 0.55 : 1 }}
              title={`${p.name} · mulai ${p.start}${p.start > today ? ' (perkiraan)' : ''}`}
            />
          ))}
          <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: pct(today) }} title="Hari ini" />
          {markers.map((m, i) => (
            <div key={`${m}-${i}`} className="absolute bottom-0 h-2 w-0.5 bg-blue-700" style={{ left: pct(m) }} />
          ))}
        </div>

        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={offset}
          onChange={(e) => {
            setPlaying(false)
            onChange(addDays(start, Number(e.target.value)))
          }}
          aria-label="Waktu petak digital"
          aria-valuetext={`${value}${age !== null ? `, umur ${age} hari` : ''}${phase ? `, ${phase.name}` : ''}, ${isProjection ? 'perkiraan' : 'kenyataan'}`}
          className="mt-2 h-8 w-full cursor-pointer accent-primary"
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>Tanam {formatDateTime(start, 'dd MMM')}</span>
        <span>Perkiraan panen {formatDateTime(end, 'dd MMM')}</span>
      </div>
    </div>
  )
}
