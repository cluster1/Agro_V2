'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts'
import { Clock, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, formatNumber } from '@/lib/format'

import { STALE_AFTER_MS } from './constants'

// Colour-blind-safe (Okabe-Ito / Paul Tol derived) palettes, each series >= 3:1 against its own theme background.
const LIGHT_COLORS = ['#0072B2', '#B35900', '#007A5A', '#AA3377', '#6A3D9A', '#8C6D00', '#CC3311', '#444444']
const DARK_COLORS = ['#56B4E9', '#E69F00', '#009E73', '#CC79A7', '#B39DDB', '#F0E442', '#EE6677', '#BBBBBB']
// Colour is never the only cue: each series also gets its own dash pattern and marker shape.
const DASHES = ['0', '6 3', '2 3', '8 3 2 3', '10 4', '3 3', '1 4', '12 3 3 3']
type Shape = 'circle' | 'square' | 'diamond' | 'triangle' | 'cross' | 'star' | 'plus' | 'wye'
const SHAPES: Shape[] = ['circle', 'square', 'diamond', 'triangle', 'cross', 'star', 'plus', 'wye']

const TABLE_ROW_LIMIT = 100

interface Reading {
  read_date: string
  read_value: number | string
}

interface ParamHistory {
  parameter: {
    ds_id: string
    ds_name: string
    unit_id?: string | null
    unit_name?: string | null
    unit_symbol?: string | null
  }
  readings: Reading[]
}

interface HistoryChartProps {
  historyData: ParamHistory[]
  /** e.g. "24 jam terakhir" */
  rangeLabel: string
  /** React Query `dataUpdatedAt` (ms epoch, 0 when never fetched) */
  dataUpdatedAt?: number
}

function markerPath(shape: Shape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case 'square':
      return `M${cx - r},${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`
    case 'diamond':
      return `M${cx},${cy - r - 1}L${cx + r + 1},${cy}L${cx},${cy + r + 1}L${cx - r - 1},${cy}z`
    case 'triangle':
      return `M${cx},${cy - r}L${cx + r},${cy + r}L${cx - r},${cy + r}z`
    case 'cross':
      return `M${cx - r},${cy - r}L${cx + r},${cy + r}M${cx + r},${cy - r}L${cx - r},${cy + r}`
    case 'plus':
      return `M${cx - r},${cy}h${2 * r}M${cx},${cy - r}v${2 * r}`
    case 'star':
      return `M${cx},${cy - r - 1}L${cx + 1.5},${cy - 1.5}L${cx + r + 1},${cy}L${cx + 1.5},${cy + 1.5}L${cx},${cy + r + 1}L${cx - 1.5},${cy + 1.5}L${cx - r - 1},${cy}L${cx - 1.5},${cy - 1.5}z`
    case 'wye':
      return `M${cx},${cy}L${cx},${cy + r}M${cx},${cy}L${cx - r},${cy - r}M${cx},${cy}L${cx + r},${cy - r}`
    default:
      return ''
  }
}

function Marker({ shape, cx, cy, color, r = 4 }: { shape: Shape; cx: number; cy: number; color: string; r?: number }) {
  if (shape === 'circle') {
    return <circle cx={cx} cy={cy} r={r} fill={color} stroke="hsl(var(--background))" strokeWidth={1} />
  }
  const filled = shape === 'square' || shape === 'diamond' || shape === 'triangle' || shape === 'star'
  return (
    <path
      d={markerPath(shape, cx, cy, r)}
      fill={filled ? color : 'none'}
      stroke={filled ? 'hsl(var(--background))' : color}
      strokeWidth={filled ? 1 : 2}
    />
  )
}

/** Small legend glyph: dash pattern line + marker shape in the series colour. */
function Swatch({ color, dash, shape }: { color: string; dash: string; shape: Shape }) {
  return (
    <svg width="32" height="14" viewBox="0 0 32 14" aria-hidden="true" focusable="false">
      <line x1="0" y1="7" x2="32" y2="7" stroke={color} strokeWidth="2.5" strokeDasharray={dash === '0' ? undefined : dash} />
      <Marker shape={shape} cx={16} cy={7} color={color} r={4} />
    </svg>
  )
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setNarrow(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

export default function HistoryChart({ historyData, rangeLabel, dataUpdatedAt }: HistoryChartProps) {
  const { resolvedTheme } = useTheme()
  const narrow = useNarrow()
  const colors = resolvedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS
  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  // One descriptor per series (keyed by ds_id so equal names never collide)
  const series = useMemo(
    () =>
      historyData.map((item, index) => {
        const p = item.parameter
        const symbol = p.unit_symbol || ''
        return {
          key: p.ds_id,
          label: symbol ? `${p.ds_name} (${symbol})` : p.ds_name,
          name: p.ds_name,
          symbol,
          unitKey: p.unit_id || 'unknown',
          unitName: p.unit_name || '',
          dash: DASHES[index % DASHES.length],
          shape: SHAPES[index % SHAPES.length],
          colorIndex: index % colors.length,
          count: item.readings?.length ?? 0,
        }
      }),
    [historyData, colors.length]
  )

  // Merge ALL series by timestamp (never by array index: parameters may be sampled differently)
  const chartData = useMemo(() => {
    const rows = new Map<number, Record<string, number>>()
    historyData.forEach((item) => {
      ;(item.readings ?? []).forEach((reading) => {
        const ts = new Date(reading.read_date).getTime()
        const value = Number(reading.read_value)
        if (Number.isNaN(ts) || Number.isNaN(value)) return
        const row = rows.get(ts) ?? { ts }
        row[item.parameter.ds_id] = value
        rows.set(ts, row)
      })
    })
    return Array.from(rows.values()).sort((a, b) => a.ts - b.ts)
  }, [historyData])

  const unitGroups = useMemo(() => {
    const groups = new Map<string, typeof series>()
    series.forEach((s) => groups.set(s.unitKey, [...(groups.get(s.unitKey) ?? []), s]))
    return Array.from(groups.entries())
  }, [series])

  if (chartData.length === 0) {
    return <div className="py-16 text-center text-muted-foreground">Tidak ada pembacaan untuk ditampilkan</div>
  }

  const first = chartData[0].ts
  const last = chartData[chartData.length - 1].ts
  const spanMs = last - first
  const tickPattern = spanMs > 36 * 3600 * 1000 ? 'dd MMM HH:mm' : 'HH:mm'
  const tickFormatter = (value: number) => formatDateTime(value, tickPattern)
  const isVisible = (key: string) => !hidden[key]
  const toggle = (key: string) => setHidden((prev) => ({ ...prev, [key]: !prev[key] }))

  // Latest value per series, for the textual summary
  const latestValues = series
    .map((s) => {
      for (let i = chartData.length - 1; i >= 0; i--) {
        const v = chartData[i][s.key]
        if (v !== undefined) return `${s.name} ${formatNumber(v)}${s.symbol ? ' ' + s.symbol : ''}`
      }
      return null
    })
    .filter(Boolean)
    .join(', ')

  const summary = `Grafik garis riwayat ${rangeLabel} untuk ${series.map((s) => s.label).join(', ')}. Rentang ${formatDateTime(first)} sampai ${formatDateTime(last)}. Nilai terbaru: ${latestValues}.`

  const isStale = Date.now() - last > STALE_AFTER_MS
  const margin = narrow ? { top: 5, right: 8, left: 0, bottom: 5 } : { top: 5, right: 24, left: 12, bottom: 5 }
  const tableRows = chartData.slice(-TABLE_ROW_LIMIT)

  return (
    <div className="space-y-4">
      {/* Status line: freshness is shown with icon + text, never colour alone */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Terakhir diperbarui {dataUpdatedAt ? formatDateTime(dataUpdatedAt, 'dd MMM yyyy HH:mm:ss') : '-'}
        </span>
        <span className="tabular-nums">Data terbaru: {formatDateTime(last, 'dd MMM yyyy HH:mm:ss')}</span>
        {isStale && (
          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-card px-2.5 py-0.5 text-xs font-semibold text-destructive">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Data tidak terbaru
          </span>
        )}
      </div>

      {/* Clickable legend (single source of series toggles; sits outside role="img" so it stays operable) */}
      <ul className="flex flex-wrap gap-2" aria-label="Pilih garis yang ditampilkan">
        {series.map((s) => {
          const color = colors[s.colorIndex]
          const on = isVisible(s.key)
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={on}
                className={cn(
                  'inline-flex min-h-[32px] items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm text-foreground coarse:min-h-[44px]',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !on && 'opacity-60'
                )}
              >
                <Swatch color={color} dash={s.dash} shape={s.shape} />
                <span className={cn(!on && 'line-through')}>{s.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={margin} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />

            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tickFormatter}
              minTickGap={narrow ? 24 : 48}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              stroke="hsl(var(--border))"
            />

            {/* One Y axis per unit, alternating sides */}
            {unitGroups.map(([unitKey, group], unitIndex) => {
              const orientation = unitIndex % 2 === 0 ? 'left' : 'right'
              const symbol = group[0].symbol
              const name = group[0].unitName
              const axisLabel = name && symbol ? `${name} (${symbol})` : name || symbol || 'Nilai'
              return (
                <YAxis
                  key={unitKey}
                  yAxisId={`axis-${unitKey}`}
                  orientation={orientation}
                  hide={group.every((s) => !isVisible(s.key))}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(v: number) => formatNumber(v)}
                  stroke="hsl(var(--border))"
                  domain={['auto', 'auto']}
                  width={narrow ? 44 : 60}
                  label={
                    narrow
                      ? undefined
                      : {
                          value: axisLabel,
                          angle: orientation === 'left' ? -90 : 90,
                          position: orientation === 'left' ? 'insideLeft' : 'insideRight',
                          style: { fontSize: '12px', fill: 'hsl(var(--muted-foreground))', fontWeight: 500, textAnchor: 'middle' },
                        }
                  }
                />
              )
            })}

            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '13px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelFormatter={(label: number) => formatDateTime(label, 'dd MMM yyyy HH:mm:ss')}
              formatter={(value: any, _name: string, item: any) => {
                const s = series.find((x) => x.key === item?.dataKey)
                return [`${formatNumber(Number(value))}${s?.symbol ? ' ' + s.symbol : ''}`, s?.name ?? _name]
              }}
            />

            {/* Built-in legend is intentionally not rendered: the clickable legend above is the only one. */}

            {series.map((s) => {
              if (!isVisible(s.key)) return null
              const color = colors[s.colorIndex]
              // Markers on ~8 of this series' own points so the shape is visible without clutter
              const ownTs = chartData.filter((r) => r[s.key] !== undefined).map((r) => r.ts)
              const step = Math.max(1, Math.ceil(ownTs.length / 8))
              const markerTs = new Set(ownTs.filter((_, i) => i % step === 0))
              return (
                <Line
                  key={s.key}
                  yAxisId={`axis-${s.unitKey}`}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeDasharray={s.dash === '0' ? undefined : s.dash}
                  connectNulls
                  isAnimationActive={false}
                  dot={(props: any) => {
                    const { cx, cy, index, key, payload } = props
                    if (cx == null || cy == null || !markerTs.has(payload?.ts)) return <g key={key ?? index} />
                    return (
                      <g key={key ?? index}>
                        <Marker shape={s.shape} cx={cx} cy={cy} color={color} r={3.5} />
                      </g>
                    )
                  }}
                  activeDot={(props: any) => (
                    <g key={props.key}>
                      <Marker shape={s.shape} cx={props.cx} cy={props.cy} color={color} r={6} />
                    </g>
                  )}
                />
              )
            })}

            <Brush
              dataKey="ts"
              height={30}
              travellerWidth={16}
              tickFormatter={tickFormatter}
              stroke="hsl(var(--primary))"
              fill="hsl(var(--muted))"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="rounded-lg border bg-card p-3 text-card-foreground">
        <summary className="cursor-pointer text-sm font-medium">Lihat data dalam tabel</summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="pb-2 text-left text-sm text-muted-foreground">
              {rangeLabel}: {tableRows.length} waktu pembacaan terbaru (maksimal {TABLE_ROW_LIMIT})
            </caption>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-4 font-medium">Waktu</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-2 pr-4 font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...tableRows].reverse().map((row) => (
                <tr key={row.ts} className="border-b last:border-0">
                  <th scope="row" className="whitespace-nowrap py-1.5 pr-4 font-normal tabular-nums">
                    {formatDateTime(row.ts, 'dd MMM yyyy HH:mm:ss')}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 pr-4 tabular-nums">
                      {row[s.key] !== undefined ? formatNumber(row[s.key]) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
