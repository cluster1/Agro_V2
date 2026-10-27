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
import { MOISTURE_MAX, MOISTURE_MIN, harvestPreview } from '@/lib/harvest'
import { formatNumber } from '@/lib/format'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const todayISO = () => format(new Date(), 'yyyy-MM-dd')

const schema = z.object({
  plant_id: z.string().min(1, 'Tanaman harus dipilih'),
  hv_date: z.string().regex(DAY_RE, 'Tanggal panen wajib diisi'),
  hv_weight: z.coerce.number({ invalid_type_error: 'Berat harus berupa angka' }).positive('Berat GKP harus lebih dari 0'),
  hv_moisture: z.coerce
    .number({ invalid_type_error: 'Kadar air harus berupa angka' })
    .min(MOISTURE_MIN, `Kadar air minimal ${MOISTURE_MIN}%`)
    .max(MOISTURE_MAX, `Kadar air maksimal ${MOISTURE_MAX}%`),
  hv_area: optionalNumber(),
  hv_loss_pct: optionalNumber(),
  hv_price: optionalNumber(),
  hv_desc: z.string().max(255, 'Maksimal 255 karakter').optional(),
})

type FormValues = z.infer<typeof schema>

interface HarvestFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  harvest?: any
  mode: 'create' | 'edit'
}

const emptyValues = (): FormValues => ({
  plant_id: '',
  hv_date: todayISO(),
  hv_weight: '' as unknown as number,
  hv_moisture: '' as unknown as number,
  hv_area: undefined,
  hv_loss_pct: undefined,
  hv_price: undefined,
  hv_desc: '',
})

export function HarvestFormDialog({ open, onOpenChange, tenantId, harvest, mode }: HarvestFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'

  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: emptyValues() })
  const plantId = form.watch('plant_id')

  const plantsQuery = useQuery({
    queryKey: [...queryKeys.plants(tenantId), 'all'],
    queryFn: async () => (await api.get('/plants')).data,
    enabled: !!tenantId && open,
  })
  const plant = plantsQuery.data?.find((p: any) => p.plant_id === plantId)

  const area = num(form.watch('hv_area')) ?? plant?.plant_area
  const preview = harvestPreview(num(form.watch('hv_weight')), num(form.watch('hv_moisture')), area)

  useEffect(() => {
    if (!open) return
    if (editing && harvest) {
      form.reset({
        plant_id: harvest.plant_id ?? '',
        hv_date: String(harvest.hv_date ?? '').slice(0, 10),
        hv_weight: harvest.hv_weight ?? ('' as unknown as number),
        hv_moisture: harvest.hv_moisture ?? ('' as unknown as number),
        hv_area: harvest.hv_area ?? undefined,
        hv_loss_pct: harvest.hv_loss_pct ?? undefined,
        hv_price: harvest.hv_price ?? undefined,
        hv_desc: harvest.hv_desc ?? '',
      })
    } else {
      form.reset(emptyValues())
    }
  }, [open, editing, harvest, form])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['harvests'] })

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const body: Record<string, unknown> = {
        hv_date: v.hv_date,
        hv_weight: v.hv_weight,
        hv_moisture: v.hv_moisture,
        ...(num(v.hv_area) !== undefined && { hv_area: num(v.hv_area) }),
        ...(num(v.hv_loss_pct) !== undefined && { hv_loss_pct: num(v.hv_loss_pct) }),
        ...(num(v.hv_price) !== undefined && { hv_price: num(v.hv_price) }),
        ...(v.hv_desc && { hv_desc: v.hv_desc }),
      }
      return editing
        ? (await api.patch(`/harvests/${harvest.hv_id}`, body)).data
        : (await api.post('/harvests', { ...body, plant_id: v.plant_id })).data
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(
        `Panen ${editing ? 'diperbarui' : 'dicatat'}: ${formatNumber(data?.hv_weight_dry)} kg GKG, ${formatNumber(data?.hv_yield)} t/ha`,
      )
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, editing ? 'Gagal memperbarui panen' : 'Gagal mencatat panen'))
    },
  })

  const handleOpenChange = guardedOpenChange(onOpenChange, {
    isDirty: form.formState.isDirty,
    isBusy: mutation.isPending,
  })
  const required = (
    <>
      <span aria-hidden="true"> *</span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )

  const numberField = (
    name: keyof FormValues,
    label: string,
    opts: { hint?: string; req?: boolean; props?: Record<string, unknown> } = {},
  ) => (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {opts.req && required}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              aria-required={opts.req}
              {...opts.props}
              {...field}
              value={numDisplay(field.value)}
            />
          </FormControl>
          {opts.hint && <FormDescription>{opts.hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">{editing ? 'Edit Panen' : 'Catat Panen'}</DialogTitle>
          <DialogDescription>
            Berat GKG dihitung pada kadar air standar 14%. Musim yang sudah ditutup tetap bisa dicatat panennya.
          </DialogDescription>
        </DialogHeader>

        {plantsQuery.isError ? (
          <ErrorState title="Gagal memuat daftar tanaman" onRetry={() => plantsQuery.refetch()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
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
                          {plantsQuery.data?.map((p: any) => (
                            <SelectItem key={p.plant_id} value={p.plant_id}>
                              {p.plant_name || p.plant_id}
                              {p.plant_sts === 0 ? ' (ditutup)' : ''}
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
                  name="hv_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal panen{required}</FormLabel>
                      <FormControl>
                        <Input type="date" max={todayISO()} aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {numberField('hv_weight', 'Berat GKP (kg)', { req: true, props: { min: 0 } })}
                {numberField('hv_moisture', 'Kadar air (%)', {
                  req: true,
                  hint: `${MOISTURE_MIN}-${MOISTURE_MAX}%`,
                  props: { min: MOISTURE_MIN, max: MOISTURE_MAX },
                })}
                {numberField('hv_area', 'Luas dipanen (ha)', {
                  hint: plant?.plant_area ? `Kosong = luas tanaman (${plant.plant_area} ha)` : 'Kosong = luas tanaman',
                  props: { min: 0 },
                })}
                {numberField('hv_loss_pct', 'Susut panen (%)', { props: { min: 0, max: 100 } })}
                {numberField('hv_price', 'Harga (Rp/kg)', { props: { min: 0 } })}
              </div>

              <div
                className="rounded-md border bg-muted/40 p-4 text-sm"
                aria-live="polite"
                role="status"
                data-testid="harvest-preview"
              >
                {preview ? (
                  <p>
                    Setara <strong className="tabular-nums">{formatNumber(preview.gkg)} kg GKG</strong> (14%) ·{' '}
                    <strong className="tabular-nums">{formatNumber(preview.yield)} t/ha</strong>
                  </p>
                ) : (
                  <p className="text-muted-foreground">Isi berat, kadar air, dan tanaman untuk melihat GKG dan produktivitas.</p>
                )}
              </div>

              <FormField
                control={form.control}
                name="hv_desc"
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
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>
                  Batal
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  {editing ? 'Simpan' : 'Catat'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
