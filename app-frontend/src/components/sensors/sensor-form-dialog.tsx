'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'

// Sensor schema (master data only)
const sensorFormSchema = z.object({
  sens_id: z.string().min(1, 'ID sensor wajib diisi'),
  dev_id: z.string().min(1, 'Device wajib dipilih'),
  sens_name: z.string().min(1, 'Nama sensor wajib diisi'),
  sens_location: z.string().optional(),
  sens_lat: optionalNumber(),
  sens_lon: optionalNumber(),
  sens_alt: optionalNumber(),
  sens_seq: optionalNumber(),
})

type SensorFormValues = z.infer<typeof sensorFormSchema>

interface SensorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  sensor?: any
  mode: 'create' | 'edit'
  deviceId?: string
}

export function SensorFormDialog({
  open,
  onOpenChange,
  tenantId,
  sensor,
  mode,
  deviceId,
}: SensorFormDialogProps) {
  const queryClient = useQueryClient()

  // Fetch devices for dropdown
  const {
    data: devices,
    isLoading: devicesLoading,
    isError: devicesError,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: queryKeys.devices(tenantId),
    queryFn: async () => {
      const response = await api.get(`/devices`)
      return response.data
    },
    enabled: !!tenantId && open,
  })

  const form = useForm<SensorFormValues>({
    resolver: zodResolver(sensorFormSchema),
    mode: 'onTouched',
    defaultValues: {
      sens_id: '',
      dev_id: deviceId || '',
      sens_name: '',
      sens_location: '',
      sens_lat: undefined,
      sens_lon: undefined,
      sens_alt: undefined,
      sens_seq: 0,
    },
  })

  useEffect(() => {
    if (!open) return
    if (sensor && mode === 'edit') {
      form.reset({
        sens_id: sensor.sens_id ?? '',
        dev_id: sensor.dev_id ?? '',
        sens_name: sensor.sens_name ?? '',
        sens_location: sensor.sens_location ?? '',
        sens_lat: sensor.sens_lat ?? undefined,
        sens_lon: sensor.sens_lon ?? undefined,
        sens_alt: sensor.sens_alt ?? undefined,
        sens_seq: sensor.sens_seq ?? 0,
      })
    } else {
      form.reset({
        sens_id: '',
        dev_id: deviceId || '',
        sens_name: '',
        sens_location: '',
        sens_lat: undefined,
        sens_lon: undefined,
        sens_alt: undefined,
        sens_seq: 0,
      })
    }
  }, [open, sensor, mode, form, deviceId])

  // Sensors are listed on the Sensors page, device detail ('device-sensors') and counted on the
  // Devices page, so refresh all of them.
  const invalidateAll = (devId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.devices(tenantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.sensors(tenantId) })
    queryClient.invalidateQueries({ queryKey: ['device-sensors'] })
    if (devId) {
      queryClient.invalidateQueries({ queryKey: ['device-sensors', devId] })
      queryClient.invalidateQueries({ queryKey: queryKeys.device(devId) })
    }
  }

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await api.post(`/sensors`, data)
      return response.data
    },
    onSuccess: (_data, variables) => {
      invalidateAll((variables.dev_id as string) || deviceId)
      toast.success('Sensor berhasil dibuat')
      onOpenChange(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Gagal membuat sensor'
      toast.error(errorMessage)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!sensor.dev_id) {
        throw new Error('Device ID diperlukan untuk memperbarui sensor')
      }
      const response = await api.patch(`/devices/${sensor.dev_id}/sensors/${sensor.sens_id}`, data)
      return response.data
    },
    onSuccess: () => {
      invalidateAll(sensor?.dev_id || deviceId)
      toast.success('Sensor berhasil diperbarui')
      onOpenChange(false)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Gagal memperbarui sensor'
      toast.error(errorMessage)
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const handleOpenChange = guardedOpenChange(onOpenChange, {
    isDirty: form.formState.isDirty,
    isBusy: isPending,
  })

  const onSubmit = (values: SensorFormValues) => {
    // A legitimate 0 (equator / prime meridian / sea level) is kept; empty fields are omitted.
    const cleanedValues: Record<string, unknown> = {
      sens_id: values.sens_id,
      dev_id: values.dev_id,
      sens_name: values.sens_name,
      sens_location: values.sens_location,
      sens_lat: num(values.sens_lat),
      sens_lon: num(values.sens_lon),
      sens_alt: num(values.sens_alt),
      sens_seq: num(values.sens_seq),
    }

    if (mode === 'create') {
      createMutation.mutate(cleanedValues)
    } else {
      updateMutation.mutate(cleanedValues)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {mode === 'create' ? 'Tambah Sensor Baru' : 'Edit Sensor'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Buat sensor baru. Parameter dapat ditambahkan setelah sensor dibuat.'
              : 'Perbarui informasi sensor.'}
          </DialogDescription>
        </DialogHeader>

        {devicesError ? (
          <ErrorState title="Gagal memuat daftar device" onRetry={() => refetchDevices()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sensor ID */}
                <FormField
                  control={form.control}
                  name="sens_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        ID Sensor <span aria-hidden="true">*</span>
                        <span className="sr-only"> (wajib diisi)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="contoh: SENSOR_001"
                          autoComplete="off"
                          aria-required="true"
                          {...field}
                          disabled={mode === 'edit'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Device Selection */}
                <FormField
                  control={form.control}
                  name="dev_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Device <span aria-hidden="true">*</span>
                        <span className="sr-only"> (wajib diisi)</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!deviceId || mode === 'edit' || devicesLoading}
                      >
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={devicesLoading ? 'Memuat device...' : 'Pilih device'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {devices?.map((device: any) => (
                            <SelectItem key={device.dev_id} value={device.dev_id}>
                              {device.dev_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sensor Name */}
                <FormField
                  control={form.control}
                  name="sens_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nama Sensor <span aria-hidden="true">*</span>
                        <span className="sr-only"> (wajib diisi)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="contoh: Sensor Suhu 1"
                          autoComplete="off"
                          aria-required="true"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sequence */}
                <FormField
                  control={form.control}
                  name="sens_seq"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urutan</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          step={1}
                          placeholder="0"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Location */}
                <FormField
                  control={form.control}
                  name="sens_location"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Lokasi</FormLabel>
                      <FormControl>
                        <Input placeholder="contoh: Area Greenhouse 1" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Latitude */}
                <FormField
                  control={form.control}
                  name="sens_lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="contoh: -6.2088"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Longitude */}
                <FormField
                  control={form.control}
                  name="sens_lon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="contoh: 106.8456"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Altitude */}
                <FormField
                  control={form.control}
                  name="sens_alt"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Ketinggian (m)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="contoh: 150"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  {mode === 'create' ? 'Buat Sensor' : 'Perbarui Sensor'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
