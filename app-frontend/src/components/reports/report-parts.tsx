'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { downloadBlob } from '@/lib/csv'

export function ReportStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="border-2">
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

interface DownloadButtonProps {
  url: string
  params: Record<string, string>
  format: 'xlsx' | 'pdf'
  filename: string
  label: string
  disabled?: boolean
}

/** Mengunduh laporan dari route yang sama dengan tampilan layar, dengan `format` di query. */
export function DownloadButton({ url, params, format, filename, label, disabled }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const res = await api.get(url, { params: { ...params, format }, responseType: 'blob' })
      downloadBlob(res.data, filename, res.data.type)
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal mengunduh laporan'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" onClick={run} disabled={busy || disabled}>
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-4 p-8" role="status" aria-label="Memuat laporan">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 w-full rounded bg-muted motion-safe:animate-pulse" />
      ))}
    </div>
  )
}
