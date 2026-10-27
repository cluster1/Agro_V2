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

interface DeleteActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: { pact_id: string; actype_name?: string; sched_id?: string | null } | null
}

export function DeleteActivityDialog({ open, onOpenChange, activity }: DeleteActivityDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/activities/${activity!.pact_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] }) // a linked schedule reopens
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast.success('Kegiatan dihapus')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus kegiatan'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus kegiatan?</AlertDialogTitle>
          <AlertDialogDescription>
            Kegiatan <strong>{activity?.actype_name ?? activity?.pact_id}</strong> akan dihapus.
            {activity?.sched_id ? ' Jadwal terkait dibuka kembali. ' : ' '}
            Foto tetap tersimpan di galeri. Tindakan ini tidak dapat dibatalkan.
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
