'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import api from '@/lib/api'

interface Tenant {
  tenant_id: string
  tenant_name: string
  tenant_type: string
}

interface TenantSelectorProps {
  /** Unique id for the trigger (several instances may exist in the DOM). */
  id?: string
  /** 'stacked' = label above select (sidebar); 'inline' = compact, label visually hidden (top bar). */
  variant?: 'stacked' | 'inline'
  className?: string
}

export function TenantSelector({ id = 'tenant-select', variant = 'stacked', className }: TenantSelectorProps) {
  const { user, selectedTenantId, setSelectedTenant } = useAuthStore()

  // Only fetch tenants if user is global admin (level 0)
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await api.get('/tenants')
      return response.data as Tenant[]
    },
    enabled: user?.user_level === 0,
  })

  // Don't show selector if not global admin
  if (user?.user_level !== 0) {
    return null
  }

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenant(tenantId)
  }

  const inline = variant === 'inline'

  return (
    <div className={cn(inline ? 'flex items-center gap-2' : 'space-y-2', className)}>
      <label
        htmlFor={id}
        className={cn(
          'flex items-center gap-2 text-sm font-medium text-muted-foreground',
          inline && 'sr-only'
        )}
      >
        <Building2 className="h-4 w-4" aria-hidden="true" />
        Pilih tenant
      </label>
      <Select
        value={selectedTenantId || user?.tenant_id}
        onValueChange={handleTenantChange}
        disabled={isLoading}
      >
        <SelectTrigger id={id} className={cn('w-full', inline && 'w-56')}>
          <SelectValue placeholder="Pilih tenant..." />
        </SelectTrigger>
        <SelectContent>
          {tenants?.map((tenant) => (
            <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
              <div className="flex flex-col items-start">
                <span className="font-medium">{tenant.tenant_name}</span>
                <span className="text-xs text-muted-foreground">
                  {tenant.tenant_type}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
