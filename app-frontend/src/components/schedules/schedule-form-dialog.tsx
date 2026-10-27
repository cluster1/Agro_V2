'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { SCHEDULE_REPEAT } from '@/lib/schedule-status'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const DATETIME_FMT = "yyyy-MM-dd'T'HH:mm"
const REPEATS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const

const schema = z
  .object({
    plant_id: z.string().min(1, 'Tanaman harus dipilih'),
    actype_id: z.string().min(1, 'Jenis kegiatan harus dipilih'),
    sched_title: z.string().max(128, 'Maksimal 128 karakter').optional(),
    sched_start_date: z.string().min(1, 'Waktu mulai wajib diisi'),
    sched_end_date: z.string().min(1, 'Waktu selesai wajib diisi'),
    sched_repeat: z.enum(REPEATS),
    sched_interval: optionalNumber(),
    sched_repeat_until: z.string().optional(),
    sched_plan_value: z.string().max(64, 'Maksimal 64 karakter').optional(),
    sched_remind: optionalNumber(),
    sched_desc: z.string().max(255, 'Maksimal 255 karakter').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.sched_start_date && v.sched_end_date && v.sched_end_date < v.sched_start_date) {
      ctx.addIssue({ code: 'custom', path: ['sched_end_date'], message: 'Waktu selesai tidak boleh sebelum waktu mulai' })
    }
    if (v.sched_repeat !== 'NONE') {
      const interval = num(v.sched_interval)
      if (!interval || interval < 1) {
        ctx.addIssue({ code: 'custom', path: ['sched_interval'], message: 'Interval minimal 1' })
      }
      if (!v.sched_repeat_until) {
        ctx.addIssue({ code: 'custom', path: ['sched_repeat_until'], message: 'Tanggal berakhir wajib diisi' })
      } else if (v.sched_start_date && v.sched_repeat_until < v.sched_start_date.slice(0, 10)) {
        ctx.addIssue({ code: 'custom', path: ['sched_repeat_until'], message: 'Tidak boleh sebelum tanggal mulai' })
      }
    }
  })

type FormValues = z.infer<typeof schema>

interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  schedule?: any
  mode: 'create' | 'edit'
}

const emptyValues = (): FormValues => ({
  plant_id: '',
  actype_id: '',
  sched_title: '',
  sched_start_date: '',
  sched_end_date: '',
  sched_repeat: 'NONE',
  sched_interval: undefined,
  sched_repeat_until: '',
  sched_plan_value: '',
  sched_remind: undefined,
  sched_desc: '',
})

const toLocalInput = (value: unknown): string => {
  if (!value) return ''
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? '' : format(d, DATETIME_FMT)
}

export function ScheduleFormDialog({ open, onOpenChange, tenantId, schedule, mode }: ScheduleFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'

  const plantsQuery = useQuery({
    queryKey: [...queryKeys.plants(tenantId), 'active'],
    queryFn: async () => (await api.get('/plants', { params: { status: 1 } })).data,
    enabled: !!tenantId && open,
  })
  const typesQuery = useQuery({
    queryKey: queryKeys.ref('activity-types', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/activity-types', { params: { ptype_id: 'PT-PADI' } })).data,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  })

  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: emptyValues() })
  const repeat = form.watch('sched_repeat')

  useEffect(() => {
    if (!open) return
    if (editing && schedule) {
      form.reset({
        plant_id: schedule.plant_id ?? '',
        actype_id: schedule.actype_id ?? '',
        sched_title: schedule.sched_title ?? '',
        sched_start_date: toLocalInput(schedule.sched_start_date),
        sched_end_date: toLocalInput(schedule.sched_end_date),
        sched_repeat: (REPEATS as readonly string[]).includes(schedule.sched_repeat) ? schedule.sched_repeat : 'NONE',
        sched_interval: schedule.sched_interval ?? undefined,
        sched_repeat_until: schedule.sched_repeat_until ? String(schedule.sched_repeat_until).slice(0, 10) : '',
        sched_plan_value: schedule.sched_plan_value ?? '',
        sched_remind: schedule.sched_remind ?? undefined,
        sched_desc: schedule.sched_desc ?? '',
      })
    } else {
      form.reset(emptyValues())
    }
  }, [open, editing, schedule, form])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['schedules'] })

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post('/schedules', body)).data,
    onSuccess: () => {
      invalidate()
      toast.success('Jadwal berhasil ditambahkan')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal menambahkan jadwal'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.patch(`/schedules/${schedule.sched_id}`, body)).data,
    onSuccess: () => {
      invalidate()
      toast.success('Jadwal berhasil diperbarui')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal memperbarui jadwal'))
    },
  })

  const onSubmit = (v: FormValues) => {
    const recurring = v.sched_repeat !== 'NONE'
    const remind = num(v.sched_remind)
    const body: Record<string, unknown> = {
      actype_id: v.actype_id,
      sched_start_date: v.sched_start_date,
      sched_end_date: v.sched_end_date,
      sched_repeat: v.sched_repeat,
      ...(recurring && { sched_interval: num(v.sched_interval), sched_repeat_until: v.sched_repeat_until }),
      ...(v.sched_title && { sched_title: v.sched_title }),
      ...(v.sched_plan_value && { sched_plan_value: v.sched_plan_value }),
      ...(remind !== undefined && { sched_remind: remind }),
      ...(v.sched_desc && { sched_desc: v.sched_desc }),
    }
    if (editing) updateMutation.mutate(body)
    else createMutation.mutate({ ...body, plant_id: v.plant_id })
  }

  const busy = createMutation.isPending || updateMutation.isPending
  const handleOpenChange = guardedOpenChange(onOpenChange, { isDirty: form.formState.isDirty, isBusy: busy })
  const loadError = plantsQuery.isError || typesQuery.isError
  const required = (
    <>
      <span aria-hidden="true"> *</span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {editing ? 'Edit Jadwal' : 'Tambah Jadwal'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Tanaman tidak dapat diubah. Hanya jadwal yang belum selesai yang bisa diedit.'
              : 'Jadwal manual untuk tanaman aktif. Status terlambat dihitung otomatis.'}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <ErrorState
            title="Gagal memuat pilihan tanaman atau kegiatan"
            onRetry={() => {
              plantsQuery.refetch()
              typesQuery.refetch()
            }}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="plant_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanaman{required}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={editing || plantsQuery.isLoading}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={plantsQuery.isLoading ? 'Memuat tanaman...' : 'Pilih tanaman'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {editing && schedule && !plantsQuery.data?.some((p: any) => p.plant_id === schedule.plant_id) && (
                            <SelectItem value={schedule.plant_id}>{schedule.plant_name ?? schedule.plant_id}</SelectItem>
                          )}
                          {plantsQuery.data?.map((p: any) => (
                            <SelectItem key={p.plant_id} value={p.plant_id}>
                              {p.plant_name || p.plant_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actype_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis kegiatan{required}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={typesQuery.isLoading}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={typesQuery.isLoading ? 'Memuat kegiatan...' : 'Pilih kegiatan'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {typesQuery.data?.map((t: any) => (
                            <SelectItem key={t.actype_id} value={t.actype_id}>
                              {t.actype_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sched_start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waktu mulai{required}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sched_end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waktu selesai{required}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" aria-required="true" {...field} />
                      </FormControl>
                      <FormDescription>Jadwal berstatus terlambat bila lewat dari waktu ini tanpa kegiatan.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sched_repeat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perulangan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REPEATS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {SCHEDULE_REPEAT[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sched_remind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pengingat (jam sebelum mulai)</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={0} {...field} value={numDisplay(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {repeat !== 'NONE' && (
                  <>
                    <FormField
                      control={form.control}
                      name="sched_interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Setiap{required}</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" min={1} aria-required="true" {...field} value={numDisplay(field.value)} />
                          </FormControl>
                          <FormDescription>
                            Kelipatan{' '}
                            {repeat === 'DAILY' ? 'hari' : repeat === 'WEEKLY' ? 'minggu' : 'bulan'}.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sched_repeat_until"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Berulang sampai{required}</FormLabel>
                          <FormControl>
                            <Input type="date" aria-required="true" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="sched_plan_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nilai rencana</FormLabel>
                      <FormControl>
                        <Input placeholder="Mis. 50 (kg/ha)" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sched_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul</FormLabel>
                      <FormControl>
                        <Input placeholder="Default: nama jenis kegiatan" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="sched_desc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
                  Batal
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {editing ? 'Simpan' : 'Tambah'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
