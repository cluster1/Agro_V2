'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Gauge, Plus, ArrowLeft, MoreVertical, Pencil, Trash2, MapPin, Radio, Activity } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { SensorFormDialog } from '@/components/sensors/sensor-form-dialog'
import { DeleteSensorDialog } from '@/components/sensors/delete-sensor-dialog'
import { canModifyEnvironment } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'

const hasValue = (v: unknown) => v !== null && v !== undefined

function SensorsPageContent() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState<any>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const searchParams = useSearchParams()
  const router = useRouter()
  const devIdFilter = searchParams.get('dev_id')

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  const canModify = canModifyEnvironment(user)

  // Sensors are embedded in the devices payload, so this page reads the devices list.
  const { data: devices, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.devices(activeTenantId),
    queryFn: async () => {
      const response = await api.get(`/devices`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Filter devices by dev_id if provided
  const filteredDevices = devIdFilter
    ? devices?.filter((device: any) => device.dev_id === devIdFilter)
    : devices

  // Get device name for breadcrumb
  const selectedDevice = devIdFilter && devices
    ? devices.find((device: any) => device.dev_id === devIdFilter)
    : null

  const openCreate = () => {
    setFormMode('create')
    setSelectedSensor(null)
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        {selectedDevice && (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/devices" className="text-muted-foreground hover:text-primary transition-colors">
              Device
            </Link>
            <span className="text-muted-foreground" aria-hidden="true">/</span>
            <span className="text-primary font-medium" aria-current="page">{selectedDevice.dev_name}</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {selectedDevice.sensors?.length ?? 0} Sensor
            </Badge>
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {selectedDevice && (
                <Button variant="ghost" size="icon" onClick={() => router.push('/devices')} aria-label="Kembali">
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
              )}
              <div>
                <PageTitle>{selectedDevice ? `Sensor - ${selectedDevice.dev_name}` : 'Sensor'}</PageTitle>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                  {selectedDevice ? `Sensor di ${selectedDevice.dev_name}` : 'Kelola sensor IoT di setiap device'}
                </p>
              </div>
            </div>
          </div>
          {canModify && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Sensor
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : filteredDevices && filteredDevices.length > 0 ? (
          <div className="space-y-6">
            {filteredDevices.map((device: any) => (
              <div key={device.dev_id}>
                {!selectedDevice && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Radio className="h-5 w-5 text-primary" aria-hidden="true" />
                      {device.dev_name}
                      <Badge variant="secondary" className="text-xs">
                        {device.sensors?.length ?? 0} Sensor
                      </Badge>
                    </h2>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/sensors?dev_id=${device.dev_id}`}>Lihat Semua</Link>
                    </Button>
                  </div>
                )}

                {device.sensors && device.sensors.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {device.sensors.map((sensor: any, index: number) => (
                      <Card
                        key={sensor.sens_id}
                        className="group relative overflow-hidden border-2 motion-safe:animate-slide-up"
                        style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary">
                                <Gauge className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{sensor.sens_name || sensor.sens_id}</CardTitle>
                                {sensor.sens_address && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    Alamat: {sensor.sens_address}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {canModify && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Aksi untuk ${sensor.sens_name || sensor.sens_id}`}
                                  >
                                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedSensor(sensor)
                                      setFormMode('edit')
                                      setFormOpen(true)
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedSensor(sensor)
                                      setDeleteOpen(true)
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Hapus
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            {/* Sensor ID */}
                            <div>
                              <p className="text-muted-foreground text-xs mb-1">ID Sensor</p>
                              <div className="text-xs font-mono bg-muted/50 px-2 py-1 rounded truncate">
                                {sensor.sens_id}
                              </div>
                            </div>

                            {/* Location */}
                            {sensor.sens_location && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                                <span className="truncate">{sensor.sens_location}</span>
                              </div>
                            )}

                            {/* Coordinates & Altitude */}
                            {(hasValue(sensor.sens_lat) || hasValue(sensor.sens_alt)) && (
                              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                {hasValue(sensor.sens_lat) && hasValue(sensor.sens_lon) && (
                                  <div>
                                    <p className="text-muted-foreground mb-1">Koordinat</p>
                                    <div className="font-mono bg-muted/50 px-2 py-1 rounded">
                                      {formatNumber(Number(sensor.sens_lat), { minimumFractionDigits: 4, maximumFractionDigits: 4 })},{' '}
                                      {formatNumber(Number(sensor.sens_lon), { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                    </div>
                                  </div>
                                )}
                                {hasValue(sensor.sens_alt) && (
                                  <div>
                                    <p className="text-muted-foreground mb-1">Ketinggian</p>
                                    <div className="font-mono bg-accent text-accent-foreground px-2 py-1 rounded">
                                      {formatNumber(Number(sensor.sens_alt), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2 border-t">
                            {canModify && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedSensor(sensor)
                                  setFormMode('edit')
                                  setFormOpen(true)
                                }}
                              >
                                <Pencil className="mr-1 h-3 w-3" aria-hidden="true" />
                                Perbarui
                              </Button>
                            )}
                            {/* "Data" had no handler; the device detail page lists this sensor's parameters. */}
                            <Button asChild size="sm" className="flex-1">
                              <Link href={`/devices/${device.dev_id}`}>
                                <Activity className="mr-1 h-3 w-3" aria-hidden="true" />
                                Lihat Data
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-2 border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground mb-4">Belum ada sensor di device ini</p>
                      {canModify && (
                        <Button variant="outline" size="sm" onClick={openCreate}>
                          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                          Tambah Sensor
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-accent mb-4">
                <Gauge className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Belum ada sensor</h2>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Tambahkan device terlebih dahulu untuk membuat sensor
              </p>
              <Button asChild>
                <Link href="/devices">
                  <Radio className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ke halaman Device
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <SensorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={activeTenantId || ''}
        sensor={selectedSensor}
        mode={formMode}
        deviceId={devIdFilter || undefined}
      />
      <DeleteSensorDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        sensor={selectedSensor}
        tenantId={activeTenantId || ''}
      />
    </DashboardLayout>
  )
}

export default function SensorsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <SensorsPageContent />
    </Suspense>
  )
}
