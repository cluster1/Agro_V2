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
import { FlaskConical, Plus } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canManageSoil, canViewSoil } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { DRAINAGE_LABEL, NUTRIENT_STATUS, type NutrientStatus } from '@/lib/soil'
import { SoilFormDialog } from '@/components/soil/soil-form-dialog'
import { DeleteSoilDialog } from '@/components/soil/delete-soil-dialog'

interface SoilRow {
  soil_id: string
  cluster_id: string
  plant_id: string | null
  soil_sample_code: string | null
  soil_sample_date: string
  soil_depth_top: number | null
  soil_depth_bottom: number | null
  soil_lab: string | null
  soil_type: string | null
  soil_texture: string | null
  soil_ph_h2o: number | null
  soil_c_org: number | null
  soil_p_avail: number | null
  soil_p_method: string | null
  soil_k_exch: number | null
  soil_cec: number | null
  soil_drainage: string | null
  soil_land_class: string | null
  p_status: NutrientStatus | null
  k_status: NutrientStatus | null
}

function StatusBadge({ status }: { status: NutrientStatus | null }) {
  if (!status) return <span className="text-muted-foreground">-</span>
  const meta = NUTRIENT_STATUS[status]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

const num = (v: number | null | undefined, unit = '') => (v == null ? '-' : `${formatNumber(v)}${unit}`)

export default function SoilPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canView = canViewSoil(user)
  const canManage = canManageSoil(user)

  const [clusterId, setClusterId] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<any>(null)
  const [deleting, setDeleting] = useState<SoilRow | null>(null)

  const params = useMemo(() => (clusterId !== 'all' ? { clusterId } : {}), [clusterId])

  const { data: profiles, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.soilProfiles(activeTenantId), params],
    queryFn: async () => (await api.get('/soil-profiles', { params })).data as SoilRow[],
    enabled: !!activeTenantId && canView,
  })
  const { data: clusters } = useQuery({
    queryKey: queryKeys.clusters(activeTenantId),
    queryFn: async () => (await api.get('/clusters')).data,
    enabled: !!activeTenantId && canView,
  })

  const clusterName = useMemo(() => new Map<string, string>((clusters ?? []).map((c: any) => [c.cluster_id, c.cluster_name])), [clusters])
  const rows = profiles ?? []

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (row: SoilRow) => {
    setSelected({ ...row, cluster_name: clusterName.get(row.cluster_id) })
    setFormMode('edit')
    setFormOpen(true)
  }

  if (user && !canView) {
    return (
      <DashboardLayout>
        <ErrorState
          title="Akses ditolak"
          message="Profil tanah hanya dapat dilihat oleh admin, admin tenant, dan agronom."
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Profil Tanah</PageTitle>
            <p className="mt-1 text-muted-foreground">Hasil uji laboratorium tanah per petak</p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Profil Tanah
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="soil-cluster">Petak</Label>
              <Select value={clusterId} onValueChange={setClusterId}>
                <SelectTrigger id="soil-cluster">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua petak</SelectItem>
                  {clusters?.map((c: any) => (
                    <SelectItem key={c.cluster_id} value={c.cluster_id}>
                      {c.cluster_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Daftar Profil Tanah ({formatNumber(rows.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat profil tanah">
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
                  <caption className="sr-only">Daftar hasil uji tanah, diurutkan dari tanggal sampling terbaru</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Sampling</TableHead>
                      <TableHead className="font-bold">Petak</TableHead>
                      <TableHead className="font-bold">Tanah</TableHead>
                      <TableHead className="text-right font-bold">pH H₂O</TableHead>
                      <TableHead className="text-right font-bold">C-org</TableHead>
                      <TableHead className="text-right font-bold">P tersedia</TableHead>
                      <TableHead className="font-bold">Status P</TableHead>
                      <TableHead className="text-right font-bold">K dd</TableHead>
                      <TableHead className="font-bold">Status K</TableHead>
                      <TableHead className="font-bold">Drainase</TableHead>
                      {canManage && <TableHead className="text-right font-bold">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.soil_id} className="hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap tabular-nums">
                          <div>{formatDateTime(r.soil_sample_date, 'dd MMM yyyy')}</div>
                          {r.soil_sample_code && <div className="text-xs text-muted-foreground">{r.soil_sample_code}</div>}
                        </TableCell>
                        <TableCell>{clusterName.get(r.cluster_id) ?? r.cluster_id}</TableCell>
                        <TableCell className="text-sm">
                          <div>{r.soil_type ?? '-'}</div>
                          {r.soil_texture && <div className="text-xs text-muted-foreground">{r.soil_texture}</div>}
                          {r.soil_depth_bottom != null && (
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {r.soil_depth_top ?? 0}-{r.soil_depth_bottom} cm
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.soil_ph_h2o)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.soil_c_org, '%')}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {num(r.soil_p_avail)}
                          {r.soil_p_method && <span className="ml-1 text-xs text-muted-foreground">{r.soil_p_method}</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.p_status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.soil_k_exch)}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.k_status} />
                        </TableCell>
                        <TableCell className="text-sm">{r.soil_drainage ? DRAINAGE_LABEL[r.soil_drainage] ?? r.soil_drainage : '-'}</TableCell>
                        {canManage && (
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
                <FlaskConical className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada profil tanah</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {clusterId !== 'all'
                    ? 'Coba ubah filter Anda'
                    : canManage
                      ? 'Tambahkan hasil uji lab pertama. Tanpa data lab, status hara dianggap sedang.'
                      : 'Belum ada hasil uji tanah.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTenantId && (
        <SoilFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={activeTenantId}
          profile={selected}
          mode={formMode}
        />
      )}
      <DeleteSoilDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        profile={deleting ? { ...deleting, cluster_name: clusterName.get(deleting.cluster_id) } : null}
      />
    </DashboardLayout>
  )
}
