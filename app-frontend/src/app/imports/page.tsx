'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { useAuth } from '@/hooks/use-auth'
import { canImportData } from '@/lib/permissions'
import { formatNumber } from '@/lib/format'
import { csvCell, downloadBlob } from '@/lib/csv'
import {
  ACCEPT,
  IMPORT_TYPES,
  MAX_FILE_BYTES,
  failedRowsCsv,
  type ImportReport,
  type ImportType,
} from '@/lib/imports'

const SHOWN_ROWS = 200

export default function ImportsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const allowed = canImportData(user)

  const [type, setType] = useState<ImportType>('harvests')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)

  const reset = () => {
    setFile(null)
    setReport(null)
    setFileError(null)
    setOnlyErrors(false)
    if (input.current) input.current.value = ''
  }

  const pick = (selected: File | undefined) => {
    setReport(null)
    if (!selected) return setFile(null)
    const name = selected.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      setFile(null)
      return setFileError('Berkas harus berformat CSV atau XLSX.')
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null)
      return setFileError('Ukuran berkas maksimal 2 MB.')
    }
    setFileError(null)
    setFile(selected)
  }

  const send = async (path: 'preview' | 'commit') => {
    const fd = new FormData()
    fd.append('file', file as File)
    return (await api.post(`/imports/${type}/${path}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data as ImportReport
  }

  const previewMutation = useMutation({
    mutationFn: () => send('preview'),
    onSuccess: (data) => {
      setReport(data)
      setOnlyErrors(false)
    },
    onError: (error: any) => {
      setReport(null)
      toast.error(apiErrorMessage(error, 'Gagal membaca berkas'))
    },
  })

  const commitMutation = useMutation({
    mutationFn: () => send('commit'),
    onSuccess: (data) => {
      setReport(data)
      setOnlyErrors(data.invalid > 0)
      queryClient.invalidateQueries({ queryKey: [type === 'harvests' ? 'harvests' : 'observations'] })
      if (data.saved > 0) toast.success(`${formatNumber(data.saved)} baris disimpan`)
      if (data.invalid > 0) toast.warning(`${formatNumber(data.invalid)} baris tidak disimpan`)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, 'Gagal menyimpan impor'))
    },
  })

  const downloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      const res = await api.get(`/imports/${type}/template`, { params: { format }, responseType: 'blob' })
      downloadBlob(res.data, `template-${type}.${format}`, res.data.type)
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal mengunduh templat'))
    }
  }

  const downloadFailed = () => {
    if (!report) return
    const csv = failedRowsCsv(report, csvCell)
    if (csv) downloadBlob(csv, `baris-gagal-${type}.csv`, 'text/csv;charset=utf-8;')
  }

  const busy = previewMutation.isPending || commitMutation.isPending
  const rows = report ? (onlyErrors ? report.rows.filter((r) => !r.ok) : report.rows) : []
  const shown = rows.slice(0, SHOWN_ROWS)
  const canCommit = !!report && !report.committed && report.valid > 0

  if (user && !allowed) {
    return (
      <DashboardLayout>
        <ErrorState title="Akses ditolak" message="Impor data hanya dapat dilakukan oleh admin, admin tenant, dan agronom." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <PageTitle>Impor Data</PageTitle>
          <p className="mt-1 text-muted-foreground">Unggah CSV atau XLSX, periksa hasilnya per baris, lalu simpan</p>
        </div>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>1. Pilih jenis dan unduh templat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="import-type">Jenis data</Label>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setType(v as ImportType)
                    reset()
                  }}
                  disabled={busy}
                >
                  <SelectTrigger id="import-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{IMPORT_TYPES.find((t) => t.value === type)?.description}</p>
              </div>
              <div className="space-y-2">
                <Label>Templat</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => downloadTemplate('xlsx')}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    XLSX
                  </Button>
                  <Button type="button" variant="outline" onClick={() => downloadTemplate('csv')}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    CSV
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kolom <code>plant</code> boleh berisi ID atau nama tanaman. Lembar &quot;Petunjuk&quot; menjelaskan tiap kolom.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <CardTitle>2. Unggah dan periksa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy}>
                <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                Pilih berkas
              </Button>
              <input
                ref={input}
                id="import-file"
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-label="Berkas impor CSV atau XLSX"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              {file ? (
                <span className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm">
                  <span className="max-w-[16rem] truncate">{file.name}</span>
                  <button type="button" className="rounded p-1 hover:bg-muted" aria-label="Hapus berkas" onClick={reset} disabled={busy}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">CSV atau XLSX, maksimal 2 MB dan 2.000 baris</span>
              )}
              <Button type="button" onClick={() => previewMutation.mutate()} disabled={!file || busy}>
                {previewMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Periksa berkas
              </Button>
            </div>
            {fileError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {fileError}
              </p>
            )}
          </CardContent>
        </Card>

        {report && (
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>3. {report.committed ? 'Hasil penyimpanan' : 'Hasil pemeriksaan'}</CardTitle>
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                  <Badge variant="outline" className="tabular-nums">
                    {formatNumber(report.total)} baris
                  </Badge>
                  <Badge variant="success" className="gap-1 tabular-nums">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatNumber(report.committed ? report.saved : report.valid)} {report.committed ? 'disimpan' : 'valid'}
                  </Badge>
                  {report.invalid > 0 && (
                    <Badge variant="destructive" className="gap-1 tabular-nums">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatNumber(report.invalid)} {report.committed ? 'tidak disimpan' : 'bermasalah'}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {report.ignored_columns.length > 0 && (
                <p className="rounded border border-warning/50 bg-warning/10 p-3 text-sm">
                  Kolom berikut tidak dikenali dan diabaikan: <strong>{report.ignored_columns.join(', ')}</strong>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {!report.committed && (
                  <Button onClick={() => commitMutation.mutate()} disabled={!canCommit || busy}>
                    {commitMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    )}
                    Simpan {formatNumber(report.valid)} baris valid
                  </Button>
                )}
                {report.invalid > 0 && (
                  <>
                    <Button variant="outline" onClick={downloadFailed}>
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      Unduh baris bermasalah
                    </Button>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-primary"
                        checked={onlyErrors}
                        onChange={(e) => setOnlyErrors(e.target.checked)}
                      />
                      Hanya baris bermasalah
                    </label>
                  </>
                )}
                {report.committed && (
                  <Button variant="outline" onClick={reset}>
                    Impor berkas lain
                  </Button>
                )}
              </div>

              {!report.committed && report.invalid > 0 && report.valid > 0 && (
                <p className="text-sm text-muted-foreground">
                  Baris bermasalah tidak akan disimpan. Perbaiki lewat berkas hasil unduhan lalu unggah ulang.
                </p>
              )}
              {!report.committed && report.valid === 0 && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  Tidak ada baris yang valid, jadi tidak ada yang bisa disimpan.
                </p>
              )}

              <div className="overflow-x-auto rounded border">
                <Table>
                  <caption className="sr-only">Hasil pemeriksaan per baris berkas</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16 text-right font-bold">Baris</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                      <TableHead className="font-bold">Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell className="text-right tabular-nums">{r.line}</TableCell>
                        <TableCell>
                          <Badge variant={r.ok ? 'success' : 'destructive'} className="gap-1 whitespace-nowrap">
                            {r.ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {r.ok ? (report.committed ? 'Disimpan' : 'Valid') : 'Bermasalah'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.ok ? (
                            <span className="text-muted-foreground">
                              {Object.entries(r.data ?? {})
                                .filter(([k]) => k !== 'plant_id')
                                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : v}`)
                                .join(' · ')}
                            </span>
                          ) : (
                            <ul className="list-disc space-y-0.5 pl-4 text-destructive">
                              {r.errors.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > SHOWN_ROWS && (
                <p className="text-sm text-muted-foreground">
                  Menampilkan {SHOWN_ROWS} dari {formatNumber(rows.length)} baris. Gunakan &quot;Hanya baris bermasalah&quot; atau
                  unduh baris bermasalah untuk melihat sisanya.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
