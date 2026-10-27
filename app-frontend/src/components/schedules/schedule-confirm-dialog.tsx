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

export type ScheduleAction = 'cancel' | 'delete'

const COPY: Record<ScheduleAction, { title: string; verb: string; done: string; fail: string; destructive: boolean }> = {
  cancel: {
    title: 'Batalkan jadwal?',
    verb: 'Batalkan jadwal',
    done: 'Jadwal dibatalkan',
    fail: 'Gagal membatalkan jadwal',
    destructive: false,
  },
  delete: {
    title: 'Hapus jadwal?',
    verb: 'Hapus',
    done: 'Jadwal dihapus',
    fail: 'Gagal menghapus jadwal',
    destructive: true,
  },
}

interface ScheduleConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ScheduleAction
  schedule: { sched_id: string; sched_title?: string } | null
}

export function ScheduleConfirmDialog({ open, onOpenChange, action, schedule }: ScheduleConfirmDialogProps) {
  const queryClient = useQueryClient()
  const copy = COPY[action]

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'cancel') await api.patch(`/schedules/${schedule!.sched_id}`, { sched_sts: 3 })
      else await api.delete(`/schedules/${schedule!.sched_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success(copy.done)
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, copy.fail))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            Jadwal <strong>{schedule?.sched_title}</strong>{' '}
            {action === 'cancel'
              ? 'akan ditandai dibatalkan dan tidak bisa diubah lagi.'
              : 'akan dihapus. Tindakan ini tidak dapat dibatalkan.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Kembali</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
            disabled={mutation.isPending}
            className={copy.destructive ? 'bg-destructive hover:bg-destructive/90' : undefined}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {copy.verb}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
