'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
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
import { Users, Plus, MoreVertical, Pencil, Trash2, Mail, Phone, Shield } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { UserFormDialog } from '@/components/users/user-form-dialog'
import { DeleteUserDialog } from '@/components/users/delete-user-dialog'
import { queryKeys } from '@/lib/query-keys'
import { roleLabel } from '@/lib/format'

const ROLE_VARIANTS: Record<string, BadgeProps['variant']> = {
  admin: 'default',
  tenant_admin: 'info',
  operator: 'success',
  agronom: 'warning',
}

const LEVEL_BADGES: Record<number, { label: string; variant: BadgeProps['variant'] }> = {
  0: { label: 'Admin Global', variant: 'destructive' },
  1: { label: 'Admin Tenant', variant: 'info' },
  2: { label: 'Operator', variant: 'success' },
  3: { label: 'Agronom', variant: 'warning' },
}

export default function UsersPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const { user } = useAuth()

  // Fetch users based on role constraints
  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.users(user?.tenant_id), user?.user_id, user?.user_role],
    queryFn: async () => {
      if (!user) return []

      // Admin (user_level === 0): Get all users from all tenants
      if (user.user_role === 'admin' || user.user_level === 0) {
        const response = await api.get('/users', { noTenant: true } as any)
        return response.data
      }

      // Tenant Admin: Get users in their tenant
      if (user.user_role === 'tenant_admin') {
        const tenantId = user.tenant_id
        if (!tenantId) return []
        const response = await api.get('/users')
        return response.data
      }

      // Other roles: Return only current user
      return [user]
    },
    enabled: !!user,
  })

  // Determine if user can add new users (only admin and tenant_admin)
  const canAddUser = user && ['admin', 'tenant_admin'].includes(user.user_role)

  // Determine if user can edit/delete other users
  const canManageUsers = user && ['admin', 'tenant_admin'].includes(user.user_role)

  const getLevelBadge = (level: number) => LEVEL_BADGES[level] ?? { label: 'Tidak diketahui', variant: 'secondary' as const }

  const openCreate = () => {
    setFormMode('create')
    setSelectedUser(null)
    setFormOpen(true)
  }

  const openEdit = (userItem: any) => {
    setSelectedUser(userItem)
    setFormMode('edit')
    setFormOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <PageTitle>Pengguna</PageTitle>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              {user?.user_role === 'admin' || user?.user_level === 0
                ? 'Kelola semua pengguna (Admin Global)'
                : user?.user_role === 'tenant_admin'
                ? 'Kelola pengguna dalam tenant'
                : 'Profil pengguna'}
            </p>
          </div>
          {canAddUser && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Tambah Pengguna
            </Button>
          )}
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
        ) : users && users.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((userItem: any, index: number) => {
              const levelBadge = getLevelBadge(userItem.user_level)
              return (
                <Card
                  key={userItem.user_id}
                  className="group relative overflow-hidden border-2 motion-safe:animate-slide-up"
                  style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary">
                          <Users className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{userItem.user_name}</CardTitle>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant={ROLE_VARIANTS[userItem.user_role] ?? 'secondary'} className="text-xs">
                              {roleLabel(userItem.user_role)}
                            </Badge>
                            <Badge variant={levelBadge.variant} className="text-xs">
                              {levelBadge.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {(canManageUsers || userItem.user_id === user?.user_id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Aksi untuk ${userItem.user_name}`}>
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(userItem)}>
                              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                            {canManageUsers && userItem.user_id !== user?.user_id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(userItem)
                                  setDeleteOpen(true)
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                Hapus
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {userItem.user_email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span className="truncate">{userItem.user_email}</span>
                        </div>
                      )}
                      {userItem.user_phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span className="truncate">{userItem.user_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span className="text-muted-foreground">Status</span>
                        </div>
                        <StatusBadge status={userItem.user_sts === 'active' ? 'active' : 'inactive'} />
                      </div>
                    </div>
                    {(canManageUsers || userItem.user_id === user?.user_id) && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(userItem)}>
                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                        Perbarui
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-accent mb-4">
                <Users className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Belum ada pengguna</h2>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                {canAddUser
                  ? 'Mulai dengan menambahkan pengguna pertama ke tenant'
                  : 'Tidak ada data pengguna yang dapat ditampilkan'}
              </p>
              {canAddUser && (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tambah Pengguna
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={selectedUser} mode={formMode} />
      <DeleteUserDialog open={deleteOpen} onOpenChange={setDeleteOpen} user={selectedUser} />
    </DashboardLayout>
  )
}
