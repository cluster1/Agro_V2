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

interface DeleteDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: any
  tenantId: string
}

export function DeleteDeviceDialog({
  open,
  onOpenChange,
  device,
  tenantId,
}: DeleteDeviceDialogProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/devices/${device.dev_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.device(device?.dev_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sensors(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.clusters(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sites(tenantId) })
      toast.success('Device berhasil dihapus!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus device'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleteMutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Device?</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus device <strong>{device?.dev_name}</strong>?
            Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data sensor terkait.
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
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
