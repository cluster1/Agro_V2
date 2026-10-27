'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarClock, Plus, Repeat } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canManageSchedules } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { SCHEDULE_REPEAT, SCHEDULE_SOURCE, SCHEDULE_STATUS, isScheduleOpen, scheduleStatus } from '@/lib/schedule-status'
import { ScheduleFormDialog } from '@/components/schedules/schedule-form-dialog'
import { ScheduleConfirmDialog, type ScheduleAction } from '@/components/schedules/schedule-confirm-dialog'

interface ScheduleRow {
  sched_id: string
  plant_id: string
  cluster_id: string
  actype_id: string
  phase_id: string | null
  sched_title: string
  sched_desc: string | null
  sched_start_date: string
  sched_end_date: string
  sched_repeat: string
  sched_interval: number | null
  sched_repeat_until: string | null
  sched_plan_value: string | null
  sched_source: string
  sched_sts: number
}

const DAY_FORMAT = 'yyyy-MM-dd'
const RANGES: Record<string, { label: string; days?: number }> = {
  all: { label: 'Semua tanggal' },
  '7': { label: '7 hari ke depan', days: 7 },
  '30': { label: '30 hari ke depan', days: 30 },
}

export default function SchedulesPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canManage = canManageSchedules(user)

  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('all')
  const [plantId, setPlantId] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<ScheduleRow | null>(null)
  const [confirm, setConfirm] = useState<{ action: ScheduleAction; schedule: ScheduleRow } | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (status !== 'all') p.status = status
    if (plantId !== 'all') p.plantId = plantId
    const days = RANGES[range]?.days
    if (days) {
      const now = new Date()
      p.from = format(now, DAY_FORMAT)
      p.to = format(addDays(now, days), DAY_FORMAT)
    }
    return p
  }, [status, plantId, range])

  const { data: schedules, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.schedules(activeTenantId), params],
    queryFn: async () => (await api.get('/schedules', { params })).data as ScheduleRow[],
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

  const plantName = useMemo(() => new Map<string, string>((plants ?? []).map((p: any) => [p.plant_id, p.plant_name || p.plant_id])), [plants])
  const typeName = useMemo(() => new Map<string, string>((types ?? []).map((t: any) => [t.actype_id, t.actype_name])), [types])

  const rows = schedules ?? []
  const overdue = rows.filter((r) => r.sched_sts === 4).length

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (row: ScheduleRow) => {
    setSelected({ ...row, plant_name: plantName.get(row.plant_id) } as ScheduleRow)
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Jadwal</PageTitle>
            <p className="mt-1 text-muted-foreground">Rencana kegiatan budidaya per tanaman</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {overdue > 0 && (
              <Badge variant="destructive" className="px-3 py-1.5 text-sm tabular-nums" aria-live="polite">
                {formatNumber(overdue)} terlambat
              </Badge>
            )}
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Tambah Jadwal
              </Button>
            )}
          </div>
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sched-plant">Tanaman</Label>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger id="sched-plant">
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
              <Label htmlFor="sched-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="sched-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  {Object.entries(SCHEDULE_STATUS).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-range">Rentang mulai</Label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger id="sched-range">
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
            <CardTitle>Daftar Jadwal ({formatNumber(rows.length)})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat jadwal">
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
                  <caption className="sr-only">Daftar jadwal kegiatan, diurutkan dari waktu mulai terdekat</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Mulai</TableHead>
                      <TableHead className="font-bold">Kegiatan</TableHead>
                      <TableHead className="font-bold">Tanaman</TableHead>
                      <TableHead className="font-bold">Sumber</TableHead>
                      <TableHead className="font-bold">Perulangan</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      {canManage && <TableHead className="text-right font-bold">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const meta = scheduleStatus(r.sched_sts)
                      const Icon = meta.icon
                      const open = isScheduleOpen(r.sched_sts)
                      return (
                        <TableRow key={r.sched_id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatDateTime(r.sched_start_date, 'dd MMM yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.sched_title || typeName.get(r.actype_id) || r.actype_id}</div>
                            {(r.sched_plan_value || r.sched_desc) && (
                              <p className="max-w-[18rem] truncate text-xs text-muted-foreground" title={r.sched_desc ?? undefined}>
                                {[r.sched_plan_value && `Rencana: ${r.sched_plan_value}`, r.sched_desc].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{plantName.get(r.plant_id) ?? r.plant_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{SCHEDULE_SOURCE[r.sched_source] ?? r.sched_source}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {r.sched_repeat && r.sched_repeat !== 'NONE' ? (
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                                {SCHEDULE_REPEAT[r.sched_repeat]}
                                {r.sched_interval && r.sched_interval > 1 ? ` /${r.sched_interval}` : ''}
                                {r.sched_repeat_until ? ` s.d. ${formatDateTime(r.sched_repeat_until, 'dd MMM')}` : ''}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant} className="gap-1">
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {meta.label}
                            </Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="whitespace-nowrap text-right">
                              {open ? (
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                                    Edit
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => setConfirm({ action: 'cancel', schedule: r })}>
                                    Batalkan
                                  </Button>
                                </div>
                              ) : r.sched_sts === 3 ? (
                                <Button variant="outline" size="sm" onClick={() => setConfirm({ action: 'delete', schedule: r })}>
                                  Hapus
                                </Button>
                              ) : null}
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
                <CalendarClock className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Belum ada jadwal</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status !== 'all' || plantId !== 'all' || range !== 'all'
                    ? 'Coba ubah filter Anda'
                    : 'Jadwal templat dibuat otomatis saat tanaman ditambahkan.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTenantId && (
        <ScheduleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={activeTenantId}
          schedule={selected}
          mode={formMode}
        />
      )}
      <ScheduleConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={confirm?.action ?? 'cancel'}
        schedule={confirm?.schedule ?? null}
      />
    </DashboardLayout>
  )
}
