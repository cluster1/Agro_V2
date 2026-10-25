'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'

// Parameter schema
const parameterFormSchema = z
  .object({
    ds_id: z.string().min(1, 'ID parameter wajib diisi'),
    ds_name: z.string().min(1, 'Nama parameter wajib diisi'),
    ds_address: z.string().optional(),
    unit_id: z.string().optional(),
    ds_seq: optionalNumber(),
    dc_normal_value: optionalNumber(),
    ds_min_norm_value: optionalNumber(),
    ds_max_norm_value: optionalNumber(),
    ds_min_value: optionalNumber(),
    ds_max_value: optionalNumber(),
    ds_min_val_warn: optionalNumber(),
    ds_max_val_warn: optionalNumber(),
    ds_sts: z.coerce.number().optional(),
  })
  .superRefine((v, ctx) => {
    // Ordering checks run only when both values are filled in.
    const pairs: Array<[keyof typeof v, keyof typeof v, string]> = [
      ['ds_min_value', 'ds_max_value', 'Nilai minimum tidak boleh lebih besar dari maksimum'],
      ['ds_min_norm_value', 'ds_max_norm_value', 'Normal minimum tidak boleh lebih besar dari normal maksimum'],
      ['ds_min_val_warn', 'ds_max_val_warn', 'Peringatan minimum tidak boleh lebih besar dari peringatan maksimum'],
    ]
    for (const [minKey, maxKey, message] of pairs) {
      const min = v[minKey]
      const max = v[maxKey]
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [minKey], message })
      }
    }
  })

type ParameterFormValues = z.infer<typeof parameterFormSchema>

const EMPTY_VALUES: ParameterFormValues = {
  ds_id: '',
  ds_name: '',
  ds_address: '',
  unit_id: '',
  ds_seq: undefined,
  dc_normal_value: undefined,
  ds_min_norm_value: undefined,
  ds_max_norm_value: undefined,
  ds_min_value: undefined,
  ds_max_value: undefined,
  ds_min_val_warn: undefined,
  ds_max_val_warn: undefined,
  ds_sts: 1,
}

type NumericField =
  | 'dc_normal_value'
  | 'ds_min_norm_value'
  | 'ds_max_norm_value'
  | 'ds_min_value'
  | 'ds_max_value'
  | 'ds_min_val_warn'
  | 'ds_max_val_warn'

const RANGE_FIELDS: Array<{ name: NumericField; label: string; placeholder: string }> = [
  { name: 'dc_normal_value', label: 'Nilai Normal', placeholder: 'contoh: 25' },
  { name: 'ds_min_norm_value', label: 'Normal Minimum', placeholder: 'contoh: 20' },
  { name: 'ds_max_norm_value', label: 'Normal Maksimum', placeholder: 'contoh: 30' },
  { name: 'ds_min_value', label: 'Nilai Minimum', placeholder: 'contoh: 0' },
  { name: 'ds_max_value', label: 'Nilai Maksimum', placeholder: 'contoh: 100' },
  { name: 'ds_min_val_warn', label: 'Peringatan Minimum', placeholder: 'contoh: 15' },
  { name: 'ds_max_val_warn', label: 'Peringatan Maksimum', placeholder: 'contoh: 35' },
]

interface ParameterFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  sensId: string
  devId: string
  parameter?: any
  mode: 'create' | 'edit'
}

export function ParameterFormDialog({
  open,
  onOpenChange,
  tenantId,
  sensId,
  devId,
  parameter,
  mode,
}: ParameterFormDialogProps) {
  const queryClient = useQueryClient()

  // Fetch units
  const {
    data: units,
    isLoading: unitsLoading,
    isError: unitsError,
    refetch: refetchUnits,
  } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const response = await api.get('/units')
      return response.data
    },
    enabled: open,
  })

  const form = useForm<ParameterFormValues>({
    resolver: zodResolver(parameterFormSchema),
    mode: 'onTouched',
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    if (!open) return
    if (parameter && mode === 'edit') {
      form.reset({
        ds_id: parameter.ds_id ?? '',
        ds_name: parameter.ds_name ?? '',
        ds_address: parameter.ds_address ?? '',
        unit_id: parameter.unit_id ?? '',
        ds_seq: parameter.ds_seq ?? undefined,
        dc_normal_value: parameter.dc_normal_value ?? undefined,
        ds_min_norm_value: parameter.ds_min_norm_value ?? undefined,
        ds_max_norm_value: parameter.ds_max_norm_value ?? undefined,
        ds_min_value: parameter.ds_min_value ?? undefined,
        ds_max_value: parameter.ds_max_value ?? undefined,
        ds_min_val_warn: parameter.ds_min_val_warn ?? undefined,
        ds_max_val_warn: parameter.ds_max_val_warn ?? undefined,
        ds_sts: parameter.ds_sts ?? 1,
      })
    } else {
      form.reset(EMPTY_VALUES)
    }
  }, [open, parameter, mode, form])

  // Parameters are shown on the device detail page (via the device/sensors queries).
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['device-sensors'] })
    queryClient.invalidateQueries({ queryKey: ['device-sensors', devId] })
    queryClient.invalidateQueries({ queryKey: ['sensor-parameters', sensId] })
    queryClient.invalidateQueries({ queryKey: queryKeys.device(devId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.devices(tenantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.sensors(tenantId) })
  }

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.post(`/tenants/${tenantId}/devices/${devId}/sensors/${sensId}/parameters`, data)
      return response.data
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Parameter berhasil dibuat')
      onOpenChange(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Gagal membuat parameter'
      toast.error(errorMessage)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!parameter.dev_id || !parameter.sens_id) {
        throw new Error('Device ID dan Sensor ID diperlukan untuk memperbarui parameter')
      }
      const response = await api.patch(`/devices/${parameter.dev_id}/sensors/${parameter.sens_id}/parameters/${parameter.ds_id}`, data)
      return response.data
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Parameter berhasil diperbarui')
      onOpenChange(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Gagal memperbarui parameter'
      toast.error(errorMessage)
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const handleOpenChange = guardedOpenChange(onOpenChange, {
    isDirty: form.formState.isDirty,
    isBusy: isPending,
  })

  const onSubmit = (values: ParameterFormValues) => {
    // A legitimate 0 is kept; only empty fields are omitted.
    const cleanedValues: Record<string, unknown> = {
      ...values,
      ds_seq: num(values.ds_seq),
      dc_normal_value: num(values.dc_normal_value),
      ds_min_norm_value: num(values.ds_min_norm_value),
      ds_max_norm_value: num(values.ds_max_norm_value),
      ds_min_value: num(values.ds_min_value),
      ds_max_value: num(values.ds_max_value),
      ds_min_val_warn: num(values.ds_min_val_warn),
      ds_max_val_warn: num(values.ds_max_val_warn),
    }

    if (mode === 'create') {
      createMutation.mutate(cleanedValues)
    } else {
      updateMutation.mutate(cleanedValues)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {mode === 'create' ? 'Tambah Parameter Baru' : 'Edit Parameter'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Buat parameter baru untuk sensor ini.'
              : 'Perbarui informasi parameter.'}
          </DialogDescription>
        </DialogHeader>

        {unitsError ? (
          <ErrorState title="Gagal memuat daftar satuan" onRetry={() => refetchUnits()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Parameter ID */}
                <FormField
                  control={form.control}
                  name="ds_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        ID Parameter <span aria-hidden="true">*</span>
                        <span className="sr-only"> (wajib diisi)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="contoh: PARAM001"
                          autoComplete="off"
                          aria-required="true"
                          {...field}
                          disabled={mode === 'edit'}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {mode === 'edit' ? 'ID tidak dapat diubah' : 'Pengenal unik untuk parameter ini'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Parameter Name */}
                <FormField
                  control={form.control}
                  name="ds_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nama Parameter <span aria-hidden="true">*</span>
                        <span className="sr-only"> (wajib diisi)</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="contoh: Suhu" autoComplete="off" aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Address */}
                <FormField
                  control={form.control}
                  name="ds_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Input placeholder="contoh: 0x01" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Unit ID */}
                <FormField
                  control={form.control}
                  name="unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Satuan</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={unitsLoading}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={unitsLoading ? 'Memuat satuan...' : 'Pilih satuan'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units?.map((unit: any) => (
                            <SelectItem key={unit.unit_id} value={unit.unit_id}>
                              {unit.unit_symbol ? `${unit.unit_name} (${unit.unit_symbol})` : unit.unit_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Value Ranges Section */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Rentang Nilai</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {RANGE_FIELDS.map(({ name, label, placeholder }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              placeholder={placeholder}
                              {...field}
                              value={numDisplay(field.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Sequence and Status Section */}
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground">Pengaturan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sequence */}
                  <FormField
                    control={form.control}
                    name="ds_seq"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urutan</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            step={1}
                            placeholder="contoh: 1"
                            {...field}
                            value={numDisplay(field.value)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Urutan tampilan</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="ds_sts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Aktif</SelectItem>
                            <SelectItem value="0">Nonaktif</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  {mode === 'create' ? 'Buat Parameter' : 'Perbarui Parameter'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
