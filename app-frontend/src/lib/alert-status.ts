import type { BadgeProps } from '@/components/ui/badge'

/** Status penanganan alert (tm_alarm.alm_sts). */
export const ALERT_STATUS: Record<number, { label: string; variant: BadgeProps['variant'] }> = {
  0: { label: 'Baru', variant: 'destructive' },
  1: { label: 'Dilihat', variant: 'warning' },
  2: { label: 'Selesai', variant: 'success' },
}

export const alertStatus = (sts: number | null | undefined) => ALERT_STATUS[sts ?? 0] ?? ALERT_STATUS[0]

/** Kode alarm yang dikenali backend (tr_alarm_code), untuk filter. */
export const ALERT_CODES: { value: string; label: string }[] = [
  { value: 'ALARM-HIGH', label: 'Nilai terlalu tinggi' },
  { value: 'ALARM-LOW', label: 'Nilai terlalu rendah' },
  { value: 'ALARM-WARN-HIGH', label: 'Peringatan tinggi' },
  { value: 'ALARM-WARN-LOW', label: 'Peringatan rendah' },
  { value: 'ALARM-DEVICE-OFFLINE', label: 'Perangkat offline' },
]
