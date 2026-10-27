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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'

const todayISO = () => new Date().toISOString().slice(0, 10)

interface ClosePlantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plant: any
}

export function ClosePlantDialog({ open, onOpenChange, plant }: ClosePlantDialogProps) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayISO())

  useEffect(() => {
    if (open) setDate(todayISO())
  }, [open])

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/plants/${plant.plant_id}/close`, { plant_harvest_date: date })).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] }) // open schedules were cancelled
      toast.success(`Musim ditutup; ${data?.schedules_cancelled ?? 0} jadwal dibatalkan`)
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menutup musim'))
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tutup musim?</AlertDialogTitle>
          <AlertDialogDescription>
            Musim <strong>{plant?.plant_season}</strong> untuk <strong>{plant?.plant_name}</strong> akan ditutup. Jadwal
            yang belum selesai dibatalkan dan tanaman tidak bisa diubah lagi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="close-plant-date">Tanggal panen/penutupan</Label>
          <Input
            id="close-plant-date"
            type="date"
            value={date}
            min={plant?.plant_date ?? undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Batal</AlertDialogCancel>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !date}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            Tutup musim
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
