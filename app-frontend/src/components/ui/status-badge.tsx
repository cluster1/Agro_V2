import * as React from 'react'
import { CheckCircle2, MinusCircle, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Status = 'active' | 'inactive' | 'online' | 'offline'

// State is always conveyed by icon + text, never by colour alone.
const CONFIG: Record<Status, { label: string; Icon: React.ComponentType<{ className?: string }>; className: string }> = {
  active: { label: 'Aktif', Icon: CheckCircle2, className: 'border-success/40 text-success' },
  inactive: { label: 'Nonaktif', Icon: MinusCircle, className: 'border-border text-muted-foreground' },
  online: { label: 'Online', Icon: Wifi, className: 'border-success/40 text-success' },
  offline: { label: 'Offline', Icon: WifiOff, className: 'border-destructive/40 text-destructive' },
}

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status
  /** Override the default Indonesian label. */
  label?: string
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const { label: defaultLabel, Icon, className: tone } = CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs font-semibold',
        tone,
        className
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label ?? defaultLabel}
    </span>
  )
}
