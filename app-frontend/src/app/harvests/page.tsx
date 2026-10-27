'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Wheat } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canRecordActivities } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { HarvestFormDialog } from '@/components/harvests/harvest-form-dialog'
import { DeleteHarvestDialog } from '@/components/harvests/delete-harvest-dialog'

interface HarvestRow {
  hv_id: string
  plant_id: string
  hv_date: string
  hv_season: string | null
  hv_rotation: number | null
  hv_area: number | null
  hv_weight: number | null
  hv_moisture: number | null
  hv_weight_dry: number | null
  hv_yield: number | null
  hv_loss_pct: number | null
  hv_price: number | null
  hv_desc: string | null
}

export default function HarvestsPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canRecord = canRecordActivities(user)

  const [plantId, setPlantId] = useState('all')
  const [season, setSeason] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<HarvestRow | null>(null)
  const [deleting, setDeleting] = useState<HarvestRow | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (plantId !== 'all') p.plantId = plantId
    if (season !== 'all') p.season = season
    return p
  }, [plantId, season])

  const { data: harvests, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.harvests(activeTenantId), params],
    queryFn: async () => (await api.get('/harvests', { params })).data as HarvestRow[],
    enabled: !!activeTenantId,
  })
  const { data: plants } = useQuery({
    queryKey: [...queryKeys.plants(activeTenantId), 'all'],
    queryFn: async () => (await api.get('/plants')).data,
    enabled: !!activeTenantId,
  })

  const plantName = useMemo(() => new Map<string, string>((plants ?? []).map((p: any) => [p.plant_id, p.plant_name || p.plant_id])), [plants])
  const seasons = useMemo(
    () => [...new Set<string>((plants ?? []).map((p: any) => p.plant_season).filter(Boolean))].sort().reverse(),
    [plants],
  )

  const rows = harvests ?? []
  const totals = useMemo(() => {
    const area = rows.reduce((s, r) => s + (r.hv_area ?? 0), 0)
    const gkg = rows.reduce((s, r) => s + (r.hv_weight_dry ?? 0), 0)
    // weighted by area, not an average of per-row yields
    return { area, gkg, yield: area > 0 ? Math.round((gkg / 1000 / area) * 100) / 100 : null }
  }, [rows])

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (row: HarvestRow) => {
    setSelected(row)
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Panen</PageTitle>
            <p className="mt-1 text-muted-foreground">Hasil panen padi per petak dan musim</p>
          </div>
          {canRecord && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Catat Panen
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hv-plant">Tanaman</Label>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger id="hv-plant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tanaman</SelectItem>
                  {plants?.map((p: any) => (
                    <SelectItem key={p.plant_id} value={p.plant_id}>
                      {p.plant_name || p.plant_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hv-season">Musim</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger id="hv-season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua musim</SelectItem>
                  {seasons.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Daftar Panen ({formatNumber(rows.length)})</CardTitle>
              {rows.length > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                  Total {formatNumber(totals.gkg)} kg GKG · {formatNumber(totals.area)} ha
                  {totals.yield !== null ? ` · rata-rata ${formatNumber(totals.yield)} t/ha` : ''}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat panen">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 w-full rounded bg-muted motion-safe:animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => refetch()} />
              </div>
            ) : rows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">Daftar panen, diurutkan dari yang terbaru</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Tanggal</TableHead>
                      <TableHead className="font-bold">Tanaman</TableHead>
                      <TableHead className="font-bold">Musim</TableHead>
                      <TableHead className="text-right font-bold">Luas (ha)</TableHead>
                      <TableHead className="text-right font-bold">GKP (kg)</TableHead>
                      <TableHead className="text-right font-bold">Kadar air</TableHead>
                      <TableHead className="text-right font-bold">GKG (kg)</TableHead>
                      <TableHead className="text-right font-bold">t/ha</TableHead>
                      {canRecord && <TableHead className="text-right font-bold">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.hv_id} className="hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(r.hv_date, 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <div className="font-medium">{plantName.get(r.plant_id) ?? r.plant_id}</div>
                          {r.hv_desc && (
                            <p className="max-w-[16rem] truncate text-xs text-muted-foreground" title={r.hv_desc}>
                              {r.hv_desc}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.hv_season ?? '-'}</Badge>
                          {r.hv_rotation != null && r.hv_rotation > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">#{r.hv_rotation}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.hv_area != null ? formatNumber(r.hv_area) : '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.hv_weight != null ? formatNumber(r.hv_weight) : '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.hv_moisture != null ? `${formatNumber(r.hv_moisture)}%` : '-'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {r.hv_weight_dry != null ? formatNumber(r.hv_weight_dry) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{r.hv_yield != null ? formatNumber(r.hv_yield) : '-'}</TableCell>
                        {canRecord && (
                          <TableCell className="whitespace-nowrap text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDeleting(r)}>
                                Hapus
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Wheat className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada panen</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plantId !== 'all' || season !== 'all'
                    ? 'Coba ubah filter Anda'
                    : canRecord
                      ? 'Catat panen pertama setelah musim berakhir.'
                      : 'Belum ada panen yang dicatat.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTenantId && (
        <HarvestFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={activeTenantId}
          harvest={selected}
          mode={formMode}
        />
      )}
      <DeleteHarvestDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        harvest={deleting ? { ...deleting, plant_name: plantName.get(deleting.plant_id) } : null}
      />
    </DashboardLayout>
  )
}
