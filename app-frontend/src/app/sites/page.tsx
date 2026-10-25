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
import { MapPin, Plus, Navigation, Layers, MoreVertical, Trash2, Pencil } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import Link from 'next/link'
import { SiteFormDialog } from '@/components/sites/site-form-dialog'
import { DeleteSiteDialog } from '@/components/sites/delete-site-dialog'
import { canModifyEnvironment } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'

const hasValue = (v: unknown) => v !== null && v !== undefined

export default function SitesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<any>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  const canModify = canModifyEnvironment(user)

  const { data: sites, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.sites(activeTenantId),
    queryFn: async () => {
      const response = await api.get(`/tenants/${activeTenantId}/sites`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  const openCreate = () => {
    setFormMode('create')
    setSelectedSite(null)
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <PageTitle>Site</PageTitle>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Kelola site Anda
            </p>
          </div>
          {canModify && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Site
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
        ) : sites && sites.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {sites.map((site: any, index: number) => (
              <Card
                key={site.site_id}
                className="group relative overflow-hidden border-2 motion-safe:animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary">
                        <MapPin className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{site.site_name}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {site.site_type}
                          </Badge>
                          <StatusBadge status={site.site_sts == 1 ? 'active' : 'inactive'} />
                        </div>
                      </div>
                    </div>
                    {canModify && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Aksi untuk ${site.site_name}`}>
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSite(site)
                              setFormMode('edit')
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSite(site)
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Navigation className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span className="truncate">{site.site_address || 'Alamat belum diisi'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{site.clusters?.length ?? 0} Cluster</span>
                    </div>

                    {/* Coordinates & Altitude */}
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      {hasValue(site.site_lat) && hasValue(site.site_lon) && (
                        <div>
                          <p className="text-muted-foreground mb-1">Koordinat</p>
                          <div className="font-mono bg-muted/50 px-2 py-1 rounded">
                            {formatNumber(Number(site.site_lat), { minimumFractionDigits: 4, maximumFractionDigits: 4 })},{' '}
                            {formatNumber(Number(site.site_lon), { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </div>
                        </div>
                      )}
                      {hasValue(site.site_alt) && (
                        <div>
                          <p className="text-muted-foreground mb-1">Ketinggian</p>
                          <div className="font-mono bg-accent text-accent-foreground px-2 py-1 rounded">
                            {formatNumber(Number(site.site_alt), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/sites/${site.site_id}`}>
                        <Layers className="mr-2 h-3 w-3" aria-hidden="true" />
                        Lihat Cluster
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
                <MapPin className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Belum ada site</h2>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Mulai dengan menambahkan site pertama Anda untuk memulai monitoring
              </p>
              {canModify && (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tambah Site
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <SiteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={activeTenantId || ''}
        site={selectedSite}
        mode={formMode}
      />
      <DeleteSiteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        site={selectedSite}
        tenantId={activeTenantId || ''}
      />
    </DashboardLayout>
  )
}
