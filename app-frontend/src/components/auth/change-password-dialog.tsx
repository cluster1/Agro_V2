'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation } from '@tanstack/react-query'
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
import { api } from '@/lib/api'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { guardedOpenChange } from '@/components/forms/form-utils'
import { apiErrorMessage } from '@/lib/api-error'

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(10, 'Password baru minimal 10 karakter').max(72, 'Password maksimal 72 karakter'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi password tidak sama dengan password baru',
  path: ['confirmPassword'],
})

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PasswordFieldProps {
  control: Control<ChangePasswordFormValues>
  name: keyof ChangePasswordFormValues
  label: string
  placeholder: string
  autoComplete: 'current-password' | 'new-password'
  disabled: boolean
}

function PasswordField({ control, name, label, placeholder, autoComplete, disabled }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} <span aria-hidden="true">*</span>
            <span className="sr-only"> (wajib diisi)</span>
          </FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                autoComplete={autoComplete}
                className="pr-12"
                aria-required="true"
                {...field}
                disabled={disabled}
              />
            </FormControl>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setVisible((v) => !v)}
              disabled={disabled}
              aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
              aria-pressed={visible}
            >
              {visible ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (values: ChangePasswordFormValues) => {
      const response = await api.post('/auth/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      })
      return response.data
    },
    onSuccess: () => {
      toast.success('Password berhasil diubah')
      form.reset()
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal mengubah password'))
    },
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(values)
  }

  const isLoading = changePasswordMutation.isPending

  const guarded = guardedOpenChange(
    (next) => {
      if (!next) form.reset()
      onOpenChange(next)
    },
    { isDirty: form.formState.isDirty, isBusy: isLoading }
  )

  return (
    <Dialog open={open} onOpenChange={guarded}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">Ubah Password</DialogTitle>
          <DialogDescription>
            Masukkan password lama Anda dan password baru yang diinginkan (minimal 10 karakter).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <PasswordField
              control={form.control}
              name="oldPassword"
              label="Password Lama"
              placeholder="Masukkan password lama"
              autoComplete="current-password"
              disabled={isLoading}
            />

            <PasswordField
              control={form.control}
              name="newPassword"
              label="Password Baru"
              placeholder="Minimal 10 karakter"
              autoComplete="new-password"
              disabled={isLoading}
            />

            <PasswordField
              control={form.control}
              name="confirmPassword"
              label="Konfirmasi Password Baru"
              placeholder="Ulangi password baru"
              autoComplete="new-password"
              disabled={isLoading}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => guarded(false)}
                disabled={isLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                Ubah Password
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
