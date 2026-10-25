'use client'

import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitle } from '@/components/ui/page-title'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Radio,
  MapPin,
  Activity,
  Network,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Gauge,
  Pencil,
  Plus,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { DeviceFormDialog } from '@/components/devices/device-form-dialog'
import { SensorFormDialog } from '@/components/sensors/sensor-form-dialog'
import { ParameterFormDialog } from '@/components/parameters/parameter-form-dialog'
import { canModifyEnvironment } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'

const hasValue = (v: unknown) => v !== null && v !== undefined

export default function DeviceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dev_id = params.dev_id as string
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const [deviceFormOpen, setDeviceFormOpen] = useState(false)
  const [sensorFormOpen, setSensorFormOpen] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState<any>(null)
  const [sensorFormMode, setSensorFormMode] = useState<'create' | 'edit'>('create')
  const [parameterFormOpen, setParameterFormOpen] = useState(false)
  const [selectedParameter, setSelectedParameter] = useState<any>(null)
  const [parameterFormMode, setParameterFormMode] = useState<'create' | 'edit'>('create')
  const [currentSensorId, setCurrentSensorId] = useState<string>('')

  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  const canModify = canModifyEnvironment(user)

  // Fetch device details
  const {
    data: device,
    isLoading: deviceLoading,
    isError: deviceError,
    error: deviceErrorObj,
    refetch: refetchDevice,
  } = useQuery({
    queryKey: queryKeys.device(dev_id),
    queryFn: async () => {
      const response = await api.get(`/devices/${dev_id}`)
      return response.data
    },
    enabled: !!dev_id,
  })

  // Fetch sensors for this device
  const {
    data: sensors,
    isLoading: sensorsLoading,
    isError: sensorsError,
    refetch: refetchSensors,
  } = useQuery({
    queryKey: ['device-sensors', dev_id],
    queryFn: async () => {
      const response = await api.get(`/devices/${dev_id}/sensors`)
      return response.data
    },
    enabled: !!dev_id,
  })

  const isLoading = deviceLoading || sensorsLoading
  const notFound = deviceError && (deviceErrorObj as any)?.response?.status === 404

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div>
              <PageTitle>Detail Device</PageTitle>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Radio className="h-4 w-4" aria-hidden="true" />
                Detail device dan sensor
              </p>
            </div>
          </div>
          {device && canModify && (
            <Button onClick={() => setDeviceFormOpen(true)} variant="outline">
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Perbarui Device
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : deviceError && !notFound ? (
          <ErrorState onRetry={() => refetchDevice()} />
        ) : device ? (
          <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
            {/* Left Panel - Device Details */}
            <Card className="border-2 h-fit lg:sticky lg:top-6">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary">
                    <Radio className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">{device.dev_name}</CardTitle>
                    <StatusBadge status={device.dev_sts === 1 ? 'online' : 'offline'} className="mt-1" />
                  </div>
                  {canModify && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeviceFormOpen(true)}
                      aria-label="Edit device"
                    >
                      <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Device ID */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Device ID</p>
                  <div className="font-mono text-sm bg-muted/50 px-3 py-2 rounded">{device.dev_id}</div>
                </div>

                {/* Number ID */}
                {device.dev_number_id && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nomor ID</p>
                    <div className="font-mono text-sm bg-info/15 text-foreground px-3 py-2 rounded">
                      {device.dev_number_id}
                    </div>
                  </div>
                )}

                {/* Location */}
                {device.dev_location && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Lokasi</p>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{device.dev_location}</span>
                    </div>
                  </div>
                )}

                {/* Network */}
                {device.dev_ip && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Jaringan</p>
                    <div className="flex items-center gap-2 text-sm font-mono bg-muted/50 px-3 py-2 rounded">
                      <Network className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{device.dev_ip}{device.dev_port ? `:${device.dev_port}` : ''}</span>
                    </div>
                  </div>
                )}

                {/* Coordinates */}
                {hasValue(device.dev_lat) && hasValue(device.dev_lon) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Koordinat</p>
                    <div className="font-mono text-sm bg-muted/50 px-3 py-2 rounded">
                      {formatNumber(Number(device.dev_lat), { minimumFractionDigits: 6, maximumFractionDigits: 6 })},{' '}
                      {formatNumber(Number(device.dev_lon), { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </div>
                  </div>
                )}

                {/* Altitude */}
                {hasValue(device.dev_alt) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Ketinggian</p>
                    <div className="font-mono text-sm bg-accent text-accent-foreground px-3 py-2 rounded">
                      {formatNumber(Number(device.dev_alt), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="pt-4 border-t space-y-2">
                  {device.dev_created && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Dibuat: </span>
                      <span className="font-medium">{formatDateTime(device.dev_created)}</span>
                    </div>
                  )}
                  {device.dev_update && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Diperbarui: </span>
                      <span className="font-medium">{formatDateTime(device.dev_update)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Panel - Sensors List */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
                    <CardTitle>Sensor</CardTitle>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {sensors?.length ?? 0}
                    </Badge>
                  </div>
                  {canModify && (
                    <Button
                      onClick={() => {
                        setSensorFormMode('create')
                        setSelectedSensor(null)
                        setSensorFormOpen(true)
                      }}
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tambah Sensor
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {sensorsError ? (
                  <ErrorState title="Gagal memuat sensor" onRetry={() => refetchSensors()} />
                ) : sensors && sensors.length > 0 ? (
                  <div className="space-y-3">
                    {sensors.map((sensor: any, index: number) => (
                      <SensorItem
                        key={sensor.sens_id}
                        sensor={sensor}
                        index={index}
                        canModify={canModify}
                        onEdit={(sensor) => {
                          setSelectedSensor(sensor)
                          setSensorFormMode('edit')
                          setSensorFormOpen(true)
                        }}
                        onAddParameter={(sensorId) => {
                          setCurrentSensorId(sensorId)
                          setParameterFormMode('create')
                          setSelectedParameter(null)
                          setParameterFormOpen(true)
                        }}
                        onEditParameter={(parameter) => {
                          setCurrentSensorId(parameter.sens_id)
                          setSelectedParameter(parameter)
                          setParameterFormMode('edit')
                          setParameterFormOpen(true)
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 rounded-full bg-muted inline-block mb-3">
                      <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <p className="text-muted-foreground">Belum ada sensor terdaftar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-destructive/10 mb-4">
                <Radio className="h-12 w-12 text-destructive" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Device tidak ditemukan</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Device dengan ID tersebut tidak ditemukan
              </p>
              <Button onClick={() => router.push('/devices')}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Kembali ke Daftar Device
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Device Form Dialog */}
      {device && (
        <DeviceFormDialog
          open={deviceFormOpen}
          onOpenChange={setDeviceFormOpen}
          tenantId={activeTenantId || ''}
          device={device}
          mode="edit"
        />
      )}

      {/* Sensor Form Dialog */}
      <SensorFormDialog
        open={sensorFormOpen}
        onOpenChange={setSensorFormOpen}
        tenantId={activeTenantId || ''}
        sensor={selectedSensor}
        mode={sensorFormMode}
        deviceId={dev_id}
      />

      {/* Parameter Form Dialog */}
      <ParameterFormDialog
        open={parameterFormOpen}
        onOpenChange={setParameterFormOpen}
        tenantId={activeTenantId || ''}
        sensId={currentSensorId}
        devId={dev_id}
        parameter={selectedParameter}
        mode={parameterFormMode}
      />
    </DashboardLayout>
  )
}

function ParamValue({ value, className }: { value: unknown; className?: string }) {
  return (
    <span className={cn('font-mono font-semibold', className)}>
      {hasValue(value) ? String(value) : '-'}
    </span>
  )
}

// Sensor Item Component with Collapsible Parameters
function SensorItem({
  sensor,
  index,
  canModify,
  onEdit,
  onAddParameter,
  onEditParameter,
}: {
  sensor: any
  index: number
  canModify: boolean
  onEdit: (sensor: any) => void
  onAddParameter: (sensorId: string) => void
  onEditParameter: (parameter: any) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()
  const sensorName = sensor.sens_name || 'Sensor tanpa nama'
  const paramCount = sensor.parameters?.length ?? 0

  return (
    <Card
      className="border motion-safe:animate-slide-up"
      style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex flex-1 items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-[44px]"
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-label={`${isOpen ? 'Tutup' : 'Buka'} detail sensor ${sensorName}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="p-2 rounded-lg bg-info">
              <Gauge className="h-4 w-4 text-info-foreground" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{sensorName}</div>
              <div className="text-xs text-muted-foreground font-mono">{sensor.sens_id}</div>
            </div>
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
          <div className="flex items-center gap-2">
            {paramCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {paramCount} Parameter
              </Badge>
            )}
            {canModify && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Edit sensor ${sensorName}`}
                onClick={() => onEdit(sensor)}
              >
                <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <div
        id={panelId}
        hidden={!isOpen}
        className="overflow-hidden"
      >
        <CardContent className="pt-0 space-y-4">
          {/* Sensor Details */}
          <div className="grid grid-cols-1 gap-3 text-sm pb-3 border-b sm:grid-cols-2">
            {sensor.sens_location && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Lokasi</p>
                <div className="flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3 text-primary" aria-hidden="true" />
                  <span className="truncate">{sensor.sens_location}</span>
                </div>
              </div>
            )}
            {hasValue(sensor.sens_lat) && hasValue(sensor.sens_lon) && (
              <div className={sensor.sens_location ? '' : 'sm:col-span-2'}>
                <p className="text-muted-foreground text-xs mb-1">Koordinat</p>
                <div className="font-mono bg-muted/50 px-2 py-1 rounded text-xs">
                  {formatNumber(Number(sensor.sens_lat), { minimumFractionDigits: 6, maximumFractionDigits: 6 })},{' '}
                  {formatNumber(Number(sensor.sens_lon), { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                </div>
              </div>
            )}
          </div>

          {/* Parameters */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-info" aria-hidden="true" />
                Parameter
                {paramCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {paramCount}
                  </Badge>
                )}
              </h3>
              {canModify && (
                <Button size="sm" variant="outline" className="text-xs" onClick={() => onAddParameter(sensor.sens_id)}>
                  <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                  Tambah Parameter
                </Button>
              )}
            </div>

            {paramCount > 0 ? (
              <div className="space-y-2">
                {sensor.parameters.map((param: any) => (
                  <div key={param.ds_id} className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                    {/* Parameter Name - Single Line with Edit */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{param.ds_name || 'Parameter'}</span>
                      {canModify && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit parameter ${param.ds_name || ''}`.trim()}
                          onClick={() => onEditParameter(param)}
                        >
                          <Pencil className="h-3 w-3 text-info" aria-hidden="true" />
                        </Button>
                      )}
                    </div>

                    {/* Row 1: Address, Normal Value, Unit */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">Alamat: </span>
                        <span className="font-mono font-semibold">{param.ds_address || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nilai Normal: </span>
                        <ParamValue value={param.dc_normal_value} className="text-success" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Satuan: </span>
                        <span className="font-mono font-semibold">{param.unit_id || '-'}</span>
                      </div>
                    </div>

                    {/* Row 2: Min Value, Max Value */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Nilai Min.: </span>
                        <ParamValue value={param.ds_min_value} />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nilai Maks.: </span>
                        <ParamValue value={param.ds_max_value} />
                      </div>
                    </div>

                    {/* Row 3: Min Normal, Max Normal */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Normal Min.: </span>
                        <ParamValue value={param.ds_min_norm_value} className="text-info" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Normal Maks.: </span>
                        <ParamValue value={param.ds_max_norm_value} className="text-info" />
                      </div>
                    </div>

                    {/* Row 4: Min Warning, Max Warning */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Peringatan Min.: </span>
                        <ParamValue value={param.ds_min_val_warn} />
                      </div>
                      <div>
                        <span className="text-muted-foreground">Peringatan Maks.: </span>
                        <ParamValue value={param.ds_max_val_warn} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <p>Belum ada parameter.</p>
                <p className="text-xs mt-1">Klik &quot;Tambah Parameter&quot; untuk membuat satu.</p>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
