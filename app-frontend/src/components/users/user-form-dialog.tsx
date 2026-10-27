'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
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
  FormDescription,
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
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { roleLabel } from '@/lib/format'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { PHONE_REGEX, guardedOpenChange } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

// Dynamic schema that validates based on mode
const getUserFormSchema = (mode: 'create' | 'edit') => {
  return z.object({
    user_name: z.string().min(3, 'Nama pengguna minimal 3 karakter'),
    user_email: z.string().email('Format email tidak valid'),
    user_pass: mode === 'create'
      ? z.string().min(10, 'Password minimal 10 karakter').max(72, 'Password maksimal 72 karakter')
      : z.string().min(10, 'Password minimal 10 karakter').max(72, 'Password maksimal 72 karakter').optional().or(z.literal('')),
    user_phone: z
      .string()
      .optional()
      .refine((v) => !v || PHONE_REGEX.test(v), 'Format nomor telepon tidak valid'),
    user_role: z.string().min(1, 'Role harus dipilih'),
    user_level: z.number().min(0).max(3).optional(),
    user_sts: z.string().optional(),
    tenant_id: z.string().optional(),
  })
}

// Roles assignable from this form (must match the backend's USER_ROLES). The global 'admin' role
// is offered separately, only to global admins.
const ASSIGNABLE_ROLES = ['tenant_admin', 'operator', 'agronom'] as const
// A tenant admin may only create operators (FSD F-USER-01).
const TENANT_ADMIN_ROLES = ['operator'] as const

// Access level follows the role. The backend requires role 'admin' and level 0 to go together:
// 0 = global admin, 1 = tenant admin, 2 = operator, 3 = agronom.
const levelForRole = (role: string) =>
  role === 'admin' ? 0 : role === 'tenant_admin' ? 1 : role === 'agronom' ? 3 : 2

type UserFormValues = {
  user_name: string
  user_email: string
  user_pass?: string
  user_phone?: string
  user_role: string
  user_level?: number
  user_sts?: string
  tenant_id?: string
}

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
  mode: 'create' | 'edit'
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  mode,
}: UserFormDialogProps) {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const uid = useId()
  const [showPassword, setShowPassword] = useState(false)

  // Check if current user is global admin
  const isGlobalAdmin = currentUser?.user_level === 0

  // When editing without changing the role keep the stored level (the backend forbids changing
  // one's own role/level); otherwise derive it from the chosen role.
  const levelFor = (role: string) =>
    mode === 'edit' && user && role === user.user_role && typeof user.user_level === 'number'
      ? user.user_level
      : levelForRole(role)

  // Fetch tenants list for global admin
  const {
    data: tenants,
    isError: tenantsError,
    refetch: refetchTenants,
  } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const response = await api.get('/tenants')
      return response.data
    },
    enabled: isGlobalAdmin && open,
  })

  // Memoize schema based on mode to ensure correct validation
  const schema = useMemo(() => getUserFormSchema(mode), [mode])

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      user_name: '',
      user_email: '',
      user_pass: '',
      user_phone: '',
      user_role: 'operator',
      user_level: 2,
      user_sts: 'active',
      tenant_id: currentUser?.tenant_id || '',
    },
  })

  useEffect(() => {
    if (!open) return
    setShowPassword(false)
    if (user && mode === 'edit') {
      form.reset({
        user_name: user.user_name ?? '',
        user_email: user.user_email ?? '',
        user_pass: '', // Don't populate password for security
        user_phone: user.user_phone ?? '',
        user_role: user.user_role || 'operator',
        user_level: user.user_level ?? 2,
        user_sts: user.user_sts || 'active',
        tenant_id: user.tenant_id || currentUser?.tenant_id || '',
      })
      // Clear password errors in edit mode since it's optional
      form.clearErrors('user_pass')
    } else {
      form.reset({
        user_name: '',
        user_email: '',
        user_pass: '',
        user_phone: '',
        user_role: 'operator',
        user_level: 2,
        user_sts: 'active',
        tenant_id: currentUser?.tenant_id || '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, mode, form])

  // Users appear on the Users page (key ['users', tenant_id, user_id, role]) and as counts on the
  // Tenants page, so refresh the whole 'users' prefix.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
  }

  const createMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      // Use tenant_id from form if global admin, otherwise use current user's tenant_id
      const tenantId = isGlobalAdmin && values.tenant_id ? values.tenant_id : currentUser?.tenant_id

      // Remove tenant_id from body before sending to API
      const { tenant_id, ...requestBody } = values

      const response = await api.post('/users', requestBody, tenantId ? { headers: { 'X-Tenant-Id': tenantId } } : undefined)
      return response.data
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Pengguna berhasil ditambahkan!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal menambahkan pengguna'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      // Use tenant_id from form if global admin, otherwise from user being edited
      const tenantId = isGlobalAdmin && values.tenant_id ? values.tenant_id : (user?.tenant_id || currentUser?.tenant_id)

      // Remove tenant_id from body and handle password
      const { tenant_id, ...restData } = values
      const updateData: any = { ...restData }

      // Remove password if empty (don't update password)
      if (!updateData.user_pass) {
        delete updateData.user_pass
      }

      const response = await api.patch(`/users/${user.user_id}`, updateData)
      return response.data
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Pengguna berhasil diperbarui!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, 'Gagal memperbarui pengguna'))
    },
  })

  const onSubmit = async (values: UserFormValues) => {
    // Note: tenant_id is NOT sent in body, it's used in URL path only.
    // We keep it in the values object so the mutation can use it for the URL.
    const cleanedValues = {
      user_name: values.user_name,
      user_email: values.user_email,
      ...(values.user_pass && { user_pass: values.user_pass }),
      ...(values.user_phone && { user_phone: values.user_phone }),
      user_role: values.user_role,
      user_level: levelFor(values.user_role),
      user_sts: values.user_sts || 'active',
      tenant_id: values.tenant_id,
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
            {mode === 'create' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tambahkan pengguna baru ke tenant. ID pengguna dibuat otomatis.'
              : 'Perbarui informasi pengguna. Kosongkan password jika tidak ingin mengubahnya.'}
          </DialogDescription>
        </DialogHeader>

        {tenantsError ? (
          <ErrorState title="Gagal memuat daftar tenant" onRetry={() => refetchTenants()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="user_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nama Pengguna <span aria-hidden="true">*</span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Nama lengkap" autoComplete="name" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="user_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Email <span aria-hidden="true">*</span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="nama@contoh.com"
                        aria-required="true"
                        {...field}
                        disabled={mode === 'edit'}
                      />
                    </FormControl>
                    {mode === 'edit' && (
                      <FormDescription>Email tidak dapat diubah</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="user_pass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Password{' '}
                      {mode === 'create' ? (
                        <>
                          <span aria-hidden="true">*</span>
                          <span className="sr-only"> (wajib diisi)</span>
                        </>
                      ) : (
                        '(Opsional)'
                      )}
                    </FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          className="pr-12"
                          aria-required={mode === 'create' ? 'true' : undefined}
                          placeholder={mode === 'create' ? 'Minimal 10 karakter' : 'Kosongkan jika tidak ingin mengubah'}
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="user_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Telepon</FormLabel>
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

              {/* Tenant ID Field - Only editable for Global Admin */}
              <FormField
                control={form.control}
                name="tenant_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Tenant <span aria-hidden="true">*</span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!isGlobalAdmin}
                    >
                      <FormControl>
                        <SelectTrigger aria-required="true">
                          <SelectValue placeholder="Pilih tenant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tenants?.map((tenant: any) => (
                          <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                            {tenant.tenant_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {isGlobalAdmin
                        ? 'Pilih tenant untuk pengguna ini'
                        : 'Tenant ditentukan otomatis berdasarkan akun Anda'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="user_role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Role <span aria-hidden="true">*</span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger aria-required="true">
                          <SelectValue placeholder="Pilih role pengguna" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(isGlobalAdmin || field.value === 'admin') && (
                          <SelectItem value="admin">{roleLabel('admin')}</SelectItem>
                        )}
                        {/* keep the stored role selectable so the trigger never renders blank (e.g. a tenant admin editing an agronom) */}
                        {[...(isGlobalAdmin ? ASSIGNABLE_ROLES : TENANT_ADMIN_ROLES)]
                          .concat(
                            field.value && field.value !== 'admin' && !(isGlobalAdmin ? ASSIGNABLE_ROLES : TENANT_ADMIN_ROLES).includes(field.value as any)
                              ? [field.value as any]
                              : [],
                          )
                          .map((role: string) => (
                          <SelectItem key={role} value={role}>
                            {roleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Tentukan peran pengguna. Level akses mengikuti peran secara otomatis.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="user_sts"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Status Pengguna</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="active" id={`${uid}-active`} />
                          <Label htmlFor={`${uid}-active`} className="font-normal cursor-pointer">
                            Aktif
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="inactive" id={`${uid}-inactive`} />
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
                  {mode === 'create' ? 'Tambah Pengguna' : 'Simpan Perubahan'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
