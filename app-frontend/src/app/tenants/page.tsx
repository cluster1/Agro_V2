'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
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
import { LoadingState } from '@/components/ui/loading-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Plus, MoreVertical, Pencil, Trash2, MapPin, Users } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { TenantFormDialog } from '@/components/tenants/tenant-form-dialog'
import { DeleteTenantDialog } from '@/components/tenants/delete-tenant-dialog'
import { uploadUrl } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'

export default function TenantsPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const { user } = useAuth()
  const router = useRouter()

  // Only global admin (user_level === 0) may access this page
  const isForbidden = !!user && user.user_level !== 0

  useEffect(() => {
    if (isForbidden) router.push('/dashboard')
  }, [isForbidden, router])

  const { data: tenants, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const response = await api.get('/tenants')
      return response.data
    },
    enabled: !!user && user.user_level === 0,
  })

  if (isForbidden) {
    return (
      <DashboardLayout>
        <LoadingState label="Mengalihkan..." />
      </DashboardLayout>
    )
  }

  const openCreate = () => {
    setFormMode('create')
    setSelectedTenant(null)
    setFormOpen(true)
  }

  const openEdit = (tenant: any) => {
    setSelectedTenant(tenant)
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <PageTitle>Tenant</PageTitle>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Kelola tenant dan organisasi (khusus Admin Global)
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Tambah Tenant
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
        ) : tenants && tenants.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {tenants.map((tenant: any, index: number) => (
              <Card
                key={tenant.tenant_id}
                className="group relative overflow-hidden border-2 motion-safe:animate-slide-up"
                style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {tenant.tenant_logo ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-border">
                          <img
                            src={uploadUrl(tenant.tenant_logo)}
                            alt={`Logo ${tenant.tenant_name}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-primary">
                          <Building2 className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{tenant.tenant_name}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {tenant.tenant_type || 'perusahaan'}
                          </Badge>
                          <StatusBadge status={tenant.tenant_sts == 1 ? 'active' : 'inactive'} />
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Aksi untuk ${tenant.tenant_name}`}>
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tenant)}>
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedTenant(tenant)
                            setDeleteOpen(true)
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {tenant.tenant_address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="truncate">{tenant.tenant_address}</span>
                      </div>
                    )}
                    {(tenant.tenant_contact || tenant.tenant_pic) && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {tenant.tenant_contact && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Kontak</p>
                            <div className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                              {tenant.tenant_contact}
                            </div>
                          </div>
                        )}
                        {tenant.tenant_pic && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">PIC</p>
                            <div className="text-xs font-medium bg-accent text-accent-foreground px-2 py-1 rounded">
                              {tenant.tenant_pic}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">Pengguna</span>
                      </div>
                      <Badge variant="secondary">{tenant.users?.length ?? 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Site</span>
                      <Badge variant="secondary">{tenant.sites?.length ?? 0}</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(tenant)}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                    Perbarui
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-accent mb-4">
                <Building2 className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Belum ada tenant</h2>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Mulai dengan menambahkan tenant/organisasi pertama ke sistem
              </p>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Tambah Tenant
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <TenantFormDialog open={formOpen} onOpenChange={setFormOpen} tenant={selectedTenant} mode={formMode} />
      <DeleteTenantDialog open={deleteOpen} onOpenChange={setDeleteOpen} tenant={selectedTenant} />
    </DashboardLayout>
  )
}
