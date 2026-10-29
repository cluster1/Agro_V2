'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PAGE_SIZE, TablePagination, clampPage } from '@/components/ui/table-pagination'
import { DownloadButton, ReportStat, TableSkeleton } from '@/components/reports/report-parts'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canViewReports } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { PLAN_STATUS_VARIANT, rupiah, type CostReport } from '@/lib/farm-reports'

const ALL = 'all'
const MAX_RANGE_DAYS = 366
const DAY_MS = 86_400_000

const slice = <T,>(rows: T[], page: number) => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

export default function CostReportPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const allowed = canViewReports(user)

  const [siteId, setSiteId] = useState(ALL)
  const [plantId, setPlantId] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actPage, setActPage] = useState(1)
  const [planPage, setPlanPage] = useState(1)

  const periodError = useMemo(() => {
    if (!from || !to) return null
    const span = (Date.parse(to) - Date.parse(from)) / DAY_MS
    if (span < 0) return 'Tanggal mulai tidak boleh setelah tanggal akhir.'
    if (span > MAX_RANGE_DAYS) return `Rentang maksimal ${MAX_RANGE_DAYS} hari.`
    return null
  }, [from, to])

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (siteId !== ALL) p.siteId = siteId
    if (plantId !== ALL) p.plantId = plantId
    if (from) p.from = from
    if (to) p.to = to
    return p
  }, [siteId, plantId, from, to])

  const report = useQuery({
    queryKey: [...queryKeys.costReport(activeTenantId), params],
    queryFn: async () => (await api.get('/reports/costs', { params })).data as CostReport,
    enabled: allowed && !!activeTenantId && !periodError,
  })
  const sites = useQuery({
    queryKey: queryKeys.sites(activeTenantId),
    queryFn: async () => (await api.get('/sites')).data as { site_id: string; site_name: string }[],
    enabled: allowed && !!activeTenantId,
  })
  const plants = useQuery({
    queryKey: [...queryKeys.plants(activeTenantId), 'all'],
    queryFn: async () => (await api.get('/plants')).data as { plant_id: string; plant_name: string | null; site_id: string }[],
    enabled: allowed && !!activeTenantId,
  })
  const plantOptions = useMemo(() => (plants.data ?? []).filter((p) => siteId === ALL || p.site_id === siteId), [plants.data, siteId])

  const rows = report.data?.rows ?? []
  const plan = report.data?.plan ?? []
  const s = report.data?.summary
  const actCurrent = clampPage(actPage, rows.length)
  const planCurrent = clampPage(planPage, plan.length)

  // filter berubah: kedua tabel kembali ke halaman pertama
  const reset = () => {
    setActPage(1)
    setPlanPage(1)
  }

  if (user && !allowed) {
    return (
      <DashboardLayout>
        <ErrorState title="Akses ditolak" message="Laporan kegiatan & biaya hanya dapat dilihat oleh admin, admin tenant, dan agronom." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Laporan Kegiatan &amp; Biaya</PageTitle>
            <p className="mt-1 text-muted-foreground">Kegiatan, bahan, hara masuk per hektare, pekerja, biaya, dan rencana vs realisasi</p>
          </div>
          <DownloadButton url="/reports/costs" params={params} format="xlsx" filename="kegiatan-biaya.xlsx" label="Unduh XLSX" disabled={rows.length === 0 && plan.length === 0} />
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="cost-site">Site</Label>
              <Select
                value={siteId}
                onValueChange={(v) => {
                  setSiteId(v)
                  setPlantId(ALL)
                  reset()
                }}
              >
                <SelectTrigger id="cost-site">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua site</SelectItem>
                  {sites.data?.map((x) => (
                    <SelectItem key={x.site_id} value={x.site_id}>
                      {x.site_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-plant">Petak</Label>
              <Select
                value={plantId}
                onValueChange={(v) => {
                  setPlantId(v)
                  reset()
                }}
              >
                <SelectTrigger id="cost-plant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua petak</SelectItem>
                  {plantOptions.map((p) => (
                    <SelectItem key={p.plant_id} value={p.plant_id}>
                      {p.plant_name ?? p.plant_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-from">Dari tanggal</Label>
              <Input
                id="cost-from"
                type="date"
                value={from}
                max={to || undefined}
                aria-invalid={!!periodError}
                aria-describedby={periodError ? 'cost-period-error' : undefined}
                onChange={(e) => {
                  setFrom(e.target.value)
                  reset()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-to">Sampai tanggal</Label>
              <Input
                id="cost-to"
                type="date"
                value={to}
                min={from || undefined}
                aria-invalid={!!periodError}
                aria-describedby={periodError ? 'cost-period-error' : undefined}
                onChange={(e) => {
                  setTo(e.target.value)
                  reset()
                }}
              />
            </div>
            {periodError && (
              <p id="cost-period-error" role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
                {periodError}
              </p>
            )}
          </CardContent>
        </Card>

        {s && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-live="polite">
            <ReportStat
              label="Total biaya"
              value={rupiah(s.cost)}
              hint={s.cost_missing > 0 ? `${formatNumber(s.cost_missing)} kegiatan tanpa biaya, total minimal` : `${formatNumber(s.activities)} kegiatan`}
            />
            <ReportStat label="Pekerja" value={formatNumber(s.workers)} hint="jumlah orang pada kegiatan" />
            <ReportStat label="Hara N masuk" value={`${formatNumber(s.n_kg_ha)} kg/ha`} hint={`P2O5 ${formatNumber(s.p2o5_kg_ha)} · K2O ${formatNumber(s.k2o_kg_ha)} kg/ha`} />
            <ReportStat
              label="Realisasi jadwal"
              value={s.plan.completion_pct === null ? '-' : `${formatNumber(s.plan.completion_pct)}%`}
              hint={`${formatNumber(s.plan.done)} selesai dari ${formatNumber(s.plan.planned - s.plan.cancelled)} jadwal`}
            />
            <ReportStat label="Jadwal terlambat" value={formatNumber(s.plan.overdue)} hint={`${formatNumber(s.plan.open)} masih terbuka`} />
          </div>
        )}

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Kegiatan ({formatNumber(rows.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.isLoading ? (
              <TableSkeleton />
            ) : report.isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => report.refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ClipboardCheck className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada kegiatan</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tidak ada kegiatan tersimpan pada filter ini.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <caption className="sr-only">Kegiatan, bahan, hara masuk, pekerja dan biaya</caption>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Tanggal</TableHead>
                        <TableHead className="font-bold">Petak</TableHead>
                        <TableHead className="font-bold">Kegiatan</TableHead>
                        <TableHead className="font-bold">Bahan</TableHead>
                        <TableHead className="text-right font-bold">Jumlah</TableHead>
                        <TableHead className="text-right font-bold">N (kg/ha)</TableHead>
                        <TableHead className="text-right font-bold">P2O5</TableHead>
                        <TableHead className="text-right font-bold">K2O</TableHead>
                        <TableHead className="text-right font-bold">Pekerja</TableHead>
                        <TableHead className="text-right font-bold">Biaya</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice(rows, actCurrent).map((r) => (
                        <TableRow key={r.pact_id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(r.date, 'dd MMM yyyy')}</TableCell>
                          <TableCell className="font-medium">{r.plant_name ?? '-'}</TableCell>
                          <TableCell>{r.activity ?? '-'}</TableCell>
                          <TableCell>{r.material ?? '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{r.amount ?? '-'}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.n_kg_ha)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.p2o5_kg_ha)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.k2o_kg_ha)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.workers)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{rupiah(r.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={actCurrent} total={rows.length} onPageChange={setActPage} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Rencana vs realisasi ({formatNumber(plan.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.isLoading ? (
              <TableSkeleton />
            ) : plan.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Tidak ada jadwal pada filter ini.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <caption className="sr-only">Jadwal terhadap kegiatan yang merealisasikannya</caption>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Tanggal rencana</TableHead>
                        <TableHead className="font-bold">Petak</TableHead>
                        <TableHead className="font-bold">Kegiatan</TableHead>
                        <TableHead className="font-bold">Judul</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Tanggal realisasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice(plan, planCurrent).map((r) => (
                        <TableRow key={r.sched_id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(r.date, 'dd MMM yyyy')}</TableCell>
                          <TableCell className="font-medium">{r.plant_name ?? '-'}</TableCell>
                          <TableCell>{r.activity ?? '-'}</TableCell>
                          <TableCell>{r.title ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant={PLAN_STATUS_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(r.done_date, 'dd MMM yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={planCurrent} total={plan.length} onPageChange={setPlanPage} />
              </>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Hara masuk dihitung hanya untuk pupuk berjumlah kg: jumlah x kandungan (%) / 100 / luas petak. Total biaya hanya menjumlah kegiatan yang biayanya diisi. Jadwal
          dianggap selesai bila ada kegiatan yang tertaut ke jadwal itu.
        </p>
      </div>
    </DashboardLayout>
  )
}
