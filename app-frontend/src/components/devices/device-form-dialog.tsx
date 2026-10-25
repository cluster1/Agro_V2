'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { Loader2 } from 'lucide-react'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'

const deviceFormSchema = z.object({
  dev_name: z.string().min(3, 'Nama device minimal 3 karakter'),
  site_id: z.string().min(1, 'Site harus dipilih'),
  cluster_id: z.string().optional(),
  dev_token: z.string().optional(),
  dev_location: z.string().optional(),
  dev_lon: optionalNumber(),
  dev_lat: optionalNumber(),
  dev_alt: optionalNumber(),
  dev_number_id: z.string().optional(),
  dev_ip: z.string().optional(),
  dev_port: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d{1,5}$/.test(v) && Number(v) >= 1 && Number(v) <= 65535), 'Port harus berupa angka 1-65535'),
  dev_sts: z.coerce.number().optional(),
})

type DeviceFormValues = z.infer<typeof deviceFormSchema>

const EMPTY_VALUES: DeviceFormValues = {
  dev_name: '',
  site_id: '',
  cluster_id: '',
  dev_token: '',
  dev_location: '',
  dev_lon: undefined,
  dev_lat: undefined,
  dev_alt: undefined,
  dev_number_id: '',
  dev_ip: '',
  dev_port: '',
  dev_sts: 1,
}

interface DeviceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  device?: any
  mode: 'create' | 'edit'
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  tenantId,
  device,
  mode,
}: DeviceFormDialogProps) {
  const queryClient = useQueryClient()

  // Fetch sites for dropdown
  const {
    data: sites,
    isLoading: sitesLoading,
    isError: sitesError,
    refetch: refetchSites,
  } = useQuery({
    queryKey: queryKeys.sites(tenantId),
    queryFn: async () => {
      const response = await api.get(`/tenants/${tenantId}/sites`)
      return response.data
    },
    enabled: !!tenantId && open,
  })

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    mode: 'onTouched',
    defaultValues: EMPTY_VALUES,
  })

  const selectedSiteId = form.watch('site_id')

  // Get clusters for selected site
  const selectedSite = sites?.find((s: any) => s.site_id === selectedSiteId)
  const availableClusters = selectedSite?.clusters || []

  useEffect(() => {
    if (!open) return
    if (device && mode === 'edit') {
      form.reset({
        dev_name: device.dev_name ?? '',
        site_id: device.site_id ?? '',
        cluster_id: device.cluster_id ?? '',
        dev_token: device.dev_token ?? '',
        dev_location: device.dev_location ?? '',
        dev_lon: device.dev_lon ?? undefined,
        dev_lat: device.dev_lat ?? undefined,
        dev_alt: device.dev_alt ?? undefined,
        dev_number_id: device.dev_number_id ?? '',
        dev_ip: device.dev_ip ?? '',
        dev_port: device.dev_port != null ? String(device.dev_port) : '',
        dev_sts: device.dev_sts ?? 1,
      })
    } else {
      form.reset(EMPTY_VALUES)
    }
  }, [open, device, mode, form])

  // Devices appear on the Devices page, device detail, sensors list, and the cluster/site pages
  // (['sites', tenant] embeds clusters), so refresh them all.
  const invalidateAll = (devId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.devices(tenantId) })
    if (devId) queryClient.invalidateQueries({ queryKey: queryKeys.device(devId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.sensors(tenantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.clusters(tenantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.sites(tenantId) })
  }

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.post(`/tenants/${tenantId}/devices`, values)
      return response.data
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Device berhasil ditambahkan!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambahkan device')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.patch(`/tenants/${tenantId}/devices/${device.dev_id}`, values)
      return response.data
    },
    onSuccess: () => {
      invalidateAll(device.dev_id)
      toast.success('Device berhasil diperbarui!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memperbarui device')
    },
  })

  const onSubmit = (values: DeviceFormValues) => {
    const lon = num(values.dev_lon)
    const lat = num(values.dev_lat)
    const alt = num(values.dev_alt)
    // Remove empty/undefined values for optional fields (a legitimate 0 is kept)
    const cleanedValues: Record<string, unknown> = {
      dev_name: values.dev_name,
      site_id: values.site_id,
      ...(values.cluster_id && { cluster_id: values.cluster_id }),
      ...(values.dev_token && { dev_token: values.dev_token }),
      ...(values.dev_location && { dev_location: values.dev_location }),
      ...(lon !== undefined && { dev_lon: lon }),
      ...(lat !== undefined && { dev_lat: lat }),
      ...(alt !== undefined && { dev_alt: alt }),
      ...(values.dev_number_id && { dev_number_id: values.dev_number_id }),
      ...(values.dev_ip && { dev_ip: values.dev_ip }),
      ...(values.dev_port && { dev_port: values.dev_port }),
      ...(values.dev_sts !== undefined && { dev_sts: values.dev_sts }),
    }

    if (mode === 'create') {
      createMutation.mutate(cleanedValues)
    } else {
      updateMutation.mutate(cleanedValues)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending
  const handleOpenChange = guardedOpenChange(onOpenChange, {
    isDirty: form.formState.isDirty,
    isBusy: isLoading,
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {mode === 'create' ? 'Tambah Device Baru' : 'Edit Device'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tambahkan device IoT baru untuk monitoring'
              : 'Perbarui informasi device'}
          </DialogDescription>
        </DialogHeader>

        {sitesError ? (
          <ErrorState title="Gagal memuat daftar site" onRetry={() => refetchSites()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="dev_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nama Device <span aria-hidden="true">*</span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="IoT Node 1" autoComplete="off" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="site_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Site <span aria-hidden="true">*</span>
                        <span className="sr-only"> (wajib diisi)</span>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value)
                          form.setValue('cluster_id', '')
                        }}
                        value={field.value}
                        disabled={mode === 'edit' || sitesLoading}
                      >
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={sitesLoading ? 'Memuat site...' : 'Pilih site'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sites?.map((site: any) => (
                            <SelectItem key={site.site_id} value={site.site_id}>
                              {site.site_name}
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
                  name="cluster_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cluster (Opsional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedSiteId || availableClusters.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih cluster" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableClusters.map((cluster: any) => (
                            <SelectItem key={cluster.cluster_id} value={cluster.cluster_id}>
                              {cluster.cluster_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dev_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi</FormLabel>
                    <FormControl>
                      <Input placeholder="Pojok A, Kandang 1" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="dev_lon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="106.8456"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dev_lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="-6.2088"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dev_alt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ketinggian (m)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="150"
                          {...field}
                          value={numDisplay(field.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dev_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token</FormLabel>
                      <FormControl>
                        <Input placeholder="token-abc123xyz" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dev_number_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor ID</FormLabel>
                      <FormControl>
                        <Input placeholder="DEV-001" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dev_ip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat IP</FormLabel>
                      <FormControl>
                        <Input placeholder="192.168.1.100" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dev_port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" placeholder="8080" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dev_sts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={String(field.value ?? 1)}
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

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isLoading}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  {mode === 'create' ? 'Tambah Device' : 'Simpan Perubahan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
