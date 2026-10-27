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

interface DeleteSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: any
  tenantId: string
}

export function DeleteSiteDialog({
  open,
  onOpenChange,
  site,
  tenantId,
}: DeleteSiteDialogProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/sites/${site.site_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.site(site?.site_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.clusters(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.devices(tenantId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.sensors(tenantId) })
      toast.success('Site berhasil dihapus!')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus site'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !deleteMutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Site?</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus site <strong>{site?.site_name}</strong>?
            Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data terkait.
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
