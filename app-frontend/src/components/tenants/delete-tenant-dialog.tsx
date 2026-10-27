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
import { apiErrorMessage } from '@/lib/api-error'

interface DeleteTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: any
}

export function DeleteTenantDialog({
  open,
  onOpenChange,
  tenant,
}: DeleteTenantDialogProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/tenants/${tenant.tenant_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants })
      toast.success('Tenant berhasil dihapus!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus tenant'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleteMutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Tenant?</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus tenant <strong>{tenant?.tenant_name}</strong>?
            <br /><br />
            <span className="text-destructive font-semibold">PERINGATAN:</span> Tindakan ini akan menghapus semua data terkait termasuk:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Semua site</li>
              <li>Semua cluster</li>
              <li>Semua device dan sensor</li>
              <li>Semua pengguna tenant ini</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            Hapus Tenant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
