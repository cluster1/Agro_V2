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
import { Box, Plus, MoreVertical, Pencil, Trash2, Users, ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { ClusterFormDialog } from '@/components/clusters/cluster-form-dialog'
import { DeleteClusterDialog } from '@/components/clusters/delete-cluster-dialog'
import { canModifyEnvironment } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/format'

function ClustersPageContent() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<any>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const searchParams = useSearchParams()
  const router = useRouter()
  const siteIdFilter = searchParams.get('site_id')

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  const canModify = canModifyEnvironment(user)

  // Clusters are embedded in the sites payload, so this page reads the sites list.
  const { data: sites, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.sites(activeTenantId),
    queryFn: async () => {
      const response = await api.get(`/sites`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Filter sites by site_id if provided
  const filteredSites = siteIdFilter
    ? sites?.filter((site: any) => site.site_id === siteIdFilter)
    : sites

  // Get site name for breadcrumb
  const selectedSite = siteIdFilter && sites
    ? sites.find((site: any) => site.site_id === siteIdFilter)
    : null

  const openCreate = () => {
    setFormMode('create')
    setSelectedCluster(null)
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        {selectedSite && (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/sites" className="text-muted-foreground hover:text-primary transition-colors">
              Site
            </Link>
            <span className="text-muted-foreground" aria-hidden="true">/</span>
            <span className="text-primary font-medium" aria-current="page">{selectedSite.site_name}</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {selectedSite.clusters?.length ?? 0} Cluster
            </Badge>
          </nav>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {selectedSite && (
                <Button variant="ghost" size="icon" onClick={() => router.push('/sites')} aria-label="Kembali">
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
              )}
              <div>
                <PageTitle>{selectedSite ? `Cluster - ${selectedSite.site_name}` : 'Cluster'}</PageTitle>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <Box className="h-4 w-4" aria-hidden="true" />
                  {selectedSite ? `Cluster di ${selectedSite.site_name}` : 'Kelola cluster di setiap site'}
                </p>
              </div>
            </div>
          </div>
          {canModify && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Cluster
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
        ) : filteredSites && filteredSites.length > 0 ? (
          <div className="space-y-6">
            {filteredSites.map((site: any) => (
              <div key={site.site_id}>
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                  {site.site_name}
                  <Badge variant="secondary" className="text-xs">
                    {site.clusters?.length ?? 0} Cluster
                  </Badge>
                </h2>
                {site.clusters && site.clusters.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {site.clusters.map((cluster: any, index: number) => {
                      const capacity = Number(cluster.cluster_capacity)
                      const current = Number(cluster.cluster_current ?? 0)
                      return (
                        <Card
                          key={cluster.cluster_id}
                          className="group relative overflow-hidden border-2 motion-safe:animate-slide-up"
                          style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary">
                                  <Box className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg">{cluster.cluster_name}</CardTitle>
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {cluster.cluster_type}
                                  </Badge>
                                </div>
                              </div>
                              {canModify && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Aksi untuk ${cluster.cluster_name}`}
                                    >
                                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedCluster(cluster)
                                        setFormMode('edit')
                                        setFormOpen(true)
                                      }}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedCluster(cluster)
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
                              {cluster.cluster_desc && (
                                <p className="text-sm text-muted-foreground truncate">{cluster.cluster_desc}</p>
                              )}
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                                <span className="font-medium">
                                  {formatNumber(current)} / {formatNumber(Number.isNaN(capacity) ? 0 : capacity)}
                                </span>
                                <span className="text-muted-foreground text-xs">populasi</span>
                              </div>
                              {capacity > 0 && (
                                <div
                                  className="w-full bg-muted rounded-full h-2"
                                  role="progressbar"
                                  aria-label={`Populasi ${cluster.cluster_name}`}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={Math.round(Math.min((current / capacity) * 100, 100))}
                                >
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min((current / capacity) * 100, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            {/* The former "Detail" button had no handler and there is no cluster detail
                                route, so it was removed rather than left as a dead control. */}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Card className="border-2 border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground mb-4">Belum ada cluster di site ini</p>
                      {canModify && (
                        <Button variant="outline" size="sm" onClick={openCreate}>
                          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                          Tambah Cluster
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
                <Box className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Belum ada cluster</h2>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Tambahkan site terlebih dahulu untuk membuat cluster
              </p>
              <Button asChild>
                <Link href="/sites">
                  <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ke halaman Site
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <ClusterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={activeTenantId || ''}
        cluster={selectedCluster}
        mode={formMode}
      />
      <DeleteClusterDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        cluster={selectedCluster}
        tenantId={activeTenantId || ''}
      />
    </DashboardLayout>
  )
}

export default function ClustersPage() {
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
      <ClustersPageContent />
    </Suspense>
  )
}
