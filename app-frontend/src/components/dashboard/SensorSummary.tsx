'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Gauge } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'

interface SensorSummaryProps {
  tenantId: string
}

export function SensorSummary({ tenantId }: SensorSummaryProps) {
  const { user } = useAuth()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sensor-summary', tenantId],
    queryFn: async () => {
      const response = await api.get(`/tenants/${tenantId}/monitoring/sensor-summary`)
      return response.data
    },
    refetchInterval: 30000,
    enabled: !!tenantId && !!user,
    retry: 2,
  })

  const header = (badge?: React.ReactNode) => (
    <CardHeader className="py-3 px-4 border-b">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          <CardTitle className="text-base">Ringkasan Sensor</CardTitle>
        </div>
        {badge}
      </div>
    </CardHeader>
  )

  if (!user || isLoading) {
    return (
      <Card className="border-2 shadow-lg motion-safe:animate-slide-up" role="status" aria-label="Memuat ringkasan sensor">
        {header()}
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card className="border-2 shadow-lg motion-safe:animate-slide-up">
        {header()}
        <CardContent className="p-4">
          <ErrorState
            title="Gagal memuat ringkasan sensor"
            message="Data sensor belum dapat dimuat."
            onRetry={() => refetch()}
            className="p-4"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 shadow-lg motion-safe:animate-slide-up">
      {header(
        <Badge variant="secondary" className="tabular-nums">
          {formatNumber(data.total)} Parameter
        </Badge>
      )}
      <CardContent className="p-4 space-y-3">
        {/* Status Overview */}
        <div
          className={cn(
            'p-3 rounded-lg flex items-center gap-3 border',
            data.all_normal ? 'border-success/40 bg-success/10' : 'border-warning/60 bg-warning/10'
          )}
        >
          {data.all_normal ? (
            <>
              <CheckCircle className="h-6 w-6 text-success flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Semua parameter normal</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatNumber(data.normal)} parameter dalam kondisi baik
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-foreground flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatNumber(data.abnormal)} parameter tidak normal
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatNumber(data.normal)} normal • {formatNumber(data.abnormal)} perlu perhatian
                </p>
              </div>
            </>
          )}
        </div>

        {/* Abnormal Parameters */}
        {!data.all_normal && data.abnormal_params && data.abnormal_params.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Parameter tidak normal:</p>
            <ul className="max-h-[200px] overflow-y-auto space-y-2">
              {data.abnormal_params.map((param: any, idx: number) => (
                <li key={idx} className="p-2 rounded bg-muted/30 border space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {param.status === 'below' ? (
                        <TrendingDown className="h-3.5 w-3.5 text-info flex-shrink-0" aria-hidden="true" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-hidden="true" />
                      )}
                      <span className="text-sm font-medium truncate">{param.sensor_name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'flex-shrink-0',
                        param.status === 'below' ? 'border-info text-info' : 'border-destructive text-destructive'
                      )}
                    >
                      {param.status === 'below' ? 'Di bawah normal' : 'Di atas normal'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Perangkat: {param.device_name || param.device_id}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold tabular-nums">
                      {formatNumber(Number(param.value))} {param.unit}
                    </span>
                    <span className="text-foreground">{param.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats */}
        <dl className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <dt className="text-xs text-muted-foreground">Total</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatNumber(data.total)}</dd>
          </div>
          <div className="text-center">
            <dt className="text-xs text-muted-foreground">Normal</dt>
            <dd className="text-sm font-semibold tabular-nums text-success">{formatNumber(data.normal)}</dd>
          </div>
          <div className="text-center">
            <dt className="text-xs text-muted-foreground">Tidak normal</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(data.abnormal)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
