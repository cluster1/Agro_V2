'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { Loader2 } from 'lucide-react'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'

const siteFormSchema = z.object({
  site_name: z.string().min(3, 'Nama site minimal 3 karakter'),
  site_type: z.string().optional(),
  site_address: z.string().optional(),
  site_lon: optionalNumber(),
  site_lat: optionalNumber(),
  site_alt: optionalNumber(),
  site_sts: z.coerce.number().optional(),
})

type SiteFormValues = z.infer<typeof siteFormSchema>

const EMPTY_VALUES: SiteFormValues = {
  site_name: '',
  site_type: 'FARM',
  site_address: '',
  site_lon: undefined,
  site_lat: undefined,
  site_alt: undefined,
  site_sts: 1,
}

interface SiteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  site?: any
  mode: 'create' | 'edit'
}

export function SiteFormDialog({
  open,
  onOpenChange,
  tenantId,
  site,
  mode,
}: SiteFormDialogProps) {
  const queryClient = useQueryClient()

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    mode: 'onTouched',
    defaultValues: EMPTY_VALUES,
  })

  // Reset form whenever the dialog opens or the site changes
  useEffect(() => {
    if (!open) return
    if (site && mode === 'edit') {
      form.reset({
        site_name: site.site_name ?? '',
        site_type: site.site_type || 'FARM',
        site_address: site.site_address ?? '',
        site_lon: site.site_lon ?? undefined,
        site_lat: site.site_lat ?? undefined,
        site_alt: site.site_alt ?? undefined,
        site_sts: site.site_sts ?? 1,
      })
    } else {
      form.reset(EMPTY_VALUES)
    }
  }, [open, site, mode, form])

  const invalidateAll = (siteId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sites(tenantId) })
    if (siteId) queryClient.invalidateQueries({ queryKey: queryKeys.site(siteId) })
  }

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.post(`/tenants/${tenantId}/sites`, values)
      return response.data
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Site berhasil ditambahkan!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menambahkan site')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.patch(`/tenants/${tenantId}/sites/${site.site_id}`, values)
      return response.data
    },
    onSuccess: () => {
      invalidateAll(site?.site_id)
      toast.success('Site berhasil diperbarui!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal memperbarui site')
    },
  })

  const onSubmit = (values: SiteFormValues) => {
    const lon = num(values.site_lon)
    const lat = num(values.site_lat)
    const alt = num(values.site_alt)
    // Remove empty/undefined values for optional fields (a legitimate 0 is kept)
    const cleanedValues: Record<string, unknown> = {
      site_name: values.site_name,
      ...(values.site_type && { site_type: values.site_type }),
      ...(values.site_address && { site_address: values.site_address }),
      ...(lon !== undefined && { site_lon: lon }),
      ...(lat !== undefined && { site_lat: lat }),
      ...(alt !== undefined && { site_alt: alt }),
      ...(values.site_sts !== undefined && { site_sts: values.site_sts }),
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {mode === 'create' ? 'Tambah Site Baru' : 'Edit Site'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tambahkan site baru untuk lokasi pertanian/peternakan'
              : 'Perbarui informasi site'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="site_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nama Site <span aria-hidden="true">*</span>
                    <span className="sr-only"> (wajib diisi)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Lahan Padi Sawah 1" autoComplete="off" aria-required="true" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Site</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tipe site" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FARM">Farm (Pertanian)</SelectItem>
                      <SelectItem value="RANCH">Ranch (Peternakan)</SelectItem>
                      <SelectItem value="GREENHOUSE">Greenhouse</SelectItem>
                      <SelectItem value="PLANTATION">Plantation (Perkebunan)</SelectItem>
                      <SelectItem value="OTHER">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Input placeholder="Desa Sukamaju, Kec. XXX" autoComplete="street-address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="site_lon"
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
                name="site_lat"
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
                name="site_alt"
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

            <FormField
              control={form.control}
              name="site_sts"
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
                {mode === 'create' ? 'Tambah Site' : 'Simpan Perubahan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
