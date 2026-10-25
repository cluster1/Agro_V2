import * as React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message?: string
  /** Wire to the query's `refetch`. Hides the button when omitted. */
  onRetry?: () => void
  className?: string
}

/**
 * Shown when a request FAILS, so a network/server error is never mistaken for
 * "no data". Always offers a way to recover.
 */
export function ErrorState({
  title = 'Gagal memuat data',
  message = 'Terjadi kesalahan saat mengambil data. Periksa koneksi Anda lalu coba lagi.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-card p-8 text-center',
        className
      )}
    >
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Coba lagi
        </Button>
      )}
    </div>
  )
}
