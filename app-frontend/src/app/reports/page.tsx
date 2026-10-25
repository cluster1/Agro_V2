'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { format } from 'date-fns'
import api from '@/lib/api'

/** Blob error responses carry their JSON body as a Blob: read it to get the server message. */
async function readBlobError(error: any): Promise<string> {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text())
      const message = parsed?.message
      if (Array.isArray(message)) return message.join(', ')
      if (typeof message === 'string' && message) return message
    } catch {
      // not JSON: fall through
    }
  } else if (typeof data?.message === 'string') {
    return data.message
  }
  return 'Gagal mengunduh laporan'
}

export default function ReportsPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  // Same guard as the other pages: only the global admin may override the tenant.
  const tenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const today = format(new Date(), 'yyyy-MM-dd')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const rangeError =
    startDate && endDate && startDate > endDate ? 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.' : null

  const handleDownloadSensorReadings = async () => {
    if (!startDate || !endDate) {
      toast.error('Pilih tanggal mulai dan tanggal akhir')
      return
    }

    if (rangeError) {
      toast.error(rangeError)
      return
    }

    setIsDownloading(true)
    try {
      const response = await api.get(
        `/reports/tenants/${tenantId}/sensor-readings/excel`,
        {
          params: { startDate, endDate },
          responseType: 'blob',
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `sensor-readings-${startDate}-to-${endDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Laporan Excel berhasil diunduh')
    } catch (error: any) {
      toast.error(await readBlobError(error))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <PageTitle>Laporan</PageTitle>
          <p className="text-muted-foreground">
            Buat dan unduh laporan
          </p>
        </div>

        {/* Sensor Readings Excel Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-success" aria-hidden="true" />
              <CardTitle>Laporan Pembacaan Sensor (Excel)</CardTitle>
            </div>
            <CardDescription>
              Unduh data pembacaan sensor dalam format Excel dengan filter rentang tanggal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  max={endDate && endDate < today ? endDate : today}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-invalid={!!rangeError}
                  aria-describedby={rangeError ? 'range-error' : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Tanggal Akhir</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={today}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-invalid={!!rangeError}
                  aria-describedby={rangeError ? 'range-error' : undefined}
                />
              </div>
            </div>
            <div aria-live="polite" className="min-h-[1.25rem]">
              {rangeError && (
                <p id="range-error" className="text-sm text-destructive">
                  {rangeError}
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleDownloadSensorReadings}
              disabled={isDownloading || !startDate || !endDate || !!rangeError}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Membuat Excel...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Unduh Laporan Excel
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Laporan memuat: ID Pembacaan, Tanggal & Waktu, Site, Cluster, Perangkat, Sensor, Nilai, dan Satuan
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
