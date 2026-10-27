'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ImagePlus, Loader2, X } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { nutrientPreview, requiresMaterial } from '@/lib/activity'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const DATETIME_FMT = "yyyy-MM-dd'T'HH:mm"
const NO_SCHEDULE = 'none'
const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const schema = z.object({
  plant_id: z.string().min(1, 'Tanaman harus dipilih'),
  sched_id: z.string().optional(),
  actype_id: z.string().min(1, 'Jenis kegiatan harus dipilih'),
  pact_date: z.string().min(1, 'Waktu kegiatan wajib diisi'),
  pact_value: z.string().max(64, 'Maksimal 64 karakter').optional(),
  unit_id: z.string().optional(),
  mat_id: z.string().optional(),
  pact_worker: optionalNumber(),
  pact_cost: optionalNumber(),
  pact_desc: z.string().max(255, 'Maksimal 255 karakter').optional(),
})

type FormValues = z.infer<typeof schema>

interface ActivityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  activity?: any
  mode: 'create' | 'edit'
}

const emptyValues = (): FormValues => ({
  plant_id: '',
  sched_id: NO_SCHEDULE,
  actype_id: '',
  pact_date: format(new Date(), DATETIME_FMT),
  pact_value: '',
  unit_id: '',
  mat_id: '',
  pact_worker: undefined,
  pact_cost: undefined,
  pact_desc: '',
})

const toLocalInput = (value: unknown): string => {
  if (!value) return ''
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? '' : format(d, DATETIME_FMT)
}

export function ActivityFormDialog({ open, onOpenChange, tenantId, activity, mode }: ActivityFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'
  const fileInput = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: emptyValues() })
  const plantId = form.watch('plant_id')
  const actypeId = form.watch('actype_id')
  const matId = form.watch('mat_id')
  const value = form.watch('pact_value')
  const schedId = form.watch('sched_id')

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
  const materialsQuery = useQuery({
    queryKey: queryKeys.ref('materials'),
    queryFn: async () => (await api.get('/ref/materials')).data,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  })
  const unitsQuery = useQuery({
    queryKey: queryKeys.ref('units'),
    queryFn: async () => (await api.get('/ref/units')).data,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  })
  const schedulesQuery = useQuery({
    queryKey: [...queryKeys.schedules(tenantId), 'open', plantId],
    queryFn: async () => (await api.get('/schedules', { params: { plantId } })).data,
    enabled: open && !editing && !!plantId,
  })

  const openSchedules = useMemo(
    () => (schedulesQuery.data ?? []).filter((s: any) => s.sched_sts === 0 || s.sched_sts === 4),
    [schedulesQuery.data],
  )
  const plant = plantsQuery.data?.find((p: any) => p.plant_id === plantId)
  const type = typesQuery.data?.find((t: any) => t.actype_id === actypeId)
  const material = materialsQuery.data?.find((m: any) => m.mat_id === matId)
  const needsMaterial = requiresMaterial(type?.actype_category)
  const needsPhoto = type?.actype_need_photo === 1
  const preview = needsMaterial && unitsQuery.data ? nutrientPreview(value, form.watch('unit_id') || type?.unit_id, material, plant?.plant_area) : null

  const reset = () => {
    setPhotos([])
    setPhotoError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  useEffect(() => {
    if (!open) return
    reset()
    if (editing && activity) {
      form.reset({
        plant_id: activity.plant_id ?? '',
        sched_id: NO_SCHEDULE,
        actype_id: activity.actype_id ?? '',
        pact_date: toLocalInput(activity.pact_date),
        pact_value: activity.pact_value ?? '',
        unit_id: activity.unit_id ?? '',
        mat_id: activity.mat_id ?? '',
        pact_worker: activity.pact_worker ?? undefined,
        pact_cost: activity.pact_cost ?? undefined,
        pact_desc: activity.pact_desc ?? '',
      })
    } else {
      form.reset(emptyValues())
    }
  }, [open, editing, activity, form])

  // Choosing a schedule pre-fills the activity type, planned value and unit.
  const pickSchedule = (id: string) => {
    form.setValue('sched_id', id, { shouldDirty: true })
    const sched = openSchedules.find((s: any) => s.sched_id === id)
    if (!sched) return
    form.setValue('actype_id', sched.actype_id, { shouldDirty: true, shouldValidate: true })
    if (sched.sched_plan_value) form.setValue('pact_value', sched.sched_plan_value, { shouldDirty: true })
    if (sched.unit_id) form.setValue('unit_id', sched.unit_id, { shouldDirty: true })
  }

  const pickType = (id: string) => {
    form.setValue('actype_id', id, { shouldDirty: true, shouldValidate: true })
    const t = typesQuery.data?.find((x: any) => x.actype_id === id)
    if (t?.unit_id) form.setValue('unit_id', t.unit_id, { shouldDirty: true })
  }

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (!PHOTO_TYPES.includes(file.type)) return setPhotoError('Foto harus berformat PNG, JPG, WebP, atau GIF.')
      if (file.size > MAX_PHOTO_BYTES) return setPhotoError('Ukuran foto maksimal 10 MB.')
      if (next.length >= MAX_PHOTOS) return setPhotoError(`Maksimal ${MAX_PHOTOS} foto.`)
      next.push(file)
    }
    setPhotoError(null)
    setPhotos(next)
    if (fileInput.current) fileInput.current.value = ''
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activities'] })
    queryClient.invalidateQueries({ queryKey: ['schedules'] }) // a linked schedule turns done
    queryClient.invalidateQueries({ queryKey: ['media'] })
  }

  const createMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      // Upload photos first; the activity then claims them by id.
      const mediaIds: string[] = []
      if (photos.length) {
        setUploading(true)
        for (const file of photos) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('site_id', plant.site_id)
          if (plant.cluster_id) fd.append('cluster_id', plant.cluster_id)
          fd.append('media_type', 'photo')
          fd.append('media_desc', `Kegiatan ${type?.actype_name ?? v.actype_id}`)
          const res = await api.post('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          mediaIds.push(res.data.media_id)
        }
      }
      const worker = num(v.pact_worker)
      const cost = num(v.pact_cost)
      return (
        await api.post('/activities', {
          plant_id: v.plant_id,
          actype_id: v.actype_id,
          pact_date: v.pact_date,
          ...(v.sched_id && v.sched_id !== NO_SCHEDULE && { sched_id: v.sched_id }),
          ...(v.pact_value && { pact_value: v.pact_value }),
          ...(v.unit_id && { unit_id: v.unit_id }),
          ...(v.mat_id && { mat_id: v.mat_id }),
          ...(worker !== undefined && { pact_worker: worker }),
          ...(cost !== undefined && { pact_cost: cost }),
          ...(v.pact_desc && { pact_desc: v.pact_desc }),
          ...(mediaIds.length && { media_ids: mediaIds }),
        })
      ).data
    },
    onSuccess: (data) => {
      invalidate()
      const n = data?.nutrient_input
      toast.success(
        n ? `Kegiatan dicatat. Hara masuk: ${n.n_kg_ha} kg N/ha, ${n.p2o5_kg_ha} P₂O₅, ${n.k2o_kg_ha} K₂O` : 'Kegiatan dicatat',
      )
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal mencatat kegiatan'))
    },
    onSettled: () => setUploading(false),
  })

  const updateMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const worker = num(v.pact_worker)
      const cost = num(v.pact_cost)
      return (
        await api.patch(`/activities/${activity.pact_id}`, {
          pact_date: v.pact_date,
          pact_value: v.pact_value ?? '',
          ...(v.unit_id && { unit_id: v.unit_id }),
          ...(v.mat_id && { mat_id: v.mat_id }),
          ...(worker !== undefined && { pact_worker: worker }),
          ...(cost !== undefined && { pact_cost: cost }),
          pact_desc: v.pact_desc ?? '',
        })
      ).data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Kegiatan diperbarui')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal memperbarui kegiatan'))
    },
  })

  const onSubmit = (v: FormValues) => {
    if (editing) return updateMutation.mutate(v)
    if (needsPhoto && photos.length === 0) {
      setPhotoError('Jenis kegiatan ini wajib menyertakan foto.')
      return
    }
    if (needsMaterial && !v.mat_id) {
      form.setError('mat_id', { type: 'required', message: 'Bahan wajib dipilih' })
      return
    }
    createMutation.mutate(v)
  }

  const busy = createMutation.isPending || updateMutation.isPending || uploading
  const handleOpenChange = guardedOpenChange(onOpenChange, { isDirty: form.formState.isDirty || photos.length > 0, isBusy: busy })
  const loadError = plantsQuery.isError || typesQuery.isError || materialsQuery.isError || unitsQuery.isError
  const required = (
    <>
      <span aria-hidden="true"> *</span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {editing ? 'Edit Kegiatan' : 'Catat Kegiatan'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Tanaman, jenis kegiatan, dan foto tidak dapat diubah.'
              : 'Realisasi kegiatan di lapangan. Memilih jadwal akan menandai jadwal itu selesai.'}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <ErrorState
            title="Gagal memuat pilihan tanaman, kegiatan, atau bahan"
            onRetry={() => {
              plantsQuery.refetch()
              typesQuery.refetch()
              materialsQuery.refetch()
              unitsQuery.refetch()
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
                      <Select
                        onValueChange={(v) => {
                          field.onChange(v)
                          form.setValue('sched_id', NO_SCHEDULE)
                        }}
                        value={field.value}
                        disabled={editing || plantsQuery.isLoading}
                      >
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={plantsQuery.isLoading ? 'Memuat tanaman...' : 'Pilih tanaman'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {editing && activity && !plantsQuery.data?.some((p: any) => p.plant_id === activity.plant_id) && (
                            <SelectItem value={activity.plant_id}>{activity.plant_name ?? activity.plant_id}</SelectItem>
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

                {!editing && (
                  <FormField
                    control={form.control}
                    name="sched_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jadwal terkait</FormLabel>
                        <Select onValueChange={pickSchedule} value={field.value} disabled={!plantId || schedulesQuery.isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NO_SCHEDULE}>Tanpa jadwal</SelectItem>
                            {openSchedules.map((s: any) => (
                              <SelectItem key={s.sched_id} value={s.sched_id}>
                                {s.sched_title} · {format(new Date(s.sched_start_date), 'dd MMM')}
                                {s.sched_sts === 4 ? ' (terlambat)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Opsional. Mengisi jenis kegiatan dan nilai rencana.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="actype_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis kegiatan{required}</FormLabel>
                      <Select
                        onValueChange={pickType}
                        value={field.value}
                        disabled={editing || typesQuery.isLoading || (!!schedId && schedId !== NO_SCHEDULE)}
                      >
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
                  name="pact_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waktu kegiatan{required}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pact_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jumlah / nilai{needsMaterial && required}</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" placeholder="Mis. 150" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Satuan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined} disabled={unitsQuery.isLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih satuan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitsQuery.data?.map((u: any) => (
                            <SelectItem key={u.unit_id} value={u.unit_id}>
                              {u.unit_name}
                              {u.unit_symbol ? ` (${u.unit_symbol})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(needsMaterial || matId) && (
                  <FormField
                    control={form.control}
                    name="mat_id"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Bahan{needsMaterial && required}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined} disabled={materialsQuery.isLoading}>
                          <FormControl>
                            <SelectTrigger aria-required={needsMaterial}>
                              <SelectValue placeholder="Pilih bahan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {materialsQuery.data?.map((m: any) => (
                              <SelectItem key={m.mat_id} value={m.mat_id}>
                                {m.mat_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {preview && (
                          <FormDescription aria-live="polite">
                            Hara masuk: <strong>{preview.n_kg_ha}</strong> kg N/ha · <strong>{preview.p2o5_kg_ha}</strong> kg P₂O₅/ha ·{' '}
                            <strong>{preview.k2o_kg_ha}</strong> kg K₂O/ha
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="pact_worker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jumlah pekerja</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={0} {...field} value={numDisplay(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pact_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Biaya (Rp)</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={0} {...field} value={numDisplay(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pact_desc"
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

              {!editing && (
                <div className="space-y-2">
                  <Label htmlFor="activity-photos">Foto{needsPhoto && required}</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
                      <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tambah foto
                    </Button>
                    <input
                      id="activity-photos"
                      ref={fileInput}
                      type="file"
                      accept={PHOTO_TYPES.join(',')}
                      multiple
                      className="sr-only"
                      onChange={(e) => addPhotos(e.target.files)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {needsPhoto ? 'Wajib untuk jenis kegiatan ini. ' : ''}Maks. {MAX_PHOTOS} foto, 10 MB per foto.
                    </span>
                  </div>
                  {photos.length > 0 && (
                    <ul className="space-y-1" aria-label="Foto yang akan diunggah">
                      {photos.map((file, i) => (
                        <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded border px-3 py-1.5 text-sm">
                          <span className="truncate">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus foto ${file.name}`}
                            onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                            disabled={busy}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {photoError && (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {photoError}
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
                  Batal
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {uploading ? 'Mengunggah foto...' : editing ? 'Simpan' : 'Catat'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
