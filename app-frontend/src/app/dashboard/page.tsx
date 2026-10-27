'use client'

import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { MapPin, Box, Radio, Building2, Activity, Cpu } from 'lucide-react'
import api from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import dynamic from 'next/dynamic'
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline'
import { WeatherCard } from '@/components/dashboard/WeatherCard'
import { SensorSummary } from '@/components/dashboard/SensorSummary'

// Dynamic import for EnhancedSitesMap to avoid SSR issues with Leaflet
const EnhancedSitesMap = dynamic(
  () => import('@/components/maps/EnhancedSitesMap').then(mod => mod.EnhancedSitesMap),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Memuat peta"
        className="h-[60vh] lg:h-[600px] rounded-lg bg-muted motion-safe:animate-pulse"
      />
    ),
  }
)

const pillClass = 'flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg'

export default function DashboardPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // For global admin, fetch global dashboard if no specific tenant is selected
  const isGlobalView = user?.user_level === 0 && !selectedTenantId

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', activeTenantId, isGlobalView],
    queryFn: async () => {
      if (isGlobalView) {
        const response = await api.get('/reports/global/dashboard')
        return response.data
      }
      const response = await api.get(`/reports/dashboard`)
      return response.data
    },
    enabled: !!user,
  })

  // Fetch combined timeline (readings + alerts)
  const {
    data: timelineData,
    isLoading: isLoadingTimeline,
    isError: isTimelineError,
    refetch: refetchTimeline,
  } = useQuery({
    queryKey: ['timeline', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/reports/timeline`)
      return response.data
    },
    enabled: !!user && !isGlobalView && !!activeTenantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch enhanced map data (sites, devices, sensors)
  const {
    data: mapData,
    isLoading: isLoadingMap,
    isError: isMapError,
    refetch: refetchMap,
  } = useQuery({
    queryKey: ['map-data', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/reports/map-data`)
      return response.data
    },
    enabled: !!user && !isGlobalView && !!activeTenantId,
  })

  // Get first site for weather data
  const firstSite = mapData?.sites?.[0]
  const hasWeatherData = firstSite && firstSite.site_lat && firstSite.site_lon

  const productTitle = process.env.NEXT_PUBLIC_PRODUCT_TITLE

  const stats = summary?.summary

  return (
    <DashboardLayout>
      <div>
        {/* Hero Section with Background Image (cancels the <main> padding, which is p-4 / md:p-6) */}
        <div className="relative h-auto min-h-60 overflow-hidden -mx-4 -mt-4 md:-mx-6 md:-mt-6 mb-8">
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/hero-agro.jpg)' }}
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/50" />

          {/* Content */}
          <div className="relative flex min-h-60 items-center px-4 py-6 md:px-8">
            <div className="text-primary-foreground space-y-3 motion-safe:animate-slide-up">
              <h1 className="text-3xl md:text-5xl font-bold drop-shadow-lg">
                {isGlobalView ? 'Dasbor Pemantauan Global' : productTitle}
              </h1>
              <p className="text-lg md:text-xl opacity-95 drop-shadow">
                Pemantauan IoT secara real-time
              </p>
              <div className="flex flex-wrap gap-3 pt-3">
                <div className={pillClass}>
                  <Activity className="h-5 w-5 motion-safe:animate-pulse" aria-hidden="true" />
                  <span className="text-sm font-medium">Status Langsung</span>
                </div>

                {/* Statistics */}
                {!isLoading && !isError && (
                  <>
                    {isGlobalView && (
                      <div className={pillClass}>
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                        <span className="text-sm font-medium tabular-nums">{formatNumber(stats?.total_tenants || 0)} Tenant</span>
                      </div>
                    )}
                    <div className={pillClass}>
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm font-medium tabular-nums">{formatNumber(stats?.total_sites || 0)} Site</span>
                    </div>
                    <div className={pillClass}>
                      <Box className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm font-medium tabular-nums">{formatNumber(stats?.total_clusters || 0)} Cluster</span>
                    </div>
                    <div className={pillClass}>
                      <Radio className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm font-medium tabular-nums">{formatNumber(stats?.total_devices || 0)} Perangkat</span>
                    </div>
                    <div className={pillClass}>
                      <Cpu className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm font-medium tabular-nums">{formatNumber(stats?.total_sensors || 0)} Sensor</span>
                    </div>
                  </>
                )}

                {isGlobalView && (
                  <Badge variant="info" className="text-sm px-4 py-2">
                    Tampilan Global
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8 pb-8">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Memuat dasbor">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="motion-safe:animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Memuat...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-20 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            {/* Content Cards */}
            {isGlobalView ? (
              <Card className="border-2 shadow-lg motion-safe:animate-slide-up">
                <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                    <CardTitle className="text-xl">Daftar Tenant</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  {summary?.tenants && summary.tenants.length > 0 ? (
                    <ul className="space-y-3">
                      {summary.tenants.map((tenant: any) => (
                        <li
                          key={tenant.tenant_id}
                          className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4 hover:border-primary/50 hover:shadow-md motion-safe:transition-all duration-200 bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg group-hover:text-primary transition-colors">
                                {tenant.tenant_name}
                              </p>
                              <Badge variant="outline" className="mt-1">
                                {tenant.tenant_type}
                              </Badge>
                            </div>
                          </div>
                          <dl className="flex gap-6 text-sm">
                            <div className="text-center">
                              <dd className="font-bold text-primary tabular-nums">{formatNumber(tenant.sites_count)}</dd>
                              <dt className="text-xs text-muted-foreground">Site</dt>
                            </div>
                            <div className="text-center">
                              <dd className="font-bold text-success tabular-nums">{formatNumber(tenant.clusters_count)}</dd>
                              <dt className="text-xs text-muted-foreground">Cluster</dt>
                            </div>
                            <div className="text-center">
                              <dd className="font-bold text-info tabular-nums">{formatNumber(tenant.devices_count)}</dd>
                              <dt className="text-xs text-muted-foreground">Perangkat</dt>
                            </div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-12">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" aria-hidden="true" />
                      <p className="text-muted-foreground">Belum ada tenant terdaftar</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
              {/* Single column below lg; 3 columns: Map | Weather+Summary | Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Map */}
                <div className="lg:col-span-1 min-w-0">
                  <Card className="border-2 shadow-lg motion-safe:animate-slide-up h-full">
                    <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                        <CardTitle className="text-base">Peta Lokasi</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {isLoadingMap ? (
                        <div
                          role="status"
                          aria-label="Memuat peta"
                          className="h-[60vh] lg:h-[600px] bg-muted motion-safe:animate-pulse rounded-lg"
                        />
                      ) : isMapError ? (
                        <ErrorState title="Gagal memuat peta" onRetry={() => refetchMap()} />
                      ) : mapData ? (
                        <EnhancedSitesMap mapData={mapData} />
                      ) : (
                        <div className="text-center py-12">
                          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" aria-hidden="true" />
                          <p className="text-sm text-muted-foreground">Data lokasi belum tersedia</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Column 2: Weather Forecast + Sensor Summary */}
                <div className="lg:col-span-1 space-y-4 min-w-0">
                  {/* Weather Forecast */}
                  {hasWeatherData && (
                    <WeatherCard
                      latitude={parseFloat(firstSite.site_lat)}
                      longitude={parseFloat(firstSite.site_lon)}
                      siteName={firstSite.site_name}
                    />
                  )}

                  {/* Sensor Summary */}
                  {activeTenantId && (
                    <SensorSummary tenantId={activeTenantId} />
                  )}
                </div>

                {/* Column 3: Activity Timeline */}
                <div className="lg:col-span-1 min-w-0">
                  <Card className="border-2 shadow-lg motion-safe:animate-slide-up flex flex-col max-h-[650px]">
                    <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                        <CardTitle className="text-base">Linimasa Aktivitas</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Peringatan • Pembaruan data
                      </p>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-hidden flex flex-col min-h-0">
                      <div className="flex-1 overflow-y-auto min-h-0">
                        {isLoadingTimeline ? (
                          <div className="space-y-2" role="status" aria-label="Memuat aktivitas">
                            {[...Array(8)].map((_, i) => (
                              <div key={i} className="flex gap-2">
                                <div className="h-5 w-5 rounded-full bg-muted motion-safe:animate-pulse" />
                                <div className="flex-1 space-y-1">
                                  <div className="h-3 bg-muted motion-safe:animate-pulse rounded w-3/4" />
                                  <div className="h-3 bg-muted motion-safe:animate-pulse rounded w-1/2" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : isTimelineError ? (
                          <ErrorState title="Gagal memuat aktivitas" onRetry={() => refetchTimeline()} className="p-4" />
                        ) : (
                          <ActivityTimeline items={timelineData || []} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              </>
            )}
          </>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}
