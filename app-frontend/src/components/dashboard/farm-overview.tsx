'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { Bell, CalendarClock, Map as MapIcon, Sprout, Wheat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import api from '@/lib/api'
import { formatDateTime, formatNumber } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import type { FarmDashboard } from '@/lib/farm-reports'
import type { SitePlant, TwinMapData } from '@/lib/twin'

const PlotPhaseMap = dynamic(() => import('@/components/dashboard/plot-phase-map').then((m) => m.PlotPhaseMap), {
  ssr: false,
  loading: () => <div role="status" aria-label="Memuat peta" className="h-[420px] rounded-lg bg-muted motion-safe:animate-pulse" />,
})

const HARVEST_SOURCE = { MODEL: 'proyeksi model', RENCANA: 'tanggal rencana' } as const

function Stat({ icon: Icon, label, value, hint, href, tone }: { icon: typeof Sprout; label: string; value: string; hint: string; href?: string; tone?: 'alert' }) {
  const body = (
    <Card className={`h-full border-2 ${tone === 'alert' ? 'border-destructive/60' : ''}`}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {body}
    </Link>
  ) : (
    body
  )
}

/** F-DSB-01: kartu ringkas lahan (luas, fase, kesehatan, panen terdekat, jadwal, alert) dan peta petak berwarna fase. */
export function FarmOverview({ tenantId }: { tenantId: string }) {
  const summary = useQuery({
    queryKey: queryKeys.farmDashboard(tenantId),
    queryFn: async () => (await api.get('/reports/farm-dashboard')).data as FarmDashboard,
  })
  // kunci sama dengan halaman Digital Twin, jadi data petak dipakai bersama
  const plants = useQuery({
    queryKey: queryKeys.twin(tenantId),
    queryFn: async () => (await api.get('/twin')).data as SitePlant[],
  })
  const mapData = useQuery({
    queryKey: queryKeys.twinMap(tenantId),
    queryFn: async () => (await api.get('/twin/map')).data as TwinMapData,
  })

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Memuat ringkasan lahan">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
    )
  }
  if (summary.isError || !summary.data) return <ErrorState title="Gagal memuat ringkasan lahan" onRetry={() => summary.refetch()} />

  const d = summary.data
  const harvest = d.next_harvest

  return (
    <section aria-label="Ringkasan lahan" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Sprout} label="Luas terpantau" value={`${formatNumber(d.area_ha)} ha`} hint={`${formatNumber(d.plants)} petak aktif`} />
        <Stat
          icon={Wheat}
          label="Panen terdekat"
          value={harvest ? formatDateTime(harvest.date, 'dd MMM yyyy') : '-'}
          hint={harvest ? `${harvest.plant_name ?? harvest.plant_id} (${HARVEST_SOURCE[harvest.source]})` : 'belum ada proyeksi panen'}
          href="/twin"
        />
        <Stat
          icon={CalendarClock}
          label={`Jadwal ${d.schedules.window_days} hari`}
          value={formatNumber(d.schedules.total)}
          hint="kegiatan belum selesai"
          href="/schedules"
        />
        <Stat
          icon={Bell}
          label="Alert terbuka"
          value={formatNumber(d.open_alerts)}
          hint={d.open_alerts > 0 ? 'menunggu ditinjau' : 'tidak ada alarm baru'}
          href="/alerts"
          tone={d.open_alerts > 0 ? 'alert' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 border-2 lg:col-span-2">
          <CardHeader className="border-b py-3">
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle className="text-base">Peta petak menurut fase</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {plants.isLoading ? (
              <div role="status" aria-label="Memuat peta" className="h-[420px] rounded-lg bg-muted motion-safe:animate-pulse" />
            ) : plants.isError ? (
              <ErrorState title="Gagal memuat petak" onRetry={() => plants.refetch()} />
            ) : (
              <PlotPhaseMap plants={plants.data ?? []} sites={mapData.data?.sites ?? []} />
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="border-2">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Petak per fase</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {d.phases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada tanaman aktif.</p>
              ) : (
                <ul className="space-y-2">
                  {d.phases.map((p) => (
                    <li key={p.phase_id ?? 'none'} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: p.color ?? '#BDBDBD' }} aria-hidden="true" />
                        {p.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(p.count)} petak · {formatNumber(p.area_ha)} ha
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Status kesehatan</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {d.health.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada tanaman aktif.</p>
              ) : (
                <ul className="space-y-2">
                  {d.health.map((h) => (
                    <li key={h.health} className="flex items-center justify-between gap-3 text-sm">
                      <span>{h.health}</span>
                      <Badge variant="outline" className="tabular-nums">
                        {formatNumber(h.count)} petak
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">
            Jadwal {d.schedules.window_days} hari ke depan ({formatNumber(d.schedules.total)})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {d.schedules.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada kegiatan terjadwal dalam {d.schedules.window_days} hari ke depan.</p>
          ) : (
            <ul className="divide-y">
              {d.schedules.items.map((s) => (
                <li key={s.sched_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{s.title ?? s.activity ?? 'Kegiatan'}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {s.plant_name ?? 'tanpa petak'}
                      {s.activity && s.title ? ` · ${s.activity}` : ''}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    {formatDateTime(s.start_date, 'dd MMM yyyy')}
                    {s.status === 4 && <Badge variant="destructive">terlambat</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {d.schedules.total > d.schedules.items.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Menampilkan {d.schedules.items.length} dari {formatNumber(d.schedules.total)}.{' '}
              <Link href="/schedules" className="underline">
                Lihat semua jadwal
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
