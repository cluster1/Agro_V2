'use client'

import { useEffect, useId, useRef, useState } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { Loader2, Trash2 } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { uploadUrl } from '@/lib/utils'
import { PHONE_REGEX, UNSAVED_MESSAGE } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'


const tenantFormSchema = z.object({
  tenant_name: z.string().min(3, 'Nama tenant minimal 3 karakter'),
  tenant_type: z.string().optional(),
  tenant_address: z.string().optional(),
  tenant_contact: z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), 'Format nomor telepon tidak valid'),
  tenant_pic: z.string().optional(),
  tenant_logo: z.string().optional(),
  tenant_sts: z.number().min(0).max(1).optional(),
})

type TenantFormValues = z.infer<typeof tenantFormSchema>

const EMPTY_VALUES: TenantFormValues = {
  tenant_name: '',
  tenant_type: 'perusahaan',
  tenant_address: '',
  tenant_contact: '',
  tenant_pic: '',
  tenant_logo: '',
  tenant_sts: 1,
}


interface TenantFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: any
  mode: 'create' | 'edit'
}

export function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
  mode,
}: TenantFormDialogProps) {
  const queryClient = useQueryClient()
  const uid = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoCleared, setLogoCleared] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    mode: 'onTouched',
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    if (!open) return
    setLogoFile(null)
    setLogoCleared(false)
    if (tenant && mode === 'edit') {
      form.reset({
        tenant_name: tenant.tenant_name ?? '',
        tenant_type: tenant.tenant_type || 'perusahaan',
        tenant_address: tenant.tenant_address ?? '',
        tenant_contact: tenant.tenant_contact ?? '',
        tenant_pic: tenant.tenant_pic ?? '',
        tenant_logo: tenant.tenant_logo ?? '',
        tenant_sts: tenant.tenant_sts ?? 1,
      })
      setLogoPreview(tenant.tenant_logo ? uploadUrl(tenant.tenant_logo) : null)
    } else {
      form.reset(EMPTY_VALUES)
      setLogoPreview(null)
    }
  }, [open, tenant, mode, form])

  const finishSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
    onOpenChange(false)
  }

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.post('/tenants', values)
      return response.data
    },
    onSuccess: () => {
      toast.success('Tenant berhasil ditambahkan!')
      finishSuccess()
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal menambahkan tenant'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const response = await api.patch(`/tenants/${tenant.tenant_id}`, values)
      return response.data
    },
    onSuccess: () => {
      toast.success('Tenant berhasil diperbarui!')
      finishSuccess()
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal memperbarui tenant'))
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending || isUploadingLogo

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (isLoading) return
      if (form.formState.isDirty || logoFile || logoCleared) {
        if (!window.confirm(UNSAVED_MESSAGE)) return
      }
    }
    onOpenChange(next)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB')
      e.target.value = ''
      return
    }

    if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
      toast.error('Hanya file gambar (JPG, PNG, GIF, WebP) yang diperbolehkan')
      e.target.value = ''
      return
    }

    setLogoFile(file)
    setLogoCleared(false)

    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoCleared(true)
    form.setValue('tenant_logo', '', { shouldDirty: true })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadLogo = async (): Promise<string> => {
    const formData = new FormData()
    formData.append('logo', logoFile as File)
    const response = await api.post('/tenants/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data.path
  }

  const onSubmit = async (values: TenantFormValues) => {
    let logoPath = values.tenant_logo || ''

    if (logoFile) {
      setIsUploadingLogo(true)
      try {
        logoPath = await uploadLogo()
      } catch (error: any) {
        // Abort: never save the tenant without the logo the user chose.
        toast.error(apiErrorMessage(error, 'Gagal mengunggah logo. Tenant belum disimpan.'))
        return
      } finally {
        setIsUploadingLogo(false)
      }
    }

    const cleanedValues: Record<string, unknown> = {
      tenant_name: values.tenant_name,
      ...(values.tenant_type && { tenant_type: values.tenant_type }),
      ...(values.tenant_address && { tenant_address: values.tenant_address }),
      ...(values.tenant_contact && { tenant_contact: values.tenant_contact }),
      ...(values.tenant_pic && { tenant_pic: values.tenant_pic }),
      ...(logoPath && { tenant_logo: logoPath }),
      tenant_sts: values.tenant_sts ?? 1,
    }
    // Explicitly clear an existing logo when the user removed it.
    if (mode === 'edit' && logoCleared && !logoPath) {
      cleanedValues.tenant_logo = ''
    }

    if (mode === 'create') {
      createMutation.mutate(cleanedValues)
    } else {
      updateMutation.mutate(cleanedValues)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {mode === 'create' ? 'Tambah Tenant Baru' : 'Edit Tenant'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tambahkan tenant/organisasi baru ke sistem. ID tenant akan dibuat otomatis dengan format TENANT1, TENANT2, dst.'
              : 'Perbarui informasi tenant'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tenant_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nama Tenant <span aria-hidden="true">*</span>
                    <span className="sr-only"> (wajib diisi)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="PT Agro Sejahtera" autoComplete="organization" aria-required="true" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenant_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Tenant</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tipe tenant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="perusahaan">Perusahaan</SelectItem>
                      <SelectItem value="koperasi">Koperasi</SelectItem>
                      <SelectItem value="individu">Individu</SelectItem>
                      <SelectItem value="pemerintah">Pemerintah</SelectItem>
                      <SelectItem value="lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenant_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Input placeholder="Jl. Pertanian No. 123" autoComplete="street-address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenant_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontak</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+62812345678"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenant_pic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Penanggung Jawab (PIC)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama penanggung jawab" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenant_sts"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Status Tenant</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-3 space-y-0">
                        <RadioGroupItem value="1" id={`${uid}-active`} />
                        <Label htmlFor={`${uid}-active`} className="font-normal cursor-pointer">
                          Aktif
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 space-y-0">
                        <RadioGroupItem value="0" id={`${uid}-inactive`} />
                        <Label htmlFor={`${uid}-inactive`} className="font-normal cursor-pointer">
                          Nonaktif
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor={`${uid}-logo`}>Logo Tenant</Label>
              <div className="flex flex-wrap items-start gap-4">
                {logoPreview && (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-border">
                    <img src={logoPreview} alt="Pratinjau logo" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <Input
                    id={`${uid}-logo`}
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: JPG, PNG, GIF, WebP. Maksimal 5MB.
                  </p>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleRemoveLogo}
                      disabled={isLoading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Hapus logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

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
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {mode === 'create' ? 'Tambah Tenant' : 'Simpan Perubahan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
