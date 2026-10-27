'use client'

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, formatNumber } from '@/lib/format'
import { symptomLabel } from '@/lib/observation'
import { N_STATUS, interpolate, nStatus, type PlantTwin, type TwinObservation } from '@/lib/twin'

const REF_COLOR = '#43A047'
const OBS_COLOR = '#42A5F5'

interface GrowthPanelProps {
  twin: PlantTwin
  /** HST pada tanggal slider */
  age: number | null
}

function GrowthChart({
  title,
  unit,
  curve,
  observations,
  field,
  age,
  maxAge,
}: {
  title: string
  unit: string
  curve: { age: number; value: number }[]
  observations: TwinObservation[]
  field: 'height' | 'tiller'
  age: number | null
  maxAge: number
}) {
  const data = Array.from({ length: maxAge + 1 }, (_, a) => {
    const row: { age: number; ref: number | null; obs?: number } = { age: a, ref: interpolate(curve, a) }
    return row
  })
  for (const o of observations) {
    if (o.age !== null && o.age >= 0 && o.age <= maxAge && o[field] !== null) data[o.age].obs = o[field] as number
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">
        {title} <span className="text-muted-foreground">({unit})</span>
      </h3>
      <div className="h-44 w-full" aria-hidden="true">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="age" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
            <YAxis tick={{ fontSize: 11 }} width={44} />
            <Tooltip
              formatter={(value: number, name: string) => [formatNumber(Number(value)), name === 'ref' ? 'Acuan' : 'Observasi']}
              labelFormatter={(label) => `HST ${label}`}
            />
            <Legend formatter={(v) => (v === 'ref' ? 'Acuan varietas' : 'Observasi')} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="ref" stroke={REF_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="obs" stroke={OBS_COLOR} strokeWidth={0} dot={{ r: 4, fill: OBS_COLOR }} isAnimationActive={false} connectNulls={false} />
            {age !== null && age >= 0 && age <= maxAge && <ReferenceLine x={age} stroke="currentColor" strokeDasharray="4 2" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** F-MDL-02: indeks pertumbuhan dan grafik tinggi/anakan aktual vs acuan; kursor mengikuti slider. */
export function GrowthPanel({ twin, age }: GrowthPanelProps) {
  const { growth, observations, reference } = twin
  const maxAge = Math.max(60, ...(reference.height ?? []).map((p) => p.age), twin.variety?.maturity ?? 0)
  const latest = [...observations].reverse().find((o) => o.height !== null || o.tiller !== null)
  const hRef = age !== null ? interpolate(reference.height, age) : null
  const tRef = age !== null ? interpolate(reference.tiller, age) : null

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Pertumbuhan</CardTitle>
          {growth.index !== null ? (
            <Badge variant={growth.stunted ? 'destructive' : 'success'} className="gap-1 tabular-nums">
              {growth.stunted ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
              Indeks {formatNumber(growth.index)} · {growth.stunted ? 'terhambat' : 'normal'}
            </Badge>
          ) : (
            <Badge variant="secondary">Perlu observasi</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {growth.stunted && <p className="text-sm text-destructive">Indeks di bawah 0,85: konfirmasi gejala kerdil di lapangan.</p>}
        <GrowthChart title="Tinggi tanaman" unit="cm" curve={reference.height} observations={observations} field="height" age={age} maxAge={maxAge} />
        <GrowthChart title="Anakan per rumpun" unit="batang" curve={reference.tiller} observations={observations} field="tiller" age={age} maxAge={maxAge} />
        <p className="text-sm text-muted-foreground tabular-nums">
          {age !== null && hRef !== null && tRef !== null && (
            <>
              Acuan pada HST {age}: tinggi {formatNumber(hRef)} cm, anakan {formatNumber(tRef)}.{' '}
            </>
          )}
          {latest && (
            <>
              Observasi terakhir ({formatDateTime(latest.date, 'dd MMM')}): tinggi {latest.height ?? '-'} cm, anakan {latest.tiller ?? '-'}.
            </>
          )}
          {!latest && 'Belum ada observasi tersimpan.'}
        </p>
      </CardContent>
    </Card>
  )
}

/** F-MDL-03..05: status N dari BWD, defisit hara, gejala, dan rekomendasi terdekat. */
export function NutrientPanel({ twin }: { twin: PlantTwin }) {
  const { nutrients, reference, recommendation } = twin
  const status = nStatus(nutrients.bwd, reference.bwd_min)
  const meta = N_STATUS[status]
  const rows: { label: string; value: number | null; unit: string }[] = [
    { label: 'Nitrogen (N)', value: nutrients.n_def, unit: 'kg N/ha' },
    { label: 'Fosfor (P₂O₅)', value: nutrients.p2o5_def, unit: 'kg/ha' },
    { label: 'Kalium (K₂O)', value: nutrients.k2o_def, unit: 'kg/ha' },
  ]

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Status hara</CardTitle>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
            N: {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground tabular-nums">
          BWD terakhir {nutrients.bwd !== null ? String(nutrients.bwd).replace('.', ',') : '-'}
          {reference.bwd_min !== null ? ` · batas fase ${reference.bwd_min}` : ' · fase ini tanpa batas BWD'}
          {nutrients.soil_p && ` · tanah P ${nutrients.soil_p.toLowerCase()}, K ${(nutrients.soil_k ?? '').toLowerCase()}`}
        </p>

        <ul className="space-y-2" aria-label="Defisit hara">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <span className="text-sm font-medium">{r.label}</span>
              {r.value === null ? (
                <span className="text-sm text-muted-foreground">belum dihitung</span>
              ) : r.value > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-destructive">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  kurang {formatNumber(r.value)} {r.unit}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  cukup
                </span>
              )}
            </li>
          ))}
        </ul>

        {nutrients.symptoms.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">Gejala terakhir</p>
            <div className="flex flex-wrap gap-1.5">
              {nutrients.symptoms.map((c) => (
                <Badge key={c} variant="outline">
                  {symptomLabel(c)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {recommendation ? (
          <div className="rounded-md border border-info/40 bg-info/10 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <Sprout className="h-4 w-4" aria-hidden="true" />
              Rekomendasi terdekat
              {recommendation.start && <span className="font-normal text-muted-foreground tabular-nums">· {formatDateTime(recommendation.start, 'dd MMM yyyy')}</span>}
            </p>
            <p className="mt-1">{recommendation.description ?? recommendation.plan_value}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dosis awal dari model; wajib divalidasi penyuluh sebelum diterapkan.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Tidak ada rekomendasi pupuk saat ini.</p>
        )}
      </CardContent>
    </Card>
  )
}

const METHOD_LABEL: Record<string, string> = {
  FAKTOR: 'Faktor (sebelum berbunga)',
  KOMPONEN: 'Komponen hasil (setelah berbunga)',
}

/** F-MDL-06: prediksi hasil, rentang, rata-rata dan potensi varietas, faktor, metode, keyakinan. */
export function YieldPanel({ twin }: { twin: PlantTwin }) {
  const y = twin.yield
  const max = Math.max(y?.potential ?? 0, y?.high ?? 0, y?.avg ?? 0) * 1.05 || 1
  const pos = (v: number | null) => `${Math.min(100, Math.max(0, ((v ?? 0) / max) * 100))}%`

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <CardTitle>Prediksi hasil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {!y || y.value === null ? (
          <p className="text-sm text-muted-foreground">Belum ada prediksi. Jalankan simulasi untuk menghitungnya.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-4xl font-bold tabular-nums">{formatNumber(y.value)}</span>
              <span className="text-muted-foreground">t/ha GKG</span>
              {y.low !== null && y.high !== null && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  rentang {formatNumber(y.low)}-{formatNumber(y.high)}
                </span>
              )}
            </div>

            <div
              className="relative h-3 w-full rounded-full bg-muted"
              role="img"
              aria-label={`Prediksi ${y.value} t/ha, rentang ${y.low} sampai ${y.high}, rata-rata varietas ${y.avg}, potensi ${y.potential}`}
            >
              {y.low !== null && y.high !== null && (
                <div className="absolute h-3 rounded-full bg-primary/40" style={{ left: pos(y.low), width: `calc(${pos(y.high)} - ${pos(y.low)})` }} />
              )}
              <div className="absolute -top-1 h-5 w-1 rounded bg-primary" style={{ left: pos(y.value) }} />
              {y.avg !== null && <div className="absolute -top-0.5 h-4 w-0.5 bg-foreground/70" style={{ left: pos(y.avg) }} title="Rata-rata varietas" />}
              {y.potential !== null && <div className="absolute -top-0.5 h-4 w-0.5 bg-foreground/40" style={{ left: pos(y.potential) }} title="Potensi varietas" />}
            </div>
            <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground tabular-nums">
              <span>Rata-rata varietas {y.avg !== null ? formatNumber(y.avg) : '-'}</span>
              <span>Potensi {y.potential !== null ? formatNumber(y.potential) : '-'}</span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Metode</dt>
              <dd>{METHOD_LABEL[y.method ?? ''] ?? y.method ?? '-'}</dd>
              <dt className="text-muted-foreground">Keyakinan</dt>
              <dd className="tabular-nums">{y.confidence !== null ? `${Math.round(y.confidence * 100)}%` : '-'}</dd>
              {y.factors && (
                <>
                  <dt className="text-muted-foreground">Faktor</dt>
                  <dd className="tabular-nums">
                    pertumbuhan {formatNumber(y.factors.f_growth)} · N {formatNumber(y.factors.f_n)} · hama {formatNumber(y.factors.f_pest)}
                  </dd>
                </>
              )}
              {y.harvest_date && (
                <>
                  <dt className="text-muted-foreground">Panen proyeksi</dt>
                  <dd className="tabular-nums">{formatDateTime(y.harvest_date, 'dd MMM yyyy')}</dd>
                </>
              )}
            </dl>
          </>
        )}

        {twin.scenarios.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-medium">Skenario cuaca</p>
            <ul className="space-y-1 text-sm tabular-nums">
              {twin.scenarios.map((s) => (
                <li key={s.scenario} className="flex justify-between gap-3 rounded border px-3 py-1.5">
                  <span>{s.scenario === 'KERING' ? 'Kering' : s.scenario === 'BASAH' ? 'Basah' : s.scenario}</span>
                  <span>
                    panen {s.harvest_date ? formatDateTime(s.harvest_date, 'dd MMM') : '-'}
                    {s.yield !== null ? ` · ${formatNumber(s.yield)} t/ha` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
