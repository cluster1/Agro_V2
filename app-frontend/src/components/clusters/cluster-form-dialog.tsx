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
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const clusterFormSchema = z.object({
  site_id: z.string().min(1, 'Site harus dipilih'),
  cluster_name: z.string().min(3, 'Nama cluster minimal 3 karakter'),
  cluster_type: z.string().optional(),
  cluster_capacity: optionalNumber(),
  cluster_current: optionalNumber(),
  cluster_desc: z.string().optional(),
})

type ClusterFormValues = z.infer<typeof clusterFormSchema>

interface ClusterFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  cluster?: any
  mode: 'create' | 'edit'
  defaultSiteId?: string
}

export function ClusterFormDialog({
  open,
  onOpenChange,
  tenantId,
  cluster,
  mode,
  defaultSiteId,
}: ClusterFormDialogProps) {
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
      const response = await api.get(`/sites`)
      return response.data
    },
    enabled: !!tenantId && open,
  })

  const form = useForm<ClusterFormValues>({
    resolver: zodResolver(clusterFormSchema),
    mode: 'onTouched',
    defaultValues: {
      site_id: defaultSiteId || '',
      cluster_name: '',
      cluster_type: 'HOUSE',
      cluster_capacity: undefined,
      cluster_current: undefined,
      cluster_desc: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (cluster && mode === 'edit') {
      form.reset({
        site_id: cluster.site_id ?? '',
        cluster_name: cluster.cluster_name ?? '',
        cluster_type: cluster.cluster_type || 'HOUSE',
        cluster_capacity: cluster.cluster_capacity ?? undefined,
        cluster_current: cluster.cluster_current ?? undefined,
        cluster_desc: cluster.cluster_desc ?? '',
      })
    } else {
      form.reset({
        site_id: defaultSiteId || '',
        cluster_name: '',
        cluster_type: 'HOUSE',
        cluster_capacity: undefined,
        cluster_current: undefined,
        cluster_desc: '',
      })
    }
  }, [open, cluster, mode, defaultSiteId, form])

  // A cluster appears on: the Clusters page + Sites page (['sites', tenant]), the site detail
  // page (['site', id]) and any cluster list, so refresh all of them.
  const invalidateAll = (siteId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sites(tenantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.site(siteId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.clusters(tenantId) })
    // prefix match: also refreshes the site detail list keyed ['clusters', siteId]
    queryClient.invalidateQueries({ queryKey: ['clusters'] })
  }

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.post(`/clusters`, values)
      return response.data
    },
    onSuccess: (_data, variables) => {
      invalidateAll(variables.site_id as string)
      toast.success('Cluster berhasil ditambahkan!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal menambahkan cluster'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.patch(`/clusters/${cluster.cluster_id}`, values)
      return response.data
    },
    onSuccess: (_data, variables) => {
      invalidateAll(variables.site_id as string)
      if (cluster?.site_id && cluster.site_id !== variables.site_id) invalidateAll(cluster.site_id)
      toast.success('Cluster berhasil diperbarui!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal memperbarui cluster'))
    },
  })

  const onSubmit = (values: ClusterFormValues) => {
    const capacity = num(values.cluster_capacity)
    const current = num(values.cluster_current)
    // Remove empty/undefined values for optional fields (a legitimate 0 is kept)
    const cleanedValues: Record<string, unknown> = {
      site_id: values.site_id,
      cluster_name: values.cluster_name,
      ...(values.cluster_type && { cluster_type: values.cluster_type }),
      ...(capacity !== undefined && { cluster_capacity: capacity }),
      ...(current !== undefined && { cluster_current: current }),
      ...(values.cluster_desc && { cluster_desc: values.cluster_desc }),
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
            {mode === 'create' ? 'Tambah Cluster Baru' : 'Edit Cluster'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tambahkan cluster baru untuk mengelompokkan device'
              : 'Perbarui informasi cluster'}
          </DialogDescription>
        </DialogHeader>

        {sitesError ? (
          <ErrorState title="Gagal memuat daftar site" onRetry={() => refetchSites()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={mode === 'edit' || !!defaultSiteId || sitesLoading}
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
                name="cluster_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nama Cluster <span aria-hidden="true">*</span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Kandang Ayam A" autoComplete="off" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cluster_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipe Cluster</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih tipe cluster" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HOUSE">House (Kandang)</SelectItem>
                        <SelectItem value="FIELD">Field (Lahan)</SelectItem>
                        <SelectItem value="ZONE">Zone (Area)</SelectItem>
                        <SelectItem value="SECTION">Section</SelectItem>
                        <SelectItem value="OTHER">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cluster_capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kapasitas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="1000"
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
                  name="cluster_current"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Populasi Saat Ini</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="800"
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
                name="cluster_desc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl>
                      <Input placeholder="Kandang layer phase 1" autoComplete="off" {...field} />
                    </FormControl>
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
                  {mode === 'create' ? 'Tambah Cluster' : 'Simpan Perubahan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
