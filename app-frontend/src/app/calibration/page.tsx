'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Loader2, SlidersHorizontal } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { canCalibrate } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { SOURCE_LABEL, signed, type ApplyResult, type CalibrationReport } from '@/lib/calibration'

const num = (v: number | null | undefined) => (v === null || v === undefined ? '-' : formatNumber(v))

export default function CalibrationPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const allowed = canCalibrate(user)

  const [varId, setVarId] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)

  const varieties = useQuery({
    queryKey: queryKeys.ref('varieties', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/varieties', { params: { ptype_id: 'PT-PADI' } })).data as { var_id: string; var_name: string }[],
    enabled: allowed,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (!varId && varieties.data?.length) setVarId(varieties.data[0].var_id)
  }, [varId, varieties.data])

  const report = useQuery({
    queryKey: queryKeys.calibration(varId, activeTenantId),
    queryFn: async () => (await api.get(`/calibration/varieties/${varId}`)).data as CalibrationReport,
    enabled: allowed && !!varId && !!activeTenantId,
  })

  const phases = useMemo(() => report.data?.phases ?? [], [report.data])

  // pre-select every phase that has a proposal whenever the report changes
  useEffect(() => {
    setPicked(new Set((report.data?.phases ?? []).filter((p) => p.proposal).map((p) => p.phase_id)))
  }, [report.data])

  const apply = useMutation({
    mutationFn: async () => (await api.post(`/calibration/varieties/${varId}/apply`, { phase_ids: [...picked] })).data as ApplyResult,
    onSuccess: (data) => {
      setConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['calibration'] })
      queryClient.invalidateQueries({ queryKey: ['ref'] })
      if (data.applied.length) toast.success(`${data.applied.length} fase dikalibrasi`)
      data.skipped.forEach((s) => toast.warning(`${s.phase_id}: ${s.reason}`))
      if (!data.applied.length && !data.skipped.length) toast.info('Tidak ada perubahan')
    },
    onError: (error: any) => {
      setConfirm(false)
      toast.error(apiErrorMessage(error, 'Gagal menerapkan kalibrasi'))
    },
  })

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  if (user && !allowed) {
    return (
      <DashboardLayout>
        <ErrorState title="Akses ditolak" message="Kalibrasi model hanya dapat dilakukan oleh admin dan agronom." />
      </DashboardLayout>
    )
  }

  const minPlots = report.data?.min_plots ?? 3

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <PageTitle>Kalibrasi Model</PageTitle>
          <p className="mt-1 text-muted-foreground">
            Bandingkan estimasi fase varietas dengan fase yang teramati di lapangan, lalu terapkan usulan
          </p>
        </div>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="cal-variety">Varietas</Label>
              <Select value={varId ?? undefined} onValueChange={setVarId}>
                <SelectTrigger id="cal-variety">
                  <SelectValue placeholder="Pilih varietas" />
                </SelectTrigger>
                <SelectContent>
                  {varieties.data?.map((v) => (
                    <SelectItem key={v.var_id} value={v.var_id}>
                      {v.var_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Hanya observasi terverifikasi dengan minimal 50% populasi pada fase tersebut yang dihitung. Usulan baru muncul bila
              minimal {minPlots} petak teramati. Perubahan berlaku untuk varietas ini di semua tenant.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Fase {report.data?.variety.name ?? ''}</CardTitle>
              <Button onClick={() => setConfirm(true)} disabled={picked.size === 0 || apply.isPending}>
                <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
                Terapkan {picked.size} usulan
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {report.isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat kalibrasi">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 w-full rounded bg-muted motion-safe:animate-pulse" />
                ))}
              </div>
            ) : report.isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => report.refetch()} />
              </div>
            ) : phases.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Varietas ini belum punya fase varietas.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">Estimasi dan fase teramati per fase varietas</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"><span className="sr-only">Detail</span></TableHead>
                      <TableHead className="font-bold">Fase</TableHead>
                      <TableHead className="font-bold">Sumber</TableHead>
                      <TableHead className="text-right font-bold">Estimasi umur</TableHead>
                      <TableHead className="text-right font-bold">Estimasi GDD</TableHead>
                      <TableHead className="text-right font-bold">Petak teramati</TableHead>
                      <TableHead className="text-right font-bold">Rata-rata umur</TableHead>
                      <TableHead className="text-right font-bold">Rata-rata GDD</TableHead>
                      <TableHead className="text-right font-bold">Selisih GDD</TableHead>
                      <TableHead className="font-bold">Usulan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phases.map((p) => {
                      const expanded = open.has(p.phase_id)
                      return (
                        <Fragment key={p.phase_id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell>
                              {p.observed.length > 0 && (
                                <button
                                  type="button"
                                  className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-expanded={expanded}
                                  aria-label={`${expanded ? 'Sembunyikan' : 'Tampilkan'} petak teramati ${p.name}`}
                                  onClick={() => setOpen((s) => toggle(s, p.phase_id))}
                                >
                                  {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell>
                              <Badge variant={p.source === 'KALIBRASI' ? 'success' : 'outline'}>{SOURCE_LABEL[p.source ?? ''] ?? p.source ?? '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{num(p.estimate.start_age)}</TableCell>
                            <TableCell className="text-right tabular-nums">{num(p.estimate.gdd_start)}</TableCell>
                            <TableCell className="text-right tabular-nums">{p.n_plots}</TableCell>
                            <TableCell className="text-right tabular-nums">{num(p.mean_age)}</TableCell>
                            <TableCell className="text-right tabular-nums">{num(p.mean_gdd)}</TableCell>
                            <TableCell className="text-right tabular-nums">{signed(p.diff_gdd, 0)}</TableCell>
                            <TableCell>
                              {p.proposal ? (
                                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 accent-primary"
                                    checked={picked.has(p.phase_id)}
                                    onChange={() => setPicked((s) => toggle(s, p.phase_id))}
                                  />
                                  <span className="tabular-nums">
                                    GDD {formatNumber(p.proposal.gdd_start)} · umur {p.proposal.start_age}
                                  </span>
                                </label>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {p.n_plots === 0 ? 'Belum ada data' : `Perlu ${minPlots - p.n_plots} petak lagi`}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                          {expanded && (
                            <TableRow className="bg-muted/30">
                              <TableCell />
                              <TableCell colSpan={9}>
                                <table className="w-full text-sm">
                                  <caption className="sr-only">Petak teramati pada fase {p.name}</caption>
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th scope="col" className="py-1 pr-4 font-medium">Petak</th>
                                      <th scope="col" className="py-1 pr-4 font-medium">Tanggal</th>
                                      <th scope="col" className="py-1 pr-4 text-right font-medium">HST</th>
                                      <th scope="col" className="py-1 pr-4 text-right font-medium">GDD</th>
                                      <th scope="col" className="py-1 pr-4 text-right font-medium">Selisih umur</th>
                                      <th scope="col" className="py-1 text-right font-medium">Selisih GDD</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.observed.map((o) => (
                                      <tr key={o.plant_id} className="border-t tabular-nums">
                                        <td className="py-1 pr-4">{o.plant_name ?? o.plant_id}</td>
                                        <td className="py-1 pr-4">{formatDateTime(o.date, 'dd MMM yyyy')}</td>
                                        <td className="py-1 pr-4 text-right">{o.age}</td>
                                        <td className="py-1 pr-4 text-right">{o.gdd === null ? <span className="text-muted-foreground">cuaca tidak lengkap</span> : formatNumber(o.gdd)}</td>
                                        <td className="py-1 pr-4 text-right">{signed(o.diff_age, 0)}</td>
                                        <td className="py-1 text-right">{signed(o.diff_gdd, 0)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirm} onOpenChange={(next) => !apply.isPending && setConfirm(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terapkan kalibrasi?</AlertDialogTitle>
            <AlertDialogDescription>
              {picked.size} fase <strong>{report.data?.variety.name}</strong> akan diubah ke nilai teramati dan ditandai KALIBRASI. Akhir fase
              sebelumnya ikut disesuaikan. Perubahan berlaku untuk semua tenant dan dipakai pada simulasi berikutnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apply.isPending}>Batal</AlertDialogCancel>
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Terapkan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
