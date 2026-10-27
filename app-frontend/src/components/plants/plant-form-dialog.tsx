'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_VARIETY = 'VAR-PD-DEFAULT'
const SEASONS = ['MT1', 'MT2', 'MT3'] as const

const schema = z
  .object({
    cluster_id: z.string().min(1, 'Petak harus dipilih'),
    var_id: z.string().min(1, 'Varietas harus dipilih'),
    season: z.enum(SEASONS),
    year: z.coerce.number().int().min(2000, 'Tahun tidak valid').max(2100, 'Tahun tidak valid'),
    plant_sow_date: z.string().regex(DAY_RE, 'Tanggal sebar wajib diisi'),
    plant_date: z.string().regex(DAY_RE, 'Tanggal tanam wajib diisi'),
    plant_area: z.coerce.number({ invalid_type_error: 'Luas harus berupa angka' }).positive('Luas harus lebih dari 0'),
    plant_count: optionalNumber(),
    plant_name: z.string().max(64, 'Maksimal 64 karakter').optional(),
    plant_desc: z.string().max(255, 'Maksimal 255 karakter').optional(),
  })
  .refine((v) => !v.plant_sow_date || !v.plant_date || v.plant_date >= v.plant_sow_date, {
    path: ['plant_date'],
    message: 'Tanggal tanam tidak boleh sebelum tanggal sebar',
  })

type FormValues = z.infer<typeof schema>

interface PlantFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  plant?: any
  mode: 'create' | 'edit'
}

const emptyValues = (): FormValues => ({
  cluster_id: '',
  var_id: DEFAULT_VARIETY,
  season: 'MT1',
  year: new Date().getFullYear(),
  plant_sow_date: '',
  plant_date: '',
  plant_area: '' as unknown as number,
  plant_count: undefined,
  plant_name: '',
  plant_desc: '',
})

export function PlantFormDialog({ open, onOpenChange, tenantId, plant, mode }: PlantFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'

  const clustersQuery = useQuery({
    queryKey: queryKeys.clusters(tenantId),
    queryFn: async () => (await api.get('/clusters')).data,
    enabled: !!tenantId && open && !editing,
  })
  const varietiesQuery = useQuery({
    queryKey: queryKeys.ref('varieties', 'PT-PADI'),
    queryFn: async () => (await api.get('/ref/varieties', { params: { ptype_id: 'PT-PADI' } })).data,
    enabled: open && !editing,
    staleTime: 10 * 60 * 1000,
  })

  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: emptyValues() })

  useEffect(() => {
    if (!open) return
    if (editing && plant) {
      const [mt, yr] = String(plant.plant_season ?? '').split('-')
      form.reset({
        cluster_id: plant.cluster_id ?? '',
        var_id: plant.var_id ?? DEFAULT_VARIETY,
        season: (SEASONS as readonly string[]).includes(mt) ? (mt as FormValues['season']) : 'MT1',
        year: Number(yr) || new Date().getFullYear(),
        plant_sow_date: plant.plant_sow_date ?? '',
        plant_date: plant.plant_date ?? '',
        plant_area: plant.plant_area ?? ('' as unknown as number),
        plant_count: plant.plant_count ?? undefined,
        plant_name: plant.plant_name ?? '',
        plant_desc: plant.plant_desc ?? '',
      })
    } else {
      form.reset(emptyValues())
    }
  }, [open, editing, plant, form])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['plants'] })
    queryClient.invalidateQueries({ queryKey: ['schedules'] }) // creating a plant adds template schedules
  }

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post('/plants', body)).data,
    onSuccess: (data) => {
      invalidate()
      toast.success(`Tanaman dibuat dengan ${data?.schedules_created ?? 0} jadwal templat`)
      ;(data?.warnings ?? []).forEach((w: string) => toast.warning(w))
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal menambahkan tanaman'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.patch(`/plants/${plant.plant_id}`, body)).data,
    onSuccess: (data) => {
      invalidate()
      toast.success('Tanaman berhasil diperbarui')
      ;(data?.warnings ?? []).forEach((w: string) => toast.warning(w))
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal memperbarui tanaman'))
    },
  })

  const onSubmit = (v: FormValues) => {
    const count = num(v.plant_count)
    if (editing) {
      updateMutation.mutate({
        plant_area: v.plant_area,
        ...(count !== undefined && { plant_count: count }),
        plant_name: v.plant_name || undefined,
        plant_desc: v.plant_desc || undefined,
      })
      return
    }
    createMutation.mutate({
      cluster_id: v.cluster_id,
      var_id: v.var_id,
      plant_season: `${v.season}-${v.year}`,
      plant_sow_date: v.plant_sow_date,
      plant_date: v.plant_date,
      plant_area: v.plant_area,
      ...(count !== undefined && { plant_count: count }),
      ...(v.plant_name && { plant_name: v.plant_name }),
      ...(v.plant_desc && { plant_desc: v.plant_desc }),
    })
  }

  const busy = createMutation.isPending || updateMutation.isPending
  const handleOpenChange = guardedOpenChange(onOpenChange, { isDirty: form.formState.isDirty, isBusy: busy })
  const loadError = !editing && (clustersQuery.isError || varietiesQuery.isError)
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
            {editing ? 'Edit Tanaman' : 'Tambah Tanaman'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Petak, varietas, musim, dan tanggal tidak dapat diubah. Tutup musim lalu buat tanaman baru bila perlu.'
              : 'Satu petak hanya boleh punya satu tanaman padi aktif per musim. Jadwal templat dibuat otomatis.'}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <ErrorState
            title="Gagal memuat pilihan petak atau varietas"
            onRetry={() => {
              clustersQuery.refetch()
              varietiesQuery.refetch()
            }}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cluster_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Petak{required}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={editing || clustersQuery.isLoading}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={clustersQuery.isLoading ? 'Memuat petak...' : 'Pilih petak'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {editing && plant && (
                            <SelectItem value={plant.cluster_id}>{plant.cluster_name ?? plant.cluster_id}</SelectItem>
                          )}
                          {clustersQuery.data?.map((c: any) => (
                            <SelectItem key={c.cluster_id} value={c.cluster_id}>
                              {c.cluster_name}
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
                  name="var_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Varietas{required}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={editing || varietiesQuery.isLoading}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={varietiesQuery.isLoading ? 'Memuat varietas...' : 'Pilih varietas'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {editing && plant && (
                            <SelectItem value={plant.var_id}>{plant.plant_variety ?? plant.var_id}</SelectItem>
                          )}
                          {varietiesQuery.data?.map((v: any) => (
                            <SelectItem key={v.var_id} value={v.var_id}>
                              {v.var_name}
                              {v.var_maturity ? ` (${v.var_maturity} HSS)` : ''}
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
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Musim tanam{required}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={editing}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SEASONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
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
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tahun{required}</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" disabled={editing} aria-required="true" {...field} value={numDisplay(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plant_sow_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal sebar{required}</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={editing} aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plant_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal tanam{required}</FormLabel>
                      <FormControl>
                        <Input type="date" disabled={editing} aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plant_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Luas (ha){required}</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" step="any" aria-required="true" {...field} value={numDisplay(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plant_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Populasi (rumpun)</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" {...field} value={numDisplay(field.value)} />
                      </FormControl>
                      <FormDescription>Kosongkan untuk luas x populasi standar.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="plant_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama</FormLabel>
                    <FormControl>
                      <Input placeholder="Padi Petak A MT2 2026" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plant_desc"
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
