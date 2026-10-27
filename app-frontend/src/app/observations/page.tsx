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
import { Eye, Plus } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canRecordActivities, canVerifyObservations } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import {
  OBSERVATION_SOURCE,
  OBSERVATION_STATUS,
  observationStatus,
  splitSymptoms,
  symptomLabel,
} from '@/lib/observation'
import { ObservationFormDialog } from '@/components/observations/observation-form-dialog'
import { ReviewObservationDialog, type ReviewAction } from '@/components/observations/review-observation-dialog'

interface ObservationRow {
  obs_id: string
  plant_id: string
  phase_id: string | null
  obs_date: string
  obs_age: number | null
  obs_sample_n: number | null
  obs_height: number | null
  obs_tiller: number | null
  obs_bwd: number | null
  obs_panicle: number | null
  obs_grain: number | null
  obs_filled_pct: number | null
  obs_phase_pct: number | null
  obs_pest_name: string | null
  obs_pest_pct: number | null
  obs_symptom: string | null
  obs_source: string | null
  obs_confidence: number | null
  obs_desc: string | null
  obs_sts: number
}

const REJECT_PREFIX = 'Ditolak: '

/** Ringkasan hasil pengamatan yang terisi, mis. "Tinggi 32 cm · Anakan 8". */
function summary(r: ObservationRow): string[] {
  const parts: (string | false | null)[] = [
    r.obs_height != null && `Tinggi ${r.obs_height} cm`,
    r.obs_tiller != null && `Anakan ${r.obs_tiller}`,
    r.obs_bwd != null && `BWD ${String(r.obs_bwd).replace('.', ',')}`,
    r.obs_panicle != null && `Malai ${r.obs_panicle}`,
    r.obs_grain != null && `Gabah/malai ${r.obs_grain}`,
    r.obs_filled_pct != null && `Isi ${r.obs_filled_pct}%`,
    r.obs_phase_pct != null && `Fase ${r.obs_phase_pct}%`,
    r.obs_pest_name && `${r.obs_pest_name}${r.obs_pest_pct != null ? ` ${r.obs_pest_pct}%` : ''}`,
  ]
  return parts.filter(Boolean) as string[]
}

export default function ObservationsPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canInput = canRecordActivities(user)
  const canVerify = canVerifyObservations(user)

  const [plantId, setPlantId] = useState('all')
  const [status, setStatus] = useState(canVerify && !canInput ? '1' : 'all')
  const [source, setSource] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<any>(null)
  const [review, setReview] = useState<{ action: ReviewAction; row: ObservationRow } | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (plantId !== 'all') p.plantId = plantId
    if (status !== 'all') p.status = status
    if (source !== 'all') p.source = source
    return p
  }, [plantId, status, source])

  const { data: observations, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.observations(activeTenantId), params],
    queryFn: async () => (await api.get('/observations', { params })).data as ObservationRow[],
    enabled: !!activeTenantId,
  })
  // Queue size is independent of the active filters.
  const { data: queue } = useQuery({
    queryKey: [...queryKeys.observations(activeTenantId), 'queue'],
    queryFn: async () => (await api.get('/observations', { params: { status: 1 } })).data as ObservationRow[],
    enabled: !!activeTenantId && canVerify,
  })
  const { data: plants } = useQuery({
    queryKey: [...queryKeys.plants(activeTenantId), 'all'],
    queryFn: async () => (await api.get('/plants')).data,
    enabled: !!activeTenantId,
  })
  const { data: phases } = useQuery({
    queryKey: queryKeys.ref('phases', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/phases', { params: { ptype_id: 'PT-PADI' } })).data,
    staleTime: 10 * 60 * 1000,
  })

  const plantName = useMemo(() => new Map<string, string>((plants ?? []).map((p: any) => [p.plant_id, p.plant_name || p.plant_id])), [plants])
  const phaseName = useMemo(() => new Map<string, string>((phases ?? []).map((p: any) => [p.phase_id, p.phase_name])), [phases])

  const rows = observations ?? []
  const waiting = queue?.length ?? 0

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (row: ObservationRow) => {
    setSelected({ ...row, plant_name: plantName.get(row.plant_id) })
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Observasi</PageTitle>
            <p className="mt-1 text-muted-foreground">Pengamatan pertumbuhan dan kondisi tanaman</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canVerify && waiting > 0 && (
              <Button variant="outline" onClick={() => setStatus('1')} aria-label={`${waiting} observasi menunggu verifikasi; tampilkan antrean`}>
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                <span className="tabular-nums">{formatNumber(waiting)}</span>&nbsp;menunggu verifikasi
              </Button>
            )}
            {canInput && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Catat Observasi
              </Button>
            )}
          </div>
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="obs-plant">Tanaman</Label>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger id="obs-plant">
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
              <Label htmlFor="obs-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="obs-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  {Object.entries(OBSERVATION_STATUS).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-source">Sumber</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="obs-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua sumber</SelectItem>
                  {Object.entries(OBSERVATION_SOURCE).map(([value, label]) => (
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
            <CardTitle>Daftar Observasi ({formatNumber(rows.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat observasi">
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
                  <caption className="sr-only">Daftar observasi tanaman, diurutkan dari yang terbaru</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Waktu</TableHead>
                      <TableHead className="font-bold">Tanaman</TableHead>
                      <TableHead className="text-right font-bold">HST</TableHead>
                      <TableHead className="font-bold">Fase</TableHead>
                      <TableHead className="font-bold">Hasil pengamatan</TableHead>
                      <TableHead className="font-bold">Sumber</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      {(canInput || canVerify) && <TableHead className="text-right font-bold">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const meta = observationStatus(r.obs_sts)
                      const Icon = meta.icon
                      const symptoms = splitSymptoms(r.obs_symptom)
                      const rejected = r.obs_sts === 3 && r.obs_desc?.startsWith(REJECT_PREFIX)
                      const editable = canInput && r.obs_sts !== 2
                      const reviewable = canVerify && r.obs_sts === 1
                      return (
                        <TableRow key={r.obs_id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatDateTime(r.obs_date, 'dd MMM yyyy HH:mm')}
                          </TableCell>
                          <TableCell>{plantName.get(r.plant_id) ?? r.plant_id}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.obs_age ?? '-'}</TableCell>
                          <TableCell className="text-sm">{r.phase_id ? phaseName.get(r.phase_id) ?? r.phase_id : '-'}</TableCell>
                          <TableCell>
                            <div className="text-sm tabular-nums">{summary(r).join(' · ') || '-'}</div>
                            {symptoms.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {symptoms.map((c) => (
                                  <Badge key={c} variant="outline" className="text-xs">
                                    {symptomLabel(c)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {r.obs_desc && (
                              <p
                                className={`mt-1 max-w-[22rem] text-xs ${rejected ? 'font-medium text-destructive' : 'truncate text-muted-foreground'}`}
                                title={r.obs_desc}
                              >
                                {r.obs_desc}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {OBSERVATION_SOURCE[r.obs_source ?? ''] ?? r.obs_source ?? '-'}
                            {r.obs_source === 'AI' && r.obs_confidence != null && (
                              <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                                ({Math.round(r.obs_confidence * 100)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant} className="gap-1 whitespace-nowrap">
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {meta.label}
                            </Badge>
                          </TableCell>
                          {(canInput || canVerify) && (
                            <TableCell className="whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                {reviewable && (
                                  <>
                                    <Button size="sm" onClick={() => setReview({ action: 'verify', row: r })}>
                                      Verifikasi
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setReview({ action: 'reject', row: r })}>
                                      Tolak
                                    </Button>
                                  </>
                                )}
                                {editable && (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                                      Edit
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setReview({ action: 'delete', row: r })}>
                                      Hapus
                                    </Button>
                                  </>
                                )}
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
                <Eye className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada observasi</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plantId !== 'all' || status !== 'all' || source !== 'all'
                    ? 'Coba ubah filter Anda'
                    : canInput
                      ? 'Catat pengamatan pertama di lapangan.'
                      : 'Belum ada observasi yang dicatat.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTenantId && (
        <ObservationFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={activeTenantId}
          observation={selected}
          mode={formMode}
        />
      )}
      <ReviewObservationDialog
        open={!!review}
        onOpenChange={(open) => !open && setReview(null)}
        action={review?.action ?? 'verify'}
        observation={review ? { obs_id: review.row.obs_id, plant_name: plantName.get(review.row.plant_id) } : null}
      />
    </DashboardLayout>
  )
}
