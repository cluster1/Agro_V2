'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Target } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canViewAccuracy } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { downloadBlob } from '@/lib/csv'
import { signed, type AccuracyRow, type AccuracySummary } from '@/lib/calibration'

/** Selisih hasil: di bawah 10% bagus, 10-20% perlu perhatian, di atas itu buruk (teks, bukan warna saja). */
function ErrorBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">-</span>
  const abs = Math.abs(value)
  const meta = abs <= 10 ? { variant: 'success' as const, label: 'baik' } : abs <= 20 ? { variant: 'warning' as const, label: 'cukup' } : { variant: 'destructive' as const, label: 'jauh' }
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {signed(value)}%
      <Badge variant={meta.variant}>{meta.label}</Badge>
    </span>
  )
}

export default function ModelAccuracyPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const allowed = canViewAccuracy(user)

  const [varId, setVarId] = useState('all')
  const [season, setSeason] = useState('all')
  const [downloading, setDownloading] = useState(false)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (varId !== 'all') p.varId = varId
    if (season !== 'all') p.season = season
    return p
  }, [varId, season])

  const report = useQuery({
    queryKey: [...queryKeys.accuracy(activeTenantId), params],
    queryFn: async () => (await api.get('/reports/accuracy', { params })).data as { rows: AccuracyRow[]; summary: AccuracySummary },
    enabled: allowed && !!activeTenantId,
  })
  const varieties = useQuery({
    queryKey: queryKeys.ref('varieties', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/varieties', { params: { ptype_id: 'PT-PADI' } })).data as { var_id: string; var_name: string }[],
    enabled: allowed,
    staleTime: 10 * 60 * 1000,
  })
  const plants = useQuery({
    queryKey: [...queryKeys.plants(activeTenantId), 'all'],
    queryFn: async () => (await api.get('/plants')).data as { plant_season: string | null }[],
    enabled: allowed && !!activeTenantId,
  })
  const seasons = useMemo(() => [...new Set((plants.data ?? []).map((p) => p.plant_season).filter(Boolean) as string[])].sort().reverse(), [plants.data])

  const download = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/reports/accuracy', { params: { ...params, format: 'xlsx' }, responseType: 'blob' })
      downloadBlob(res.data, 'akurasi-model.xlsx', res.data.type)
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal mengunduh laporan'))
    } finally {
      setDownloading(false)
    }
  }

  if (user && !allowed) {
    return (
      <DashboardLayout>
        <ErrorState title="Akses ditolak" message="Laporan akurasi model hanya dapat dilihat oleh admin, admin tenant, dan agronom." />
      </DashboardLayout>
    )
  }

  const rows = report.data?.rows ?? []
  const s = report.data?.summary

  const stat = (label: string, value: string, hint: string) => (
    <Card className="border-2">
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Akurasi Model</PageTitle>
            <p className="mt-1 text-muted-foreground">Selisih fase (hari) dan hasil (%) antara prediksi model dan kenyataan</p>
          </div>
          <Button variant="outline" onClick={download} disabled={downloading || rows.length === 0}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Unduh XLSX
          </Button>
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acc-variety">Varietas</Label>
              <Select value={varId} onValueChange={setVarId}>
                <SelectTrigger id="acc-variety">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua varietas</SelectItem>
                  {varieties.data?.map((v) => (
                    <SelectItem key={v.var_id} value={v.var_id}>
                      {v.var_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-season">Musim</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger id="acc-season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua musim</SelectItem>
                  {seasons.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {s && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-live="polite">
            {stat('Run dibandingkan', formatNumber(s.runs), `${formatNumber(s.runs_with_phase)} punya data fase`)}
            {stat('Rata-rata selisih fase', s.mae_day === null ? '-' : `${formatNumber(s.mae_day)} hari`, 'nilai mutlak, semua fase yang teramati')}
            {stat('Rata-rata selisih hasil', s.mape_pct === null ? '-' : `${formatNumber(s.mape_pct)}%`, `${formatNumber(s.runs_with_yield)} petak sudah dipanen`)}
            {stat('Bias hasil', s.bias_pct === null ? '-' : `${signed(s.bias_pct)}%`, 'positif = prediksi terlalu tinggi')}
          </div>
        )}

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Per petak ({formatNumber(rows.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat laporan">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 w-full rounded bg-muted motion-safe:animate-pulse" />
                ))}
              </div>
            ) : report.isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => report.refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Target className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada run simulasi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Jalankan simulasi di halaman Digital Twin agar akurasinya bisa dihitung.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">Akurasi model per petak</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Petak</TableHead>
                      <TableHead className="font-bold">Musim</TableHead>
                      <TableHead className="font-bold">Varietas</TableHead>
                      <TableHead className="font-bold">Run</TableHead>
                      <TableHead className="font-bold">Selisih fase</TableHead>
                      <TableHead className="text-right font-bold">Prediksi (t/ha)</TableHead>
                      <TableHead className="text-right font-bold">Panen (t/ha)</TableHead>
                      <TableHead className="font-bold">Selisih vs panen</TableHead>
                      <TableHead className="text-right font-bold">Ubinan</TableHead>
                      <TableHead className="font-bold">Selisih vs ubinan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.plant_id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{r.plant_name ?? r.plant_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.season ?? '-'}</Badge>
                        </TableCell>
                        <TableCell>{r.variety ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{r.sim_date ? formatDateTime(r.sim_date, 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell className="text-sm">
                          {r.phases_compared === 0 ? (
                            <span className="text-muted-foreground">belum ada fase teramati</span>
                          ) : (
                            <details>
                              <summary className="cursor-pointer tabular-nums">
                                rata-rata {formatNumber(r.mean_abs_error_day ?? 0)} hari ({r.phases_compared} fase)
                              </summary>
                              <ul className="mt-1 space-y-0.5 tabular-nums">
                                {r.phase_errors.map((e) => (
                                  <li key={e.phase_id}>
                                    {e.name}: {signed(e.error_day, 0)} hari
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.pred_yield === null ? '-' : formatNumber(r.pred_yield)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.actual_yield === null ? '-' : formatNumber(r.actual_yield)}</TableCell>
                        <TableCell>
                          <ErrorBadge value={r.yield_error_pct} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.ubinan_yield === null ? '-' : formatNumber(r.ubinan_yield)}</TableCell>
                        <TableCell>
                          <ErrorBadge value={r.ubinan_error_pct} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Selisih fase = tanggal mulai prediksi dikurangi tanggal teramati (negatif = prediksi lebih awal). Selisih hasil = (prediksi - kenyataan) / kenyataan.
        </p>
      </div>
    </DashboardLayout>
  )
}
