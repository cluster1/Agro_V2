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
import { BWD_VALUES, SYMPTOMS, daysBetween, fieldsFor, phaseForAge, splitSymptoms } from '@/lib/observation'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const DATETIME_FMT = "yyyy-MM-dd'T'HH:mm"
const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const schema = z.object({
  plant_id: z.string().min(1, 'Tanaman harus dipilih'),
  obs_date: z.string().min(1, 'Waktu observasi wajib diisi'),
  obs_sample_n: optionalNumber(),
  obs_height: optionalNumber(),
  obs_tiller: optionalNumber(),
  obs_bwd: z.string().optional(),
  obs_panicle: optionalNumber(),
  obs_grain: optionalNumber(),
  obs_filled_pct: optionalNumber(),
  obs_phase_pct: optionalNumber(),
  obs_pest_name: z.string().max(64, 'Maksimal 64 karakter').optional(),
  obs_pest_pct: optionalNumber(),
  obs_desc: z.string().max(180, 'Maksimal 180 karakter').optional(),
})

type FormValues = z.infer<typeof schema>

interface ObservationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  observation?: any
  mode: 'create' | 'edit'
}

const emptyValues = (): FormValues => ({
  plant_id: '',
  obs_date: format(new Date(), DATETIME_FMT),
  obs_sample_n: undefined,
  obs_height: undefined,
  obs_tiller: undefined,
  obs_bwd: '',
  obs_panicle: undefined,
  obs_grain: undefined,
  obs_filled_pct: undefined,
  obs_phase_pct: undefined,
  obs_pest_name: '',
  obs_pest_pct: undefined,
  obs_desc: '',
})

const toLocalInput = (value: unknown): string => {
  if (!value) return ''
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? '' : format(d, DATETIME_FMT)
}

export function ObservationFormDialog({ open, onOpenChange, tenantId, observation, mode }: ObservationFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'
  const fileInput = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const initialSymptoms = useRef<string[]>([])

  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: emptyValues() })
  const plantId = form.watch('plant_id')
  const obsDate = form.watch('obs_date')

  const plantsQuery = useQuery({
    queryKey: [...queryKeys.plants(tenantId), 'active'],
    queryFn: async () => (await api.get('/plants', { params: { status: 1 } })).data,
    enabled: !!tenantId && open,
  })
  const phasesQuery = useQuery({
    queryKey: queryKeys.ref('phases', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/phases', { params: { ptype_id: 'PT-PADI' } })).data,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  })

  const plant = plantsQuery.data?.find((p: any) => p.plant_id === plantId)
  const age = useMemo(() => daysBetween(plant?.plant_date, obsDate?.slice(0, 10)), [plant, obsDate])
  const phase = useMemo(() => {
    if (plant?.plant_phase_mode === 'MANUAL' && plant.phase_id) {
      return phasesQuery.data?.find((p: any) => p.phase_id === plant.phase_id)
    }
    return phaseForAge(phasesQuery.data ?? [], age)
  }, [plant, phasesQuery.data, age])
  const show = fieldsFor(age, phase?.phase_seq ?? null)

  useEffect(() => {
    if (!open) return
    setPhotos([])
    setPhotoError(null)
    if (fileInput.current) fileInput.current.value = ''
    if (editing && observation) {
      initialSymptoms.current = splitSymptoms(observation.obs_symptom)
      setSymptoms(initialSymptoms.current)
      form.reset({
        plant_id: observation.plant_id ?? '',
        obs_date: toLocalInput(observation.obs_date),
        obs_sample_n: observation.obs_sample_n ?? undefined,
        obs_height: observation.obs_height ?? undefined,
        obs_tiller: observation.obs_tiller ?? undefined,
        obs_bwd: observation.obs_bwd != null ? String(observation.obs_bwd) : '',
        obs_panicle: observation.obs_panicle ?? undefined,
        obs_grain: observation.obs_grain ?? undefined,
        obs_filled_pct: observation.obs_filled_pct ?? undefined,
        obs_phase_pct: observation.obs_phase_pct ?? undefined,
        obs_pest_name: observation.obs_pest_name ?? '',
        obs_pest_pct: observation.obs_pest_pct ?? undefined,
        obs_desc: observation.obs_desc?.startsWith('Ditolak: ') ? '' : observation.obs_desc ?? '',
      })
    } else {
      initialSymptoms.current = []
      setSymptoms([])
      form.reset(emptyValues())
    }
  }, [open, editing, observation, form])

  const toggleSymptom = (code: string, checked: boolean) => {
    setSymptoms((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)))
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
    queryClient.invalidateQueries({ queryKey: ['observations'] })
    queryClient.invalidateQueries({ queryKey: ['media'] })
  }

  const buildBody = (v: FormValues, draft: boolean) => {
    const n = (x: unknown) => num(x)
    const body: Record<string, unknown> = {
      obs_date: v.obs_date,
      draft,
      obs_symptom: symptoms,
      ...(n(v.obs_sample_n) !== undefined && { obs_sample_n: n(v.obs_sample_n) }),
      ...(n(v.obs_height) !== undefined && { obs_height: n(v.obs_height) }),
      ...(n(v.obs_tiller) !== undefined && { obs_tiller: n(v.obs_tiller) }),
      ...(show.bwd && v.obs_bwd && { obs_bwd: Number(v.obs_bwd) }),
      ...(show.panicle && n(v.obs_panicle) !== undefined && { obs_panicle: n(v.obs_panicle) }),
      ...(show.grain && n(v.obs_grain) !== undefined && { obs_grain: n(v.obs_grain) }),
      ...(show.grain && n(v.obs_filled_pct) !== undefined && { obs_filled_pct: n(v.obs_filled_pct) }),
      ...(n(v.obs_phase_pct) !== undefined && { obs_phase_pct: n(v.obs_phase_pct) }),
      ...(v.obs_pest_name && { obs_pest_name: v.obs_pest_name }),
      ...(n(v.obs_pest_pct) !== undefined && { obs_pest_pct: n(v.obs_pest_pct) }),
      ...(v.obs_desc && { obs_desc: v.obs_desc }),
    }
    return body
  }

  const saveMutation = useMutation({
    mutationFn: async ({ v, draft }: { v: FormValues; draft: boolean }) => {
      const body = buildBody(v, draft)
      if (editing) return (await api.patch(`/observations/${observation.obs_id}`, body)).data

      const mediaIds: string[] = []
      if (photos.length) {
        setUploading(true)
        for (const file of photos) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('site_id', plant.site_id)
          if (plant.cluster_id) fd.append('cluster_id', plant.cluster_id)
          fd.append('media_type', 'photo')
          fd.append('media_desc', 'Observasi')
          const res = await api.post('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          mediaIds.push(res.data.media_id)
        }
      }
      return (await api.post('/observations', { ...body, plant_id: v.plant_id, ...(mediaIds.length && { media_ids: mediaIds }) })).data
    },
    onSuccess: (_d, { draft }) => {
      invalidate()
      toast.success(draft ? 'Draf observasi disimpan' : 'Observasi disimpan, menunggu verifikasi')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal menyimpan observasi'))
    },
    onSettled: () => setUploading(false),
  })

  const submit = (draft: boolean) => form.handleSubmit((v) => saveMutation.mutate({ v, draft }))()

  const busy = saveMutation.isPending || uploading
  const handleOpenChange = guardedOpenChange(onOpenChange, {
    isDirty:
      form.formState.isDirty ||
      photos.length > 0 ||
      [...symptoms].sort().join() !== [...initialSymptoms.current].sort().join(),
    isBusy: busy,
  })
  const loadError = plantsQuery.isError || phasesQuery.isError
  const required = (
    <>
      <span aria-hidden="true"> *</span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )

  const numberField = (name: keyof FormValues, label: string, hint?: string, props: Record<string, unknown> = {}) => (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="number" inputMode="decimal" step="any" {...props} {...field} value={numDisplay(field.value)} />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {editing ? 'Edit Observasi' : 'Catat Observasi'}
          </DialogTitle>
          <DialogDescription>
            Nilai adalah rata-rata dari rumpun sampel. Kolom yang tampil mengikuti fase tanaman pada tanggal observasi.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <ErrorState
            title="Gagal memuat pilihan tanaman atau fase"
            onRetry={() => {
              plantsQuery.refetch()
              phasesQuery.refetch()
            }}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={(e) => { e.preventDefault(); submit(false) }} className="space-y-4" noValidate>
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
                          {editing && observation && !plantsQuery.data?.some((p: any) => p.plant_id === observation.plant_id) && (
                            <SelectItem value={observation.plant_id}>{observation.plant_name ?? observation.plant_id}</SelectItem>
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
                  name="obs_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waktu observasi{required}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" aria-required="true" {...field} />
                      </FormControl>
                      <FormDescription aria-live="polite">
                        {plant && age !== null
                          ? `HST ${age}${phase ? ` · ${phase.phase_name}` : ''}`
                          : 'Pilih tanaman untuk melihat HST dan fase.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {numberField('obs_height', 'Tinggi tanaman (cm)', '5-160', { min: 5, max: 160 })}
                {numberField('obs_tiller', 'Anakan per rumpun', '1-60', { min: 1, max: 60 })}

                {show.bwd && (
                  <FormField
                    control={form.control}
                    name="obs_bwd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bagan Warna Daun (BWD)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih skala" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BWD_VALUES.map((v) => (
                              <SelectItem key={v} value={String(v)}>
                                {String(v).replace('.', ',')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Diukur pada HST 14-62, skala 2-5.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {show.panicle && numberField('obs_panicle', 'Malai per rumpun', undefined, { min: 0 })}
                {show.grain && numberField('obs_grain', 'Gabah per malai', undefined, { min: 0 })}
                {show.grain && numberField('obs_filled_pct', 'Gabah isi (%)', '0-100', { min: 0, max: 100 })}

                {numberField('obs_phase_pct', 'Populasi mencapai fase (%)', '0-100', { min: 0, max: 100 })}
                {numberField('obs_sample_n', 'Jumlah rumpun sampel', 'Default 20', { min: 1 })}
              </div>

              <fieldset className="space-y-2 rounded-md border p-4">
                <legend className="px-1 text-sm font-medium">Gejala</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SYMPTOMS.map((s) => (
                    <label key={s.code} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-primary"
                        checked={symptoms.includes(s.code)}
                        onChange={(e) => toggleSymptom(s.code, e.target.checked)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="obs_pest_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hama / penyakit</FormLabel>
                      <FormControl>
                        <Input placeholder="Mis. Wereng coklat" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {numberField('obs_pest_pct', 'Intensitas (%)', 'Wajib bila hama diisi', { min: 0, max: 100 })}
              </div>

              <FormField
                control={form.control}
                name="obs_desc"
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
                  <Label htmlFor="obs-photos">Foto</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
                      <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tambah foto
                    </Button>
                    <input
                      id="obs-photos"
                      ref={fileInput}
                      type="file"
                      accept={PHOTO_TYPES.join(',')}
                      multiple
                      className="sr-only"
                      onChange={(e) => addPhotos(e.target.files)}
                    />
                    <span className="text-xs text-muted-foreground">Maks. {MAX_PHOTOS} foto, 10 MB per foto.</span>
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

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
                  Batal
                </Button>
                <Button type="button" variant="secondary" onClick={() => submit(true)} disabled={busy}>
                  Simpan draf
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {uploading ? 'Mengunggah foto...' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
