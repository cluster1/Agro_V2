'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MapPin, Radio, AlertTriangle, Database, CpuIcon, ImageIcon, Filter, Clock } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/format'
import { MediaCarousel } from '@/components/media/media-carousel'
import { MediaGalleryModal } from '@/components/media/media-gallery-modal'
import { REFRESH_INTERVAL_MS, STALE_AFTER_MS } from '@/components/monitoring/constants'

// Recharts is heavy: load it only when a History tab actually renders a chart.
const HistoryChart = dynamic(() => import('@/components/monitoring/HistoryChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full" role="status" aria-label="Memuat grafik" />,
})

const RANGES = [
  { hours: 1, label: '1 jam', title: '1 jam terakhir' },
  { hours: 24, label: '24 jam', title: '24 jam terakhir' },
  { hours: 168, label: '7 hari', title: '7 hari terakhir' },
] as const

export default function MonitoringPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [selectedCluster, setSelectedCluster] = useState<string>('all')
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false)
  const [mediaIndex, setMediaIndex] = useState(0)

  // Reset cluster when site changes
  useEffect(() => {
    setSelectedCluster('all')
  }, [selectedSite])

  // Fetch sites
  const { data: sites } = useQuery({
    queryKey: ['sites', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/sites`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Fetch clusters for selected site
  const { data: clusters } = useQuery({
    queryKey: ['clusters', selectedSite],
    queryFn: async () => {
      const response = await api.get(`/sites/${selectedSite}/clusters`)
      return response.data
    },
    enabled: !!selectedSite && selectedSite !== 'all',
  })

  // Fetch devices with sensors
  const { data: devices, isLoading, isError, refetch } = useQuery({
    queryKey: ['monitoring-devices', activeTenantId, selectedSite, selectedCluster],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedSite && selectedSite !== 'all') params.append('siteId', selectedSite)
      if (selectedCluster && selectedCluster !== 'all') params.append('clusterId', selectedCluster)

      const response = await api.get(`/monitoring/devices?${params}`)
      return response.data
    },
    enabled: !!activeTenantId,
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  // Fetch media based on selected filters (Tenant/Site/Cluster)
  const { data: media, isError: isMediaError, refetch: refetchMedia } = useQuery({
    queryKey: ['monitoring-media', activeTenantId, selectedSite, selectedCluster],
    queryFn: async () => {
      if (!activeTenantId) return []

      // If cluster is selected, fetch media for that cluster
      if (selectedCluster && selectedCluster !== 'all') {
        const response = await api.get(`/media/cluster/${selectedCluster}?limit=10`)
        return response.data
      }

      // If site is selected, fetch media for that site
      if (selectedSite && selectedSite !== 'all') {
        const response = await api.get(`/media/site/${selectedSite}?limit=10`)
        return response.data
      }

      // Otherwise, fetch all media for the tenant
      const response = await api.get(`/media?limit=10`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  const openGallery = (index = 0) => {
    setMediaIndex(index)
    setIsMediaModalOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <PageTitle>Monitoring</PageTitle>
          <p className="text-muted-foreground mt-1">
            Data sensor real-time dan tren historis
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Site Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
                <Label htmlFor="monitoring-site" className="flex-shrink-0">Site</Label>
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger id="monitoring-site">
                    <SelectValue placeholder="Semua Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Site</SelectItem>
                    {sites?.map((site: any) => (
                      <SelectItem key={site.site_id} value={site.site_id}>
                        {site.site_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cluster Filter */}
              <div className="flex items-center gap-2">
                <Label htmlFor="monitoring-cluster" className="flex-shrink-0">Cluster</Label>
                <Select
                  value={selectedCluster}
                  onValueChange={setSelectedCluster}
                  disabled={!selectedSite || selectedSite === 'all'}
                >
                  <SelectTrigger id="monitoring-cluster">
                    <SelectValue placeholder="Semua Cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cluster</SelectItem>
                    {clusters?.map((cluster: any) => (
                      <SelectItem key={cluster.cluster_id} value={cluster.cluster_id}>
                        {cluster.cluster_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Gallery Card - Grouped by Tenant/Site/Cluster */}
        {isMediaError ? (
          <ErrorState title="Gagal memuat galeri media" onRetry={() => refetchMedia()} />
        ) : (
          media && media.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/40 border-b">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                    Galeri Media Site
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={() => openGallery(0)}>
                    Lihat semua
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <MediaCarousel
                  media={media}
                  onViewAll={(index) => openGallery(index ?? 0)}
                  autoRotate={true}
                  interval={5000}
                />
              </CardContent>
            </Card>
          )
        )}

        {/* Media Gallery Modal */}
        <MediaGalleryModal
          media={media || []}
          isOpen={isMediaModalOpen}
          onClose={() => setIsMediaModalOpen(false)}
          initialIndex={mediaIndex}
        />

        {/* Devices List */}
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label="Memuat perangkat">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : isError ? (
          <ErrorState title="Gagal memuat perangkat" onRetry={() => refetch()} />
        ) : devices?.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center">
                <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                <p className="text-muted-foreground">Perangkat tidak ditemukan</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {devices?.map((device: any) => (
              <DeviceCard key={device.dev_id} device={device} />
            ))}
          </div>
        )}

        {/* Tenant-wide feeds: the endpoints are not per-device, so they are shown once, outside the device cards */}
        {activeTenantId && !isLoading && !isError && devices && devices.length > 0 && (
          <TenantActivity activeTenantId={activeTenantId} />
        )}
      </div>
    </DashboardLayout>
  )
}

function DeviceCard({ device }: { device: any }) {
  const [hours, setHours] = useState<number>(24)
  const range = RANGES.find((r) => r.hours === hours) ?? RANGES[1]

  // Fetch history data for this device
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    refetch: refetchHistory,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['device-history', device.dev_id, hours],
    queryFn: async () => {
      const response = await api.get(`/monitoring/devices/${device.dev_id}/history?hours=${hours}`)
      return response.data
    },
    enabled: !!device.dev_id,
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/40 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" aria-hidden="true" />
              {device.dev_name}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {device.dev_location || 'Lokasi belum diisi'}
              </span>
              <Badge variant="secondary" className="tabular-nums">
                Jumlah sensor: {formatNumber(device.sensors?.length || 0)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-6">
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="today">Hari Ini</TabsTrigger>
            <TabsTrigger value="history">Riwayat</TabsTrigger>
          </TabsList>

          {/* Today Tab */}
          <TabsContent value="today" className="space-y-6 mt-6">
            <div className="text-lg font-semibold text-muted-foreground">
              {formatDateTime(new Date(), 'EEEE, dd MMMM yyyy')}
            </div>

            {/* Sensors Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {device.sensors?.map((sensor: any) => (
                <SensorCard key={sensor.sens_id} sensor={sensor} />
              ))}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6 mt-6">
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Riwayat ({range.title})
                </h3>
                <div role="group" aria-label="Rentang waktu riwayat" className="flex gap-1">
                  {RANGES.map((r) => (
                    <Button
                      key={r.hours}
                      type="button"
                      size="sm"
                      variant={r.hours === hours ? 'default' : 'outline'}
                      aria-pressed={r.hours === hours}
                      className="coarse:min-h-[44px] coarse:min-w-[44px]"
                      onClick={() => setHours(r.hours)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Menampilkan hingga 100 pembacaan terbaru per parameter dalam {range.title}.
              </p>
              <Card className="bg-muted/30">
                <CardContent className="p-4 md:p-6">
                  {isLoadingHistory ? (
                    <div role="status" className="flex h-64 items-center justify-center text-muted-foreground">
                      Memuat data riwayat...
                    </div>
                  ) : isHistoryError ? (
                    <ErrorState title="Gagal memuat riwayat" onRetry={() => refetchHistory()} />
                  ) : historyData && historyData.length > 0 && historyData.some((d: any) => d.readings && d.readings.length > 0) ? (
                    <HistoryChart historyData={historyData} rangeLabel={range.title} dataUpdatedAt={dataUpdatedAt} />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                      <p>Belum ada data riwayat</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

/** Newest update time across a sensor's parameters. */
function latestUpdate(sensor: any): number | null {
  let latest: number | null = null
  sensor.parameters?.forEach((param: any) => {
    const raw = param.latestReading?.read_update_date
    if (!raw) return
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t
  })
  return latest
}

function SensorCard({ sensor }: { sensor: any }) {
  const updatedAt = latestUpdate(sensor)
  // Stale when older than STALE_AFTER_MS (see constants.ts); status is icon + text, not colour only
  const isStale = updatedAt !== null && Date.now() - updatedAt > STALE_AFTER_MS

  return (
    <Card className="border-2 hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CpuIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            {sensor.sens_name}
          </CardTitle>
          {updatedAt !== null && (
            <StatusBadge
              status={isStale ? 'offline' : 'online'}
              label={isStale ? 'Data tidak terbaru' : 'Terkini'}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sensor.parameters?.map((param: any) => {
          const value = param.latestReading?.read_update_value
          return (
            <div key={param.ds_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{param.ds_name}</span>
              <span className="font-semibold tabular-nums">
                {value !== null && value !== undefined
                  ? `${formatNumber(Number(value))} ${param.unit?.unit_symbol || ''}`
                  : 'N/A'}
              </span>
            </div>
          )
        })}
        {updatedAt !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t tabular-nums">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>Diperbarui: {formatDateTime(updatedAt, 'dd MMM yyyy HH:mm:ss')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TenantActivity({ activeTenantId }: { activeTenantId: string }) {
  // Fetch last readings (tenant-wide: the response carries no device id)
  const {
    data: lastReadings,
    isLoading: isLoadingLastReadings,
    isError: isLastReadingsError,
    refetch: refetchLastReadings,
  } = useQuery({
    queryKey: ['last-readings', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/monitoring/last-readings?limit=10`)
      return response.data
    },
    enabled: !!activeTenantId,
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  // Fetch alerts (tenant-wide)
  const {
    data: alerts,
    isLoading: isLoadingAlerts,
    isError: isAlertsError,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['alerts', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/monitoring/alerts?hours=24`)
      return response.data
    },
    enabled: !!activeTenantId,
    refetchInterval: REFRESH_INTERVAL_MS,
  })

  return (
    <section aria-labelledby="tenant-activity-title" className="space-y-4">
      <div>
        <h2 id="tenant-activity-title" className="text-xl font-semibold">
          Aktivitas Terbaru
        </h2>
        <p className="text-sm text-muted-foreground">
          Menampilkan data seluruh perangkat pada tenant ini, bukan hanya satu perangkat.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Peringatan (24 jam terakhir)
          </h3>
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              {isLoadingAlerts ? (
                <div role="status" className="h-48 flex items-center justify-center text-muted-foreground">
                  Memuat peringatan...
                </div>
              ) : isAlertsError ? (
                <ErrorState title="Gagal memuat peringatan" onRetry={() => refetchAlerts()} className="p-4" />
              ) : alerts && alerts.length > 0 ? (
                <AlertTimeline alerts={alerts} />
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  Tidak ada peringatan dalam 24 jam terakhir
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Last Data Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
            <Database className="h-4 w-4" aria-hidden="true" />
            Data Terakhir
          </h3>
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              {isLoadingLastReadings ? (
                <div role="status" className="h-48 flex items-center justify-center text-muted-foreground">
                  Memuat data terakhir...
                </div>
              ) : isLastReadingsError ? (
                <ErrorState title="Gagal memuat data terakhir" onRetry={() => refetchLastReadings()} className="p-4" />
              ) : lastReadings && lastReadings.length > 0 ? (
                <LastDataTimeline lastReadings={lastReadings} />
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  Belum ada data terbaru
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function AlertTimeline({ alerts }: { alerts: any[] }) {
  return (
    <ol className="relative max-h-96 overflow-y-auto space-y-4 py-2">
      <span aria-hidden="true" className="absolute left-4 top-0 bottom-0 w-0.5 bg-destructive/30" />
      {alerts.map((alert: any, index: number) => (
        <li key={index} className="relative flex gap-4 pl-2">
          <span
            aria-hidden="true"
            className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-background"
          >
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </span>

          <div className="flex-1 pb-2 min-w-0">
            <div className="bg-background rounded-lg border border-destructive/30 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-sm text-destructive">{alert.alcode_note || 'Peringatan'}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {formatDateTime(alert.alm_date)}
                </div>
              </div>
              <dl className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-foreground">Perangkat:</dt>
                  <dd>{alert.dev_name}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-foreground">Parameter:</dt>
                  <dd>{alert.ds_name}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-foreground">Nilai:</dt>
                  <dd className="font-semibold text-destructive tabular-nums">
                    {formatNumber(Number(alert.read_value))} {alert.unit_symbol}
                  </dd>
                </div>
                <div className="text-xs mt-2 pt-2 border-t tabular-nums">
                  Waktu pembacaan: {alert.read_date}
                </div>
              </dl>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function LastDataTimeline({ lastReadings }: { lastReadings: any[] }) {
  return (
    <ol className="relative max-h-96 overflow-y-auto space-y-4 py-2">
      <span aria-hidden="true" className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary/30" />
      {lastReadings.map((reading: any, index: number) => (
        <li key={index} className="relative flex gap-4 pl-2">
          <span
            aria-hidden="true"
            className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background"
          >
            <Database className="h-4 w-4 text-primary" />
          </span>

          <div className="flex-1 pb-2 min-w-0">
            <div className="bg-background rounded-lg border p-3 shadow-sm">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-muted-foreground">Perangkat:</dt>
                  <dd className="font-semibold text-foreground">{reading.dev_name}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-muted-foreground">Parameter:</dt>
                  <dd className="text-foreground">{reading.ds_name}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-muted-foreground">Waktu:</dt>
                  <dd className="text-xs text-muted-foreground tabular-nums">{reading.read_date}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-medium text-muted-foreground">Nilai:</dt>
                  <dd className="font-bold text-primary tabular-nums">
                    {formatNumber(Number(reading.read_value))} {reading.unit_symbol}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
