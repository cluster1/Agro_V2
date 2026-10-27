import { AlertTriangle, Ban, CalendarClock, CheckCircle2, type LucideIcon } from 'lucide-react'
import type { BadgeProps } from '@/components/ui/badge'

/** Status jadwal (tm_plant_schedule.sched_sts). Status 4 (terlambat) dihitung backend dari tanggal selesai. */
export const SCHEDULE_STATUS: Record<number, { label: string; variant: BadgeProps['variant']; icon: LucideIcon }> = {
  0: { label: 'Rencana', variant: 'info', icon: CalendarClock },
  2: { label: 'Selesai', variant: 'success', icon: CheckCircle2 },
  3: { label: 'Dibatalkan', variant: 'secondary', icon: Ban },
  4: { label: 'Terlambat', variant: 'destructive', icon: AlertTriangle },
}

export const scheduleStatus = (sts: number | null | undefined) => SCHEDULE_STATUS[sts ?? 0] ?? SCHEDULE_STATUS[0]

export const SCHEDULE_SOURCE: Record<string, string> = {
  MANUAL: 'Manual',
  TEMPLATE: 'Templat',
  MODEL: 'Model',
}

export const SCHEDULE_REPEAT: Record<string, string> = {
  NONE: 'Tidak berulang',
  DAILY: 'Harian',
  WEEKLY: 'Mingguan',
  MONTHLY: 'Bulanan',
}

/** Jadwal masih bisa diubah/dibatalkan hanya bila belum selesai atau dibatalkan. */
export const isScheduleOpen = (sts: number | null | undefined) => sts === 0 || sts === 4
