'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { alertStatus } from '@/lib/alert-status'

const NOTE_MAX = 255

interface HandleAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  alert: { alm_id: string; alcode_note?: string; dev_name?: string; alm_sts?: number | null; alm_note?: string | null } | null
}

export function HandleAlertDialog({ open, onOpenChange, alert }: HandleAlertDialogProps) {
  const queryClient = useQueryClient()
  const current = alert?.alm_sts ?? 0
  // Status only moves forward: from "Baru" offer Dilihat/Selesai, from "Dilihat" only Selesai.
  const options = [1, 2].filter((s) => s >= current)
  const [status, setStatus] = useState<string>('2')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setStatus(String(options[options.length - 1] ?? 2))
      setNote(alert?.alm_note ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alert?.alm_id])

  const mutation = useMutation({
    mutationFn: async () => {
      const body: { alm_sts: number; alm_note?: string } = { alm_sts: Number(status) }
      if (note.trim()) body.alm_note = note.trim()
      const response = await api.patch(`/alerts/${alert!.alm_id}`, body)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Status alert diperbarui')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal memperbarui alert'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tangani Alert</DialogTitle>
          <DialogDescription>
            {alert?.alcode_note || 'Alert'}
            {alert?.dev_name ? ` — ${alert.dev_name}` : ''}. Status saat ini: {alertStatus(current).label}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="alert-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {alertStatus(s).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-note">Catatan penanganan</Label>
            <Textarea
              id="alert-note"
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder="Contoh: Pompa sudah dinyalakan"
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {note.length}/{NOTE_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !alert}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
