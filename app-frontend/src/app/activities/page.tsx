'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ClipboardCheck, Plus } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canRecordActivities } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { ActivityFormDialog } from '@/components/activities/activity-form-dialog'
import { DeleteActivityDialog } from '@/components/activities/delete-activity-dialog'

interface ActivityRow {
  pact_id: string
  plant_id: string
  actype_id: string
  sched_id: string | null
  phase_id: string | null
  pact_date: string
  pact_value: string | null
  unit_id: string | null
  mat_id: string | null
  pact_material: string | null
  pact_worker: number | null
  pact_cost: number | null
  pact_desc: string | null
  pact_source: string | null
  nutrient_input: { n_kg_ha: number; p2o5_kg_ha: number; k2o_kg_ha: number } | null
}

const DAY_FORMAT = 'yyyy-MM-dd'
const RANGES: Record<string, { label: string; days?: number }> = {
  '30': { label: '30 hari terakhir', days: 30 },
  '90': { label: '90 hari terakhir', days: 90 },
  all: { label: 'Semua tanggal' },
}

export default function ActivitiesPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canRecord = canRecordActivities(user)

  const [plantId, setPlantId] = useState('all')
  const [actypeId, setActypeId] = useState('all')
  const [range, setRange] = useState('30')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<any>(null)
  const [deleting, setDeleting] = useState<ActivityRow | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (plantId !== 'all') p.plantId = plantId
    if (actypeId !== 'all') p.actypeId = actypeId
    const days = RANGES[range]?.days
    if (days) p.from = format(subDays(new Date(), days), DAY_FORMAT)
    return p
  }, [plantId, actypeId, range])

  const { data: activities, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.activities(activeTenantId), params],
    queryFn: async () => (await api.get('/activities', { params })).data as ActivityRow[],
    enabled: !!activeTenantId,
  })
  const { data: plants } = useQuery({
    queryKey: [...queryKeys.plants(activeTenantId), 'all'],
    queryFn: async () => (await api.get('/plants')).data,
    enabled: !!activeTenantId,
  })
  const { data: types } = useQuery({
    queryKey: queryKeys.ref('activity-types', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/activity-types', { params: { ptype_id: 'PT-PADI' } })).data,
    staleTime: 10 * 60 * 1000,
  })
  const { data: units } = useQuery({
    queryKey: queryKeys.ref('units'),
    queryFn: async () => (await api.get('/ref/units')).data,
    staleTime: 10 * 60 * 1000,
  })
  const { data: phases } = useQuery({
    queryKey: queryKeys.ref('phases', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/phases', { params: { ptype_id: 'PT-PADI' } })).data,
    staleTime: 10 * 60 * 1000,
  })

  const plantName = useMemo(() => new Map<string, string>((plants ?? []).map((p: any) => [p.plant_id, p.plant_name || p.plant_id])), [plants])
  const typeName = useMemo(() => new Map<string, string>((types ?? []).map((t: any) => [t.actype_id, t.actype_name])), [types])
  const unitSymbol = useMemo(() => new Map<string, string>((units ?? []).map((u: any) => [u.unit_id, u.unit_symbol || u.unit_name])), [units])
  const phaseName = useMemo(() => new Map<string, string>((phases ?? []).map((p: any) => [p.phase_id, p.phase_name])), [phases])

  const rows = activities ?? []
  const totalCost = rows.reduce((sum, r) => sum + (r.pact_cost ?? 0), 0)

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (row: ActivityRow) => {
    setSelected({ ...row, plant_name: plantName.get(row.plant_id) })
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Kegiatan</PageTitle>
            <p className="mt-1 text-muted-foreground">Realisasi kegiatan budidaya di lapangan</p>
          </div>
          {canRecord && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Catat Kegiatan
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="act-plant">Tanaman</Label>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger id="act-plant">
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
              <Label htmlFor="act-type">Jenis kegiatan</Label>
              <Select value={actypeId} onValueChange={setActypeId}>
                <SelectTrigger id="act-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  {types?.map((t: any) => (
                    <SelectItem key={t.actype_id} value={t.actype_id}>
                      {t.actype_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-range">Rentang</Label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger id="act-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RANGES).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
              <CardTitle>Daftar Kegiatan ({formatNumber(rows.length)})</CardTitle>
              {rows.length > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums">Total biaya: Rp {formatNumber(totalCost)}</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat kegiatan">
                {[...Array(5)].map((_, i) => (
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
                  <caption className="sr-only">Daftar realisasi kegiatan, diurutkan dari yang terbaru</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Waktu</TableHead>
                      <TableHead className="font-bold">Kegiatan</TableHead>
                      <TableHead className="font-bold">Tanaman</TableHead>
                      <TableHead className="font-bold">Fase</TableHead>
                      <TableHead className="text-right font-bold">Jumlah</TableHead>
                      <TableHead className="font-bold">Bahan</TableHead>
                      <TableHead className="font-bold">Hara masuk (kg/ha)</TableHead>
                      <TableHead className="text-right font-bold">Biaya (Rp)</TableHead>
                      {canRecord && <TableHead className="text-right font-bold">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const n = r.nutrient_input
                      return (
                        <TableRow key={r.pact_id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatDateTime(r.pact_date, 'dd MMM yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{typeName.get(r.actype_id) ?? r.actype_id}</div>
                            {r.pact_desc && (
                              <p className="max-w-[16rem] truncate text-xs text-muted-foreground" title={r.pact_desc}>
                                {r.pact_desc}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{plantName.get(r.plant_id) ?? r.plant_id}</TableCell>
                          <TableCell className="text-sm">{r.phase_id ? phaseName.get(r.phase_id) ?? r.phase_id : '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            {r.pact_value ? `${r.pact_value} ${r.unit_id ? unitSymbol.get(r.unit_id) ?? '' : ''}` : '-'}
                          </TableCell>
                          <TableCell>{r.pact_material ?? '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm tabular-nums">
                            {n ? (
                              <span>
                                N {n.n_kg_ha} · P₂O₅ {n.p2o5_kg_ha} · K₂O {n.k2o_kg_ha}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.pact_cost != null ? formatNumber(r.pact_cost) : '-'}</TableCell>
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
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <ClipboardCheck className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada kegiatan</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plantId !== 'all' || actypeId !== 'all' || range !== '30'
                    ? 'Coba ubah filter Anda'
                    : canRecord
                      ? 'Catat kegiatan pertama dari jadwal atau secara langsung.'
                      : 'Belum ada kegiatan yang dicatat.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTenantId && (
        <ActivityFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={activeTenantId}
          activity={selected}
          mode={formMode}
        />
      )}
      <DeleteActivityDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        activity={deleting ? { ...deleting, actype_name: typeName.get(deleting.actype_id) } : null}
      />
    </DashboardLayout>
  )
}
