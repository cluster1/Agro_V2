import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  label?: string
  className?: string
}

/** Announced to screen readers (role=status); the spinner stops under prefers-reduced-motion. */
export function LoadingState({ label = 'Memuat...', className }: LoadingStateProps) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 p-8 text-muted-foreground', className)}>
      <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
