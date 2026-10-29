'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PAGE_SIZE, TablePagination, clampPage } from '@/components/ui/table-pagination'
import { Database, Plus, Search } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { queryKeys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'
import { MASTER_DATA, canEditResource, cellText, findResource, type ColumnDef, type ResourceDef } from '@/lib/master-data'
import { MasterDataFormDialog } from '@/components/master-data/master-data-form-dialog'
import { DeleteMasterDataDialog } from '@/components/master-data/delete-master-data-dialog'

type Row = Record<string, unknown>

const GROUPS = [...new Set(MASTER_DATA.map((r) => r.group))]
const isStatusColumn = (col: ColumnDef) => col.key.endsWith('_sts') || col.key === 'actype_need_photo'

/** Satu sel; nama dicari dari id referensi (mis. fase, varietas) bila kolom punya lookup. */
function Cell({ def, col, row, names }: { def: ResourceDef; col: ColumnDef; row: Row; names: Map<string, Map<string, string>> }) {
  const raw = row[col.key]
  if (col.lookup && raw) return <>{names.get(col.lookup.resource)?.get(String(raw)) ?? String(raw)}</>
  if (isStatusColumn(col)) {
    const on = Number(raw) === 1
    if (raw === null || raw === undefined) return <span className="text-muted-foreground">-</span>
    return <Badge variant={on ? 'success' : 'secondary'}>{cellText(def, col, raw)}</Badge>
  }
  if (col.key === 'phase_color' && typeof raw === 'string' && raw) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: raw }} aria-hidden="true" />
        {raw}
      </span>
    )
  }
  if (typeof raw === 'number' && col.align === 'right') return <>{formatNumber(raw)}</>
  return <>{cellText(def, col, raw)}</>
}

export default function MasterDataPage() {
  const { user } = useAuth()
  const [resource, setResource] = useState(MASTER_DATA[0].resource)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selected, setSelected] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)

  const def = findResource(resource)!
  const canEdit = canEditResource(user, def)
  const canSee = !!user && ['admin', 'tenant_admin', 'agronom'].includes(user.user_role)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.ref(def.resource, ...Object.values(def.listParams ?? {})),
    queryFn: async () => (await api.get(`/ref/${def.resource}`, { params: def.listParams })).data as Row[],
    enabled: canSee,
  })

  // Name lookups for id columns (phases, varieties, telemetry, units, plant types)
  const lookups = useMemo(() => [...new Set(def.columns.map((c) => c.lookup?.resource).filter(Boolean))] as string[], [def])
  // useQueries (not hooks in a loop): the number of lookups changes with the selected resource
  const lookupResults = useQueries({
    queries: lookups.map((res) => ({
      queryKey: queryKeys.ref(res),
      queryFn: async () => (await api.get(`/ref/${res}`)).data as Row[],
      staleTime: 5 * 60 * 1000,
      enabled: canSee,
    })),
  })
  const lookupStamp = lookupResults.map((q) => q.dataUpdatedAt).join()
  const names = useMemo(() => {
    const out = new Map<string, Map<string, string>>()
    lookups.forEach((res, i) => {
      const src = MASTER_DATA.flatMap((d) => d.columns.map((c) => c.lookup)).find((l) => l?.resource === res)!
      out.set(res, new Map((lookupResults[i]?.data ?? []).map((r) => [String(r[src.value]), String(r[src.label] ?? r[src.value])])))
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups, lookupStamp])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data ?? []
    return (data ?? []).filter((r) =>
      def.columns.some((c) => {
        const raw = r[c.key]
        const shown = c.lookup && raw ? names.get(c.lookup.resource)?.get(String(raw)) ?? String(raw) : String(raw ?? '')
        return shown.toLowerCase().includes(term)
      }),
    )
  }, [data, search, def, names])

  // dikunci ke rentang valid: data bisa menyusut setelah hapus atau refetch
  const currentPage = clampPage(page, rows.length)
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [rows, currentPage])

  const openCreate = () => {
    setSelected(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const openEdit = (row: Row) => {
    setSelected(row)
    setFormMode('edit')
    setFormOpen(true)
  }

  if (user && !canSee) {
    return (
      <DashboardLayout>
        <ErrorState title="Akses ditolak" message="Master data hanya dapat dilihat oleh admin, admin tenant, dan agronom." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Master Data</PageTitle>
            <p className="mt-1 text-muted-foreground">Referensi komoditas, ambang, kegiatan, material, dan telemetri</p>
          </div>
          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah {def.label}
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="md-resource">Data</Label>
              <Select
                value={resource}
                onValueChange={(v) => {
                  setResource(v)
                  setSearch('')
                  setPage(1)
                }}
              >
                <SelectTrigger id="md-resource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.map((group) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {MASTER_DATA.filter((r) => r.group === group).map((r) => (
                        <SelectItem key={r.resource} value={r.resource}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="md-search">Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="md-search"
                  type="search"
                  placeholder="Cari..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {def.label} ({formatNumber(rows.length)})
              </CardTitle>
              {!canEdit && <Badge variant="outline">Hanya lihat</Badge>}
            </div>
            {def.note && <p className="text-sm text-muted-foreground">{def.note}</p>}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-8" role="status" aria-label="Memuat data">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 w-full rounded bg-muted motion-safe:animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6">
                <ErrorState onRetry={() => refetch()} />
              </div>
            ) : rows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <caption className="sr-only">Data referensi {def.label}</caption>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {def.columns.map((c) => (
                          <TableHead key={c.key} className={`font-bold ${c.align === 'right' ? 'text-right' : ''}`}>
                            {c.label}
                          </TableHead>
                        ))}
                        {canEdit && <TableHead className="text-right font-bold">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((r) => (
                        <TableRow key={String(r[def.idKey])} className="hover:bg-muted/50">
                          {def.columns.map((c) => (
                            <TableCell key={c.key} className={`${c.align === 'right' ? 'text-right tabular-nums' : ''} whitespace-nowrap`}>
                              <Cell def={def} col={c} row={r} names={names} />
                            </TableCell>
                          ))}
                          {canEdit && (
                            <TableCell className="whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDeleting(r)}>
                                  Hapus
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={currentPage} total={rows.length} onPageChange={setPage} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Database className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Tidak ada data</h2>
                <p className="mt-1 text-sm text-muted-foreground">{search ? 'Coba ubah kata kunci' : `Belum ada ${def.label.toLowerCase()}.`}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MasterDataFormDialog open={formOpen} onOpenChange={setFormOpen} def={def} row={selected} mode={formMode} />
      <DeleteMasterDataDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} def={def} row={deleting} />
    </DashboardLayout>
  )
}
