'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'info' | 'primary'
  className?: string
}

// Semantic tokens only: they switch with the theme, so no per-variant dark: overrides are needed.
const variantStyles = {
  default: 'from-muted/60 to-muted/30 border-border',
  success: 'from-success/10 to-success/5 border-success/30',
  warning: 'from-warning/15 to-warning/5 border-warning/40',
  info: 'from-info/10 to-info/5 border-info/30',
  primary: 'from-primary/10 to-primary/5 border-primary/20',
}

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/25 text-foreground',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-2 transition-all duration-300 motion-safe:hover:shadow-xl motion-safe:hover:-translate-y-1 motion-safe:animate-fade-in',
        'bg-gradient-to-br',
        variantStyles[variant],
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight tabular-nums">{value}</h3>
              {trend && (
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    trend.isPositive ? 'text-success' : 'text-destructive'
                  )}
                >
                  <span aria-hidden="true">{trend.isPositive ? '↑' : '↓'}</span>
                  <span className="sr-only">{trend.isPositive ? 'Naik' : 'Turun'}</span>{' '}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={cn(
              'p-3 rounded-xl motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:scale-110',
              iconVariantStyles[variant]
            )}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
