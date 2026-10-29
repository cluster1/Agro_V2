'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wheat } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
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
import type { ProductionRow, ProductionSummary } from '@/lib/farm-reports'

const ALL = 'all'

export default function ProductionReportPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const allowed = canViewReports(user)

  const [siteId, setSiteId] = useState(ALL)
  const [season, setSeason] = useState(ALL)
  const [varId, setVarId] = useState(ALL)
  const [page, setPage] = useState(1)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (siteId !== ALL) p.siteId = siteId
    if (season !== ALL) p.season = season
    if (varId !== ALL) p.varId = varId
    return p
  }, [siteId, season, varId])

  const report = useQuery({
    queryKey: [...queryKeys.productionReport(activeTenantId), params],
    queryFn: async () => (await api.get('/reports/production', { params })).data as { rows: ProductionRow[]; summary: ProductionSummary },
    enabled: allowed && !!activeTenantId,
  })
  const sites = useQuery({
    queryKey: queryKeys.sites(activeTenantId),
    queryFn: async () => (await api.get('/sites')).data as { site_id: string; site_name: string }[],
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

  const rows = report.data?.rows ?? []
  const s = report.data?.summary
  const currentPage = clampPage(page, rows.length)
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [rows, currentPage])

  // filter berubah: kembali ke halaman pertama
  const pick = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPage(1)
  }

  if (user && !allowed) {
    return (
      <DashboardLayout>
        <ErrorState title="Akses ditolak" message="Laporan produksi hanya dapat dilihat oleh admin, admin tenant, dan agronom." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Laporan Produksi</PageTitle>
            <p className="mt-1 text-muted-foreground">Hasil panen per petak per musim: luas, GKP, GKG, dan produktivitas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadButton url="/reports/production" params={params} format="xlsx" filename="produksi.xlsx" label="Unduh XLSX" disabled={rows.length === 0} />
            <DownloadButton url="/reports/production" params={params} format="pdf" filename="produksi.pdf" label="Unduh PDF" disabled={rows.length === 0} />
          </div>
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="prod-site">Site</Label>
              <Select value={siteId} onValueChange={pick(setSiteId)}>
                <SelectTrigger id="prod-site">
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
              <Label htmlFor="prod-season">Musim</Label>
              <Select value={season} onValueChange={pick(setSeason)}>
                <SelectTrigger id="prod-season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua musim</SelectItem>
                  {seasons.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-variety">Varietas</Label>
              <Select value={varId} onValueChange={pick(setVarId)}>
                <SelectTrigger id="prod-variety">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Semua varietas</SelectItem>
                  {varieties.data?.map((v) => (
                    <SelectItem key={v.var_id} value={v.var_id}>
                      {v.var_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {s && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-live="polite">
            <ReportStat label="Petak dipanen" value={formatNumber(s.plots)} hint={`${formatNumber(s.area_ha)} ha luas panen`} />
            <ReportStat label="GKP" value={`${formatNumber(s.gkp_kg)} kg`} hint="gabah kering panen" />
            <ReportStat label="GKG" value={`${formatNumber(s.gkg_kg)} kg`} hint="gabah kering giling (kadar air 14%)" />
            <ReportStat label="Hasil rata-rata" value={s.yield_t_ha === null ? '-' : `${formatNumber(s.yield_t_ha)} t/ha`} hint="berbobot luas, dari panen yang sudah ditimbang" />
          </div>
        )}

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Per petak per musim ({formatNumber(rows.length)})</CardTitle>
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
                <Wheat className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada data panen</h2>
                <p className="mt-1 text-sm text-muted-foreground">Catat panen di halaman Panen, atau ubah filter di atas.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <caption className="sr-only">Produksi per petak per musim</caption>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Petak</TableHead>
                        <TableHead className="font-bold">Site</TableHead>
                        <TableHead className="font-bold">Musim</TableHead>
                        <TableHead className="font-bold">Varietas</TableHead>
                        <TableHead className="font-bold">Panen terakhir</TableHead>
                        <TableHead className="text-right font-bold">Luas (ha)</TableHead>
                        <TableHead className="text-right font-bold">GKP (kg)</TableHead>
                        <TableHead className="text-right font-bold">GKG (kg)</TableHead>
                        <TableHead className="text-right font-bold">Hasil (t/ha)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((r) => (
                        <TableRow key={`${r.plant_id}|${r.season}`} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{r.plant_name ?? r.plant_id}</TableCell>
                          <TableCell>{r.site_name ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.season ?? '-'}</Badge>
                          </TableCell>
                          <TableCell>{r.variety ?? '-'}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(r.last_date, 'dd MMM yyyy')}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.area_ha)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.gkp_kg)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.gkg_kg)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.yield_t_ha)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={currentPage} total={rows.length} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          GKG = GKP x (100 - kadar air) / (100 - 14). Hasil (t/ha) = total GKG / total luas dari panen yang sudah ditimbang. Panen tanpa bobot GKG tetap dihitung pada luas.
        </p>
      </div>
    </DashboardLayout>
  )
}
