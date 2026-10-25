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
import { LoadingState } from '@/components/ui/loading-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  MapPin,
  Pencil,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { SiteFormDialog } from '@/components/sites/site-form-dialog'
import { ClusterFormDialog } from '@/components/clusters/cluster-form-dialog'
import { canModifyEnvironment } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'

const hasValue = (v: unknown) => v !== null && v !== undefined

export default function SiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const site_id = params.site_id as string
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  const [siteFormOpen, setSiteFormOpen] = useState(false)
  const [clusterFormOpen, setClusterFormOpen] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<any>(null)
  const [clusterFormMode, setClusterFormMode] = useState<'create' | 'edit'>('create')
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const idPrefix = useId()

  // Use selectedTenantId for global admin, otherwise use user's tenant_id
  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  const canModify = canModifyEnvironment(user)

  // Fetch site details
  const {
    data: site,
    isLoading,
    isError,
    error: siteErrorObj,
    refetch: refetchSite,
  } = useQuery({
    queryKey: queryKeys.site(site_id),
    queryFn: async () => {
      const response = await api.get(`/tenants/${activeTenantId}/sites/${site_id}`)
      return response.data
    },
    enabled: !!activeTenantId && !!site_id,
  })

  // Fetch clusters for this site. Key is ['clusters', site_id]; cluster mutations invalidate the
  // whole ['clusters'] prefix so this list refreshes too.
  const {
    data: clusters,
    isLoading: clustersLoading,
    isError: clustersError,
    refetch: refetchClusters,
  } = useQuery({
    queryKey: queryKeys.clusters(site_id),
    queryFn: async () => {
      const response = await api.get(`/sites/${site_id}/clusters`)
      return response.data
    },
    enabled: !!site_id,
  })

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId)
      } else {
        newSet.add(clusterId)
      }
      return newSet
    })
  }

  const openCreateCluster = () => {
    setSelectedCluster(null)
    setClusterFormMode('create')
    setClusterFormOpen(true)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState label="Memuat detail site..." className="h-96" />
      </DashboardLayout>
    )
  }

  if (isError && (siteErrorObj as any)?.response?.status !== 404) {
    return (
      <DashboardLayout>
        <ErrorState onRetry={() => refetchSite()} />
      </DashboardLayout>
    )
  }

  if (!site) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
            <p className="text-muted-foreground">Site tidak ditemukan</p>
            <Button onClick={() => router.push('/sites')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Kembali ke Daftar Site
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/sites')} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div>
              <PageTitle className="text-3xl md:text-3xl">Detail Site</PageTitle>
              <p className="text-muted-foreground mt-1">{site.site_name}</p>
            </div>
          </div>
          {canModify && (
            <Button onClick={() => setSiteFormOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Perbarui Site
            </Button>
          )}
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          {/* Left Panel - Site Details */}
          <Card className="border-2 h-fit lg:sticky lg:top-6">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary">
                  <MapPin className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{site.site_name}</CardTitle>
                  <StatusBadge status={site.site_sts === 1 ? 'active' : 'inactive'} className="mt-1" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Site ID */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">ID Site</p>
                <div className="font-mono text-sm bg-muted/50 px-3 py-2 rounded">{site.site_id}</div>
              </div>

              {/* Site Type */}
              {site.site_type && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tipe Site</p>
                  <div className="text-sm px-3 py-2 bg-info/15 text-foreground rounded">{site.site_type}</div>
                </div>
              )}

              {/* Address */}
              {site.site_address && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Alamat</p>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{site.site_address}</span>
                  </div>
                </div>
              )}

              {/* Coordinates */}
              {(hasValue(site.site_lat) || hasValue(site.site_lon)) && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Koordinat</p>
                  <div className="space-y-1">
                    {hasValue(site.site_lat) && (
                      <div className="font-mono text-xs bg-muted/50 px-3 py-1.5 rounded">
                        Lat: {formatNumber(Number(site.site_lat), { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                      </div>
                    )}
                    {hasValue(site.site_lon) && (
                      <div className="font-mono text-xs bg-muted/50 px-3 py-1.5 rounded">
                        Lon: {formatNumber(Number(site.site_lon), { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Altitude */}
              {hasValue(site.site_alt) && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ketinggian</p>
                  <div className="font-mono text-sm bg-accent text-accent-foreground px-3 py-2 rounded">
                    {formatNumber(Number(site.site_alt), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                  </div>
                </div>
              )}

              {/* Created Date */}
              {site.site_created && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dibuat</p>
                  <div className="text-sm px-3 py-2 bg-muted/50 rounded">{formatDateTime(site.site_created)}</div>
                </div>
              )}

              {/* Updated Date */}
              {site.site_update && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Terakhir Diperbarui</p>
                  <div className="text-sm px-3 py-2 bg-muted/50 rounded">{formatDateTime(site.site_update)}</div>
                </div>
              )}

              {/* Clusters Count */}
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Total Cluster</p>
                <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                  <Layers className="h-6 w-6" aria-hidden="true" />
                  {clustersLoading ? <Skeleton className="h-7 w-10" /> : clusters?.length ?? 0}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel - Clusters List */}
          <Card className="border-2">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle>Cluster</CardTitle>
                  {clusters && clusters.length > 0 && (
                    <Badge variant="secondary">{clusters.length}</Badge>
                  )}
                </div>
                {canModify && (
                  <Button size="sm" onClick={openCreateCluster}>
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Tambah Cluster
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {clustersLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : clustersError ? (
                <ErrorState title="Gagal memuat cluster" onRetry={() => refetchClusters()} />
              ) : clusters && clusters.length > 0 ? (
                <div className="space-y-3">
                  {clusters.map((cluster: any) => {
                    const isExpanded = expandedClusters.has(cluster.cluster_id)
                    const panelId = `${idPrefix}-${cluster.cluster_id}`
                    return (
                      <Card key={cluster.cluster_id} className="border-2">
                        <CardContent className="p-4">
                          {/* Cluster Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-accent">
                                <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold">{cluster.cluster_name}</h3>
                                <p className="text-xs text-muted-foreground">{cluster.cluster_id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {canModify && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Edit cluster ${cluster.cluster_name}`}
                                  onClick={() => {
                                    setSelectedCluster(cluster)
                                    setClusterFormMode('edit')
                                    setClusterFormOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-expanded={isExpanded}
                                aria-controls={panelId}
                                aria-label={`${isExpanded ? 'Tutup' : 'Buka'} detail cluster ${cluster.cluster_name}`}
                                onClick={() => toggleCluster(cluster.cluster_id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Cluster Details - Collapsible */}
                          <div id={panelId} hidden={!isExpanded}>
                            <div className="mt-4 pt-4 border-t space-y-3 text-sm">
                              {/* Cluster Type */}
                              {cluster.cluster_type && (
                                <div>
                                  <span className="text-muted-foreground">Tipe: </span>
                                  <span className="font-medium">{cluster.cluster_type}</span>
                                </div>
                              )}

                              {/* Capacity & Current */}
                              {(hasValue(cluster.cluster_capacity) || hasValue(cluster.cluster_current)) && (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {hasValue(cluster.cluster_capacity) && (
                                    <div className="bg-info/15 px-3 py-2 rounded">
                                      <p className="text-xs text-muted-foreground">Kapasitas</p>
                                      <p className="font-semibold">{formatNumber(Number(cluster.cluster_capacity))}</p>
                                    </div>
                                  )}
                                  {hasValue(cluster.cluster_current) && (
                                    <div className="bg-accent px-3 py-2 rounded">
                                      <p className="text-xs text-muted-foreground">Populasi Saat Ini</p>
                                      <p className="font-semibold">{formatNumber(Number(cluster.cluster_current))}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Description */}
                              {cluster.cluster_desc && (
                                <div>
                                  <span className="text-muted-foreground">Deskripsi: </span>
                                  <p className="mt-1 text-sm">{cluster.cluster_desc}</p>
                                </div>
                              )}

                              {/* Coordinates */}
                              {(hasValue(cluster.cluster_lat) || hasValue(cluster.cluster_lon)) && (
                                <div>
                                  <p className="text-muted-foreground mb-1">Koordinat:</p>
                                  <div className="space-y-1">
                                    {hasValue(cluster.cluster_lat) && (
                                      <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                                        Lat: {formatNumber(Number(cluster.cluster_lat), { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                                      </div>
                                    )}
                                    {hasValue(cluster.cluster_lon) && (
                                      <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                                        Lon: {formatNumber(Number(cluster.cluster_lon), { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Created Date */}
                              {cluster.cluster_created && (
                                <div>
                                  <span className="text-muted-foreground">Dibuat: </span>
                                  <span className="text-xs">{formatDateTime(cluster.cluster_created)}</span>
                                </div>
                              )}

                              {/* Updated Date */}
                              {cluster.cluster_update && (
                                <div>
                                  <span className="text-muted-foreground">Terakhir Diperbarui: </span>
                                  <span className="text-xs">{formatDateTime(cluster.cluster_update)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" aria-hidden="true" />
                  <p className="text-muted-foreground">Belum ada cluster</p>
                  {canModify && (
                    <Button size="sm" onClick={openCreateCluster} className="mt-4">
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tambah Cluster Pertama
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Site Form Dialog */}
      {site && (
        <SiteFormDialog
          open={siteFormOpen}
          onOpenChange={setSiteFormOpen}
          tenantId={activeTenantId || ''}
          site={site}
          mode="edit"
        />
      )}

      {/* Cluster Form Dialog */}
      <ClusterFormDialog
        open={clusterFormOpen}
        onOpenChange={setClusterFormOpen}
        tenantId={activeTenantId || ''}
        cluster={selectedCluster}
        mode={clusterFormMode}
        defaultSiteId={site_id}
      />
    </DashboardLayout>
  )
}
