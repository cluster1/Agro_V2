'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { apiErrorMessage } from '@/lib/api-error'
import type { ResourceDef } from '@/lib/master-data'

interface DeleteMasterDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  def: ResourceDef
  row: Record<string, unknown> | null
}

export function DeleteMasterDataDialog({ open, onOpenChange, def, row }: DeleteMasterDataDialogProps) {
  const queryClient = useQueryClient()
  const id = row ? String(row[def.idKey]) : ''

  const mutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/ref/${def.resource}/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ref'] })
      toast.success('Data dihapus')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus data'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {def.label.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{id}</strong> akan dihapus untuk semua tenant. Data yang masih dipakai tidak bisa dihapus; nonaktifkan
            saja lewat kolom Status. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
            disabled={mutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
