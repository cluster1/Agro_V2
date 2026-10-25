'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { useAuth } from '@/hooks/use-auth'

interface DeleteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: any
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
}: DeleteUserDialogProps) {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const tenantId = user?.tenant_id || currentUser?.tenant_id

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Use tenant_id from the user being deleted, not the current user,
      // so an admin can delete users from other tenants.
      const response = await api.delete(`/tenants/${tenantId}/users/${user.user_id}`)
      return response.data
    },
    onSuccess: () => {
      // prefix match: the Users page key is ['users', tenant_id, user_id, role]
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
      toast.success('Pengguna berhasil dihapus!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus pengguna')
    },
  })

  const handleDelete = (e: React.MouseEvent) => {
    // Keep the dialog open until the request finishes (closed in onSuccess).
    e.preventDefault()
    if (!user) return
    deleteMutation.mutate()
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleteMutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Hapus Pengguna?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus pengguna{' '}
            <span className="font-semibold text-foreground">
              {user?.user_name}
            </span>
            ? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
