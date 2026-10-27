'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import api from '@/lib/api'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import { apiErrorMessage } from '@/lib/api-error'

interface DeleteSensorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sensor: any
  tenantId: string
}

export function DeleteSensorDialog({
  open,
  onOpenChange,
  sensor,
  tenantId,
}: DeleteSensorDialogProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!sensor.dev_id) {
        throw new Error('Device ID diperlukan untuk menghapus sensor')
      }
      await api.delete(`/devices/${sensor.dev_id}/sensors/${sensor.sens_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.device(sensor?.dev_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sensors(tenantId) })
      queryClient.invalidateQueries({ queryKey: ['device-sensors'] })
      toast.success('Sensor berhasil dihapus')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus sensor'))
    },
  })

  if (!sensor) return null

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleteMutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
          <AlertDialogDescription>
            Sensor <strong>{sensor.sens_name}</strong> beserta semua parameternya akan dihapus
            secara permanen. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog open until the request finishes (closed in onSuccess).
              e.preventDefault()
              deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
