'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Radio, Plus, MoreVertical, Pencil, Trash2, MapPin, Activity, Network, Eye } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { DeviceFormDialog } from '@/components/devices/device-form-dialog'
import { DeleteDeviceDialog } from '@/components/devices/delete-device-dialog'
import { canModifyEnvironment } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'

export default function DevicesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  const canModify = canModifyEnvironment(user)

  const { data: devices, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.devices(activeTenantId),
    queryFn: async () => {
      const response = await api.get(`/devices`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  const openCreate = () => {
    setFormMode('create')
    setSelectedDevice(null)
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <PageTitle>Perangkat IoT</PageTitle>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Radio className="h-4 w-4" aria-hidden="true" />
              Kelola perangkat IoT dan sensor Anda
            </p>
          </div>
          {canModify && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Device
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
        ) : devices && devices.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {devices.map((device: any, index: number) => (
              <Card
                key={device.dev_id}
                className="group relative overflow-hidden border-2 motion-safe:animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary">
                        <Radio className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{device.dev_name}</CardTitle>
                        <StatusBadge status={device.dev_sts === 1 ? 'online' : 'offline'} className="mt-1" />
                      </div>
                    </div>
                    {canModify && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Aksi untuk ${device.dev_name}`}>
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDevice(device)
                              setFormMode('edit')
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDevice(device)
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
                    {/* Location */}
                    {device.dev_location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="truncate">{device.dev_location}</span>
                      </div>
                    )}

                    {/* Device ID & Number */}
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      {device.dev_id && (
                        <div>
                          <p className="text-muted-foreground mb-1">Device ID</p>
                          <div className="font-mono bg-muted/50 px-2 py-1 rounded truncate">
                            {device.dev_id}
                          </div>
                        </div>
                      )}
                      {device.dev_number_id && (
                        <div>
                          <p className="text-muted-foreground mb-1">Nomor ID</p>
                          <div className="font-mono bg-info/15 text-foreground px-2 py-1 rounded truncate">
                            {device.dev_number_id}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* IP & Port */}
                    {device.dev_ip && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Jaringan</p>
                        <div className="flex items-center gap-2 text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                          <Network className="h-3 w-3 text-primary" aria-hidden="true" />
                          <span>{device.dev_ip}{device.dev_port ? `:${device.dev_port}` : ''}</span>
                        </div>
                      </div>
                    )}

                    {/* Coordinates & Altitude */}
                    {((device.dev_lat !== null && device.dev_lat !== undefined) ||
                      (device.dev_alt !== null && device.dev_alt !== undefined)) && (
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        {device.dev_lat !== null && device.dev_lat !== undefined &&
                          device.dev_lon !== null && device.dev_lon !== undefined && (
                          <div>
                            <p className="text-muted-foreground mb-1">Koordinat</p>
                            <div className="font-mono bg-muted/50 px-2 py-1 rounded">
                              {formatNumber(Number(device.dev_lat), { minimumFractionDigits: 4, maximumFractionDigits: 4 })},{' '}
                              {formatNumber(Number(device.dev_lon), { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                            </div>
                          </div>
                        )}
                        {device.dev_alt !== null && device.dev_alt !== undefined && (
                          <div>
                            <p className="text-muted-foreground mb-1">Ketinggian</p>
                            <div className="font-mono bg-accent text-accent-foreground px-2 py-1 rounded">
                              {formatNumber(Number(device.dev_alt), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sensor Count */}
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">Sensor</span>
                      </div>
                      <Badge variant="secondary">{device.sensors?.length ?? 0}</Badge>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/devices/${device.dev_id}`}>
                        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                        Lihat Detail
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-accent mb-4">
                <Radio className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Belum ada device</h2>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Mulai dengan menambahkan perangkat IoT pertama Anda untuk monitoring
              </p>
              {canModify && (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tambah Device
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={activeTenantId || ''}
        device={selectedDevice}
        mode={formMode}
      />
      <DeleteDeviceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        device={selectedDevice}
        tenantId={activeTenantId || ''}
      />
    </DashboardLayout>
  )
}
