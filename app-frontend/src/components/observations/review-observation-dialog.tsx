'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'

export type ReviewAction = 'verify' | 'reject' | 'delete'

const REASON_MIN = 3
const REASON_MAX = 200

const COPY: Record<ReviewAction, { title: string; button: string; done: string; fail: string }> = {
  verify: {
    title: 'Verifikasi observasi?',
    button: 'Verifikasi',
    done: 'Observasi diverifikasi',
    fail: 'Gagal memverifikasi observasi',
  },
  reject: { title: 'Tolak observasi?', button: 'Tolak', done: 'Observasi ditolak', fail: 'Gagal menolak observasi' },
  delete: { title: 'Hapus observasi?', button: 'Hapus', done: 'Observasi dihapus', fail: 'Gagal menghapus observasi' },
}

interface ReviewObservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ReviewAction
  observation: { obs_id: string; plant_name?: string } | null
}

export function ReviewObservationDialog({ open, onOpenChange, action, observation }: ReviewObservationDialogProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const copy = COPY[action]
  const reasonValid = reason.trim().length >= REASON_MIN

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const mutation = useMutation({
    mutationFn: async () => {
      const id = observation!.obs_id
      if (action === 'verify') await api.post(`/observations/${id}/verify`)
      else if (action === 'reject') await api.post(`/observations/${id}/reject`, { reason: reason.trim() })
      else await api.delete(`/observations/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] })
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast.success(copy.done)
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, copy.fail))
    },
  })

  const destructive = action !== 'verify'

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {action === 'verify' &&
              'Hanya observasi terverifikasi yang dipakai untuk kalibrasi dan akurasi digital twin. Observasi yang sudah terverifikasi tidak bisa diubah.'}
            {action === 'reject' && 'Pengamat akan melihat alasan penolakan dan dapat memperbaiki observasi.'}
            {action === 'delete' && 'Observasi akan dihapus; foto tetap tersimpan di galeri. Tindakan ini tidak dapat dibatalkan.'}
            {observation?.plant_name ? ` (${observation.plant_name})` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {action === 'reject' && (
          <div className="space-y-2">
            <Label htmlFor="reject-reason">
              Alasan penolakan
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> (wajib diisi)</span>
            </Label>
            <Textarea
              id="reject-reason"
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              aria-required="true"
              placeholder="Mis. Foto tidak sesuai dengan nilai BWD"
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {reason.length}/{REASON_MAX}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Batal</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (action === 'reject' && !reasonValid)}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {copy.button}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
