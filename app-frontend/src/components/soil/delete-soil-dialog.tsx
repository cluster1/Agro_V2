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

interface DeleteSoilDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: { soil_id: string; soil_sample_code?: string | null; cluster_name?: string } | null
}

export function DeleteSoilDialog({ open, onOpenChange, profile }: DeleteSoilDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/soil-profiles/${profile!.soil_id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soil-profiles'] })
      toast.success('Profil tanah dihapus')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menghapus profil tanah'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus profil tanah?</AlertDialogTitle>
          <AlertDialogDescription>
            Sampel <strong>{profile?.soil_sample_code || profile?.cluster_name || profile?.soil_id}</strong> akan dihapus.
            Rekomendasi pupuk berikutnya akan dianggap tanpa data lab. Tindakan ini tidak dapat dibatalkan.
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
