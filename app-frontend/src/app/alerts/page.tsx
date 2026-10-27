'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Bell, AlertTriangle, Filter, X, Download, Search, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { format } from 'date-fns'
import { formatDateTime, formatNumber } from '@/lib/format'
import { canHandleAlerts } from '@/lib/permissions'
import { ALERT_CODES, ALERT_STATUS, alertStatus } from '@/lib/alert-status'
import { HandleAlertDialog } from '@/components/alerts/handle-alert-dialog'

interface AlertData {
  alm_id: string
  alm_date: string
  alcode_id: string
  alm_sts: number | null
  alm_ack_user: string | null
  alm_ack_date: string | null
  alm_note: string | null
  alcode_note: string
  dev_name: string
  dev_id: string
  ds_name: string
  ds_id: string
  read_date: string
  read_value: number
  unit_symbol: string
  site_name: string
  site_id: string
  cluster_name: string
  cluster_id: string
}

const DAY_FORMAT = 'yyyy-MM-dd'

function defaultStart() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date
}

/** Quote a CSV cell: double embedded quotes and neutralise spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export default function AlertsPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Default to last 7 days
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStart)
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date())
  const [selectedSite, setSelectedSite] = useState<string | undefined>(undefined)
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>(undefined)
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(undefined)
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined)
  const [selectedCode, setSelectedCode] = useState<string | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')
  const [handling, setHandling] = useState<AlertData | null>(null)
  const canHandle = canHandleAlerts(user)

  // The default 7-day window is not an "active filter"; any other range is.
  const isDefaultRange =
    !!startDate && !!endDate &&
    format(startDate, DAY_FORMAT) === format(defaultStart(), DAY_FORMAT) &&
    format(endDate, DAY_FORMAT) === format(new Date(), DAY_FORMAT)
  const hasActiveFilters =
    !!searchTerm || !!selectedSite || !!selectedCluster || !!selectedDevice || !!selectedStatus || !!selectedCode || !isDefaultRange

  // Fetch alerts with filters
  const { data: alerts, isLoading, isError, refetch } = useQuery({
    queryKey: ['alerts', activeTenantId, startDate, endDate, selectedSite, selectedCluster, selectedDevice, selectedStatus, selectedCode],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', format(startDate, DAY_FORMAT))
      if (endDate) params.append('endDate', format(endDate, DAY_FORMAT))
      if (selectedSite) params.append('siteId', selectedSite)
      if (selectedCluster) params.append('clusterId', selectedCluster)
      if (selectedDevice) params.append('deviceId', selectedDevice)
      if (selectedStatus) params.append('status', selectedStatus)
      if (selectedCode) params.append('code', selectedCode)

      const response = await api.get(`/alerts?${params.toString()}`)
      return response.data as AlertData[]
    },
    enabled: !!activeTenantId,
  })

  // Fetch sites for filter
  const { data: sites } = useQuery({
    queryKey: ['sites', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/sites`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Fetch clusters for filter
  const { data: clusters } = useQuery({
    queryKey: ['clusters', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/clusters`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Fetch devices for filter
  const { data: devices } = useQuery({
    queryKey: ['devices', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/devices`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  const handleClearFilters = () => {
    // Reset to default 7 days
    setStartDate(defaultStart())
    setEndDate(new Date())
    setSelectedSite(undefined)
    setSelectedCluster(undefined)
    setSelectedDevice(undefined)
    setSelectedStatus(undefined)
    setSelectedCode(undefined)
    setSearchTerm('')
  }

  // Newest first, then text search
  const filteredAlerts = useMemo(() => {
    const search = searchTerm.toLowerCase()
    return [...(alerts ?? [])]
      .filter((alert) => {
        if (!search) return true
        return (
          alert.alcode_note?.toLowerCase().includes(search) ||
          alert.dev_name?.toLowerCase().includes(search) ||
          alert.ds_name?.toLowerCase().includes(search) ||
          alert.site_name?.toLowerCase().includes(search) ||
          alert.cluster_name?.toLowerCase().includes(search)
        )
      })
      .sort((a, b) => new Date(b.alm_date).getTime() - new Date(a.alm_date).getTime())
  }, [alerts, searchTerm])

  const exportToCSV = () => {
    if (filteredAlerts.length === 0) return

    const headers = ['Tanggal Alarm', 'Kode Alarm', 'Site', 'Cluster', 'Perangkat', 'Sensor', 'Tanggal Baca', 'Nilai', 'Satuan', 'Status', 'Catatan']
    const rows = filteredAlerts.map(alert => [
      alert.alm_date,
      alert.alcode_note || '',
      alert.site_name || '',
      alert.cluster_name || '',
      alert.dev_name || '',
      alert.ds_name || '',
      alert.read_date || '',
      alert.read_value ?? '',
      alert.unit_symbol || '',
      alertStatus(alert.alm_sts).label,
      alert.alm_note || ''
    ])

    const csvContent = [
      headers.map(csvCell).join(','),
      ...rows.map(row => row.map(csvCell).join(','))
    ].join('\n')

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `alerts_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Peringatan & Alarm</PageTitle>
            <p className="text-muted-foreground mt-1">
              Pemantauan peringatan dan alarm
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2 tabular-nums" aria-live="polite">
            {formatNumber(filteredAlerts.length)} Peringatan
          </Badge>
        </div>

        {/* Filters Card */}
        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" aria-hidden="true" />
                Filter & Pencarian
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                Hapus Semua
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2 lg:col-span-2">
                <Label id="alerts-range-label">Rentang Tanggal Alarm</Label>
                <div role="group" aria-labelledby="alerts-range-label">
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                  />
                </div>
              </div>

              {/* Site Filter */}
              <div className="space-y-2">
                <Label htmlFor="alerts-site">Site</Label>
                <Select value={selectedSite ?? 'all'} onValueChange={(value) => setSelectedSite(value === 'all' ? undefined : value)}>
                  <SelectTrigger id="alerts-site">
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
              <div className="space-y-2">
                <Label htmlFor="alerts-cluster">Cluster</Label>
                <Select value={selectedCluster ?? 'all'} onValueChange={(value) => setSelectedCluster(value === 'all' ? undefined : value)}>
                  <SelectTrigger id="alerts-cluster">
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

              {/* Device Filter */}
              <div className="space-y-2">
                <Label htmlFor="alerts-device">Perangkat</Label>
                <Select value={selectedDevice ?? 'all'} onValueChange={(value) => setSelectedDevice(value === 'all' ? undefined : value)}>
                  <SelectTrigger id="alerts-device">
                    <SelectValue placeholder="Semua Perangkat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Perangkat</SelectItem>
                    {devices?.map((device: any) => (
                      <SelectItem key={device.dev_id} value={device.dev_id}>
                        {device.dev_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="alerts-status">Status</Label>
                <Select value={selectedStatus ?? 'all'} onValueChange={(value) => setSelectedStatus(value === 'all' ? undefined : value)}>
                  <SelectTrigger id="alerts-status">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    {Object.entries(ALERT_STATUS).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Code Filter */}
              <div className="space-y-2">
                <Label htmlFor="alerts-code">Kode Alarm</Label>
                <Select value={selectedCode ?? 'all'} onValueChange={(value) => setSelectedCode(value === 'all' ? undefined : value)}>
                  <SelectTrigger id="alerts-code">
                    <SelectValue placeholder="Semua Kode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kode</SelectItem>
                    {ALERT_CODES.map((code) => (
                      <SelectItem key={code.value} value={code.value}>
                        {code.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="alerts-search">Cari</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="alerts-search"
                    type="search"
                    placeholder="Cari peringatan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Table */}
        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <div className="flex items-center justify-between">
              <CardTitle>Daftar Peringatan</CardTitle>
              <Button onClick={exportToCSV} variant="outline" size="sm" disabled={filteredAlerts.length === 0}>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                Ekspor CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4" role="status" aria-label="Memuat peringatan">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 w-full motion-safe:animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => refetch()} />
              </div>
            ) : filteredAlerts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">
                    Daftar peringatan dan alarm, diurutkan dari yang terbaru
                  </caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Tanggal Alarm</TableHead>
                      <TableHead className="font-bold">Kode Alarm</TableHead>
                      <TableHead className="font-bold">Site</TableHead>
                      <TableHead className="font-bold">Cluster</TableHead>
                      <TableHead className="font-bold">Perangkat</TableHead>
                      <TableHead className="font-bold">Sensor</TableHead>
                      <TableHead className="font-bold">Tanggal Baca</TableHead>
                      <TableHead className="font-bold text-right">Nilai</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      {canHandle && <TableHead className="font-bold text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlerts.map((alert) => (
                      <TableRow key={alert.alm_id} className="hover:bg-muted/50">
                        <TableCell className="font-medium whitespace-nowrap tabular-nums">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                            {formatDateTime(alert.alm_date, 'dd/MM/yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-destructive">{alert.alcode_note || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{alert.site_name || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{alert.cluster_name || '-'}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{alert.dev_name || '-'}</TableCell>
                        <TableCell>{alert.ds_name || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                          {alert.read_date || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {alert.read_value !== null && alert.read_value !== undefined ? (
                            <span className="font-semibold">
                              {formatNumber(Number(alert.read_value))} {alert.unit_symbol || ''}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={alertStatus(alert.alm_sts).variant}>{alertStatus(alert.alm_sts).label}</Badge>
                          {alert.alm_note && (
                            <p className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground" title={alert.alm_note}>
                              {alert.alm_note}
                            </p>
                          )}
                        </TableCell>
                        {canHandle && (
                          <TableCell className="text-right">
                            {(alert.alm_sts ?? 0) < 2 ? (
                              <Button variant="outline" size="sm" onClick={() => setHandling(alert)}>
                                Tangani
                              </Button>
                            ) : (
                              <CheckCircle2 className="ml-auto h-4 w-4 text-success" aria-label="Selesai" />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Bell className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Tidak ada peringatan</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasActiveFilters
                    ? 'Coba ubah filter Anda'
                    : 'Semua sistem berjalan normal'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <HandleAlertDialog
        open={!!handling}
        onOpenChange={(open) => !open && setHandling(null)}
        alert={handling}
      />
    </DashboardLayout>
  )
}
