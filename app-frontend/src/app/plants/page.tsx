'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Sprout } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canManagePlants } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { PlantFormDialog } from '@/components/plants/plant-form-dialog'
import { ClosePlantDialog } from '@/components/plants/close-plant-dialog'

interface PlantRow {
  plant_id: string
  cluster_id: string
  var_id: string
  phase_id: string | null
  plant_name: string
  plant_variety: string
  plant_season: string
  plant_date: string
  plant_sow_date: string
  plant_harvest_date: string | null
  plant_area: number
  plant_count: number | null
  plant_sts: number
}

const DAY_MS = 86_400_000
const formatDate = (value: string | null | undefined) => formatDateTime(value, 'dd MMM yyyy')

/** Hari setelah tanam (HST), dihitung dari tanggal tanam. */
function hst(plantDate: string | null | undefined): number | null {
  if (!plantDate) return null
  const t = Date.parse(`${String(plantDate).slice(0, 10)}T00:00:00Z`)
  if (isNaN(t)) return null
  const now = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((now - t) / DAY_MS)
}

export default function PlantsPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canManage = canManagePlants(user)

  const [status, setStatus] = useState<string>('1')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<any>(null)
  const [closeOpen, setCloseOpen] = useState(false)

  const { data: plants, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.plants(activeTenantId), status],
    queryFn: async () => {
      const response = await api.get('/plants', { params: status === 'all' ? {} : { status } })
      return response.data as PlantRow[]
    },
    enabled: !!activeTenantId,
  })

  const { data: clusters } = useQuery({
    queryKey: queryKeys.clusters(activeTenantId),
    queryFn: async () => (await api.get('/clusters')).data,
    enabled: !!activeTenantId,
  })

  const { data: phases } = useQuery({
    queryKey: queryKeys.ref('phases', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/phases', { params: { ptype_id: 'PT-PADI' } })).data,
    staleTime: 10 * 60 * 1000,
  })

  const clusterName = useMemo(
    () => new Map<string, string>((clusters ?? []).map((c: any) => [c.cluster_id, c.cluster_name])),
    [clusters],
  )
  const phaseById = useMemo(() => new Map<string, any>((phases ?? []).map((p: any) => [p.phase_id, p])), [phases])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (plants ?? []).filter(
      (p) =>
        !term ||
        p.plant_name?.toLowerCase().includes(term) ||
        p.plant_variety?.toLowerCase().includes(term) ||
        p.plant_season?.toLowerCase().includes(term) ||
        clusterName.get(p.cluster_id)?.toLowerCase().includes(term),
    )
  }, [plants, search, clusterName])

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (plant: PlantRow) => {
    setSelected({ ...plant, cluster_name: clusterName.get(plant.cluster_id) })
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Tanaman</PageTitle>
            <p className="mt-1 text-muted-foreground">Petak padi per musim tanam</p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Tanaman
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="plants-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="plants-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Aktif</SelectItem>
                  <SelectItem value="0">Ditutup</SelectItem>
                  <SelectItem value="all">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="plants-search">Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="plants-search"
                  type="search"
                  placeholder="Cari nama, petak, varietas, atau musim..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>Daftar Tanaman ({formatNumber(rows.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat tanaman">
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
                  <caption className="sr-only">Daftar tanaman padi per petak dan musim</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Tanaman</TableHead>
                      <TableHead className="font-bold">Petak</TableHead>
                      <TableHead className="font-bold">Varietas</TableHead>
                      <TableHead className="font-bold">Musim</TableHead>
                      <TableHead className="font-bold">Tanam</TableHead>
                      <TableHead className="text-right font-bold">HST</TableHead>
                      <TableHead className="text-right font-bold">Luas (ha)</TableHead>
                      <TableHead className="font-bold">Fase</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      {canManage && <TableHead className="text-right font-bold">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => {
                      const age = hst(p.plant_date)
                      const phase = p.phase_id ? phaseById.get(p.phase_id) : undefined
                      const active = p.plant_sts === 1
                      return (
                        <TableRow key={p.plant_id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{p.plant_name || p.plant_id}</TableCell>
                          <TableCell>{clusterName.get(p.cluster_id) ?? p.cluster_id}</TableCell>
                          <TableCell>{p.plant_variety || p.var_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.plant_season}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{formatDate(p.plant_date)}</TableCell>
                          <TableCell className="text-right tabular-nums">{active && age !== null ? age : '-'}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.plant_area)}</TableCell>
                          <TableCell>
                            {phase ? (
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full border"
                                  style={{ backgroundColor: phase.phase_color ?? undefined }}
                                  aria-hidden="true"
                                />
                                {phase.phase_name}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={active ? 'success' : 'secondary'}>{active ? 'Aktif' : 'Ditutup'}</Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="whitespace-nowrap text-right">
                              {active ? (
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelected(p)
                                      setCloseOpen(true)
                                    }}
                                  >
                                    Tutup musim
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {p.plant_harvest_date ? formatDate(p.plant_harvest_date) : ''}
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Sprout className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada tanaman</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canManage ? 'Tambahkan tanaman pertama untuk sebuah petak.' : 'Belum ada tanaman pada filter ini.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTenantId && (
        <PlantFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={activeTenantId}
          plant={selected}
          mode={formMode}
        />
      )}
      <ClosePlantDialog open={closeOpen} onOpenChange={setCloseOpen} plant={selected} />
    </DashboardLayout>
  )
}
