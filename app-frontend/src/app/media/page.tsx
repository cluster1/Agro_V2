'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageTitle } from '@/components/ui/page-title'
import { ErrorState } from '@/components/ui/error-state'
import { Camera, Plus, Search, Calendar, MapPin, Layers } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { uploadUrl } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { UploadMediaDialog } from '@/components/media/upload-media-dialog'
import { MediaGalleryModal } from '@/components/media/media-gallery-modal'
import { MediaImage } from '@/components/media/media-image'
import { canRecordActivities } from '@/lib/permissions'

export default function MediaPage() {
  const { user } = useAuth()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)

  const activeTenantId = user?.user_level === 0 && selectedTenantId
    ? selectedTenantId
    : user?.tenant_id

  // Check if user can modify (add/edit/delete)
  // Operators upload field photos too (BRD menu matrix); only the upload button hangs on this
  const canModify = canRecordActivities(user)

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [selectedCluster, setSelectedCluster] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch sites
  const { data: sites } = useQuery({
    queryKey: ['sites', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/sites`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Fetch clusters
  const { data: allClusters } = useQuery({
    queryKey: ['all-clusters', activeTenantId],
    queryFn: async () => {
      const response = await api.get(`/clusters`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Fetch media
  const { data: media, isLoading, isError, refetch } = useQuery({
    queryKey: ['media', activeTenantId, selectedSite],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedSite && selectedSite !== 'all') params.append('siteId', selectedSite)

      const response = await api.get(`/media?${params}`)
      return response.data
    },
    enabled: !!activeTenantId,
  })

  // Filter media
  const filteredMedia = media?.filter((item: any) => {
    const matchesCluster = selectedCluster === 'all' || item.cluster_id === selectedCluster
    const matchesSearch = !searchQuery ||
      item.media_desc?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.site?.site_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.cluster?.cluster_name?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCluster && matchesSearch
  }) || []

  const filteredClusters = allClusters?.filter((cluster: any) =>
    selectedSite === 'all' || cluster.site_id === selectedSite
  ) || []

  const openGallery = (index: number) => {
    setSelectedMediaIndex(index)
    setIsGalleryOpen(true)
  }

  const videoCount = filteredMedia.filter((item: any) => item.media_type === 'video').length
  const photoCount = filteredMedia.length - videoCount
  const countLabel = videoCount > 0 ? `${photoCount} foto, ${videoCount} video` : `${photoCount} foto`
  const hasFilters = !!searchQuery || selectedSite !== 'all' || selectedCluster !== 'all'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Galeri Media</PageTitle>
            <p className="text-muted-foreground mt-1">
              Kelola dan lihat foto dokumentasi site
            </p>
          </div>
          {canModify && (
            <Button onClick={() => setIsUploadOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Unggah Media
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Label htmlFor="media-search" className="sr-only">Cari media</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="media-search"
                  type="search"
                  placeholder="Cari media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Site Filter */}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <Label htmlFor="media-site" className="sr-only">Site</Label>
                <Select value={selectedSite} onValueChange={(v) => { setSelectedSite(v); setSelectedCluster('all') }}>
                  <SelectTrigger id="media-site">
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
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <Label htmlFor="media-cluster" className="sr-only">Cluster</Label>
                <Select
                  value={selectedCluster}
                  onValueChange={setSelectedCluster}
                  disabled={!selectedSite || selectedSite === 'all'}
                >
                  <SelectTrigger id="media-cluster">
                    <SelectValue placeholder="Semua Cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cluster</SelectItem>
                    {filteredClusters?.map((cluster: any) => (
                      <SelectItem key={cluster.cluster_id} value={cluster.cluster_id}>
                        {cluster.cluster_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Results count */}
              <div className="flex items-center justify-end">
                <Badge variant="secondary" aria-live="polite" className="tabular-nums">
                  {countLabel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gallery Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Memuat media">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : filteredMedia.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMedia.map((item: any, index: number) => {
              // media_path dari backend sudah dalam format: uploads/filename.jpg
              const imageUrl = uploadUrl(item.media_path)
              const dateLabel = formatDateTime(item.media_date, 'dd MMM yyyy')
              const alt = item.media_desc || `Foto ${formatDateTime(item.media_date)}`

              return (
                <li key={item.media_id}>
                  <button
                    type="button"
                    onClick={() => openGallery(index)}
                    className="group block w-full overflow-hidden rounded-lg border bg-card text-left text-card-foreground shadow-sm transition-shadow ring-offset-background hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Buka foto: ${alt}`}
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      <MediaImage
                        src={imageUrl}
                        alt={alt}
                        width={400}
                        height={400}
                        className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-110"
                      />
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="truncate text-sm font-medium">
                        {item.media_desc || 'Tanpa deskripsi'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        <span>{dateLabel}</span>
                      </div>
                      {item.site && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          <span className="truncate">{item.site.site_name}</span>
                        </div>
                      )}
                      {item.cluster && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Layers className="h-3 w-3" aria-hidden="true" />
                          <span className="truncate">{item.cluster.cluster_name}</span>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Camera className="mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
              <h2 className="mb-2 text-lg font-semibold">
                {hasFilters ? 'Media tidak ditemukan' : 'Belum ada media'}
              </h2>
              <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
                {hasFilters
                  ? 'Coba ubah filter atau kata kunci pencarian'
                  : 'Unggah foto pertama Anda untuk memulai'}
              </p>
              {!hasFilters && canModify && (
                <Button onClick={() => setIsUploadOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Unggah Media
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Dialog */}
      <UploadMediaDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        tenantId={activeTenantId || ''}
        sites={sites || []}
        clusters={allClusters || []}
      />

      {/* Gallery Modal */}
      <MediaGalleryModal
        media={filteredMedia}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        initialIndex={selectedMediaIndex}
      />
    </DashboardLayout>
  )
}
