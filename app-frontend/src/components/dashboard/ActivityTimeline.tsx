"use client";

import { Activity, AlertTriangle, Bell, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineItem {
  type: 'reading' | 'alert';
  dev_name: string;
  ds_name: string;
  formatted_date: string;
  read_value: string;
  unit_symbol: string;
  alert_type?: string;
  alert_message?: string;
}

interface ActivityTimelineProps {
  items: TimelineItem[];
}

type Tone = 'warning' | 'danger' | 'info';

function toneFor(alertType?: string): Tone {
  switch (alertType?.toLowerCase()) {
    case 'warning':
      return 'warning';
    case 'critical':
    case 'danger':
      return 'danger';
    default:
      return 'info';
  }
}

const TONE_STYLES: Record<Tone, { card: string; dot: string; label: string }> = {
  warning: { card: 'border-warning/60 bg-warning/5', dot: 'border-warning bg-warning/20', label: 'Peringatan' },
  danger: { card: 'border-destructive/50 bg-destructive/5', dot: 'border-destructive bg-destructive/15', label: 'Kritis' },
  info: { card: 'border-info/50 bg-info/5', dot: 'border-info bg-info/15', label: 'Informasi' },
};

const TONE_ICON = { warning: AlertTriangle, danger: AlertCircle, info: Bell } as const;

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" aria-hidden="true" />
        <p className="text-muted-foreground">Belum ada aktivitas</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 pr-2">
      {/* Timeline rail */}
      <span aria-hidden="true" className="absolute bottom-0 left-3 top-2 w-0.5 bg-border" />

      {items.map((item, index) => {
        const isAlert = item.type === 'alert';
        const tone = toneFor(item.alert_type);
        const styles = TONE_STYLES[tone];
        const AlertIcon = TONE_ICON[tone];

        return (
          <li key={index} className="relative flex gap-3">
            {/* Dot (decorative; type is conveyed by the text label) */}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 mt-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2',
                isAlert ? styles.dot : 'border-primary bg-primary/15'
              )}
            >
              {isAlert ? <AlertIcon className="h-3 w-3 text-foreground" /> : <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>

            <div
              className={cn(
                'min-w-0 flex-1 rounded-lg border bg-card p-3 motion-safe:transition-shadow hover:shadow-md',
                isAlert && styles.card
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {isAlert && (
                    <p className="text-xs font-semibold uppercase text-foreground">
                      {item.alert_type || styles.label}
                    </p>
                  )}
                  <h4 className="truncate text-sm font-semibold text-foreground">{item.dev_name}</h4>
                  <p className="truncate text-xs text-muted-foreground">{item.ds_name}</p>
                </div>
                {item.read_value && (
                  <div className="flex-shrink-0 text-right tabular-nums">
                    <span className={cn('text-sm font-bold', isAlert ? 'text-foreground' : 'text-primary')}>
                      {item.read_value}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">{item.unit_symbol}</span>
                  </div>
                )}
              </div>
              {isAlert && item.alert_message && <p className="mt-2 text-xs text-foreground">{item.alert_message}</p>}
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>{item.formatted_date}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
