'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useSidebarStore } from '@/stores/sidebar-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Building2, ChevronDown, Menu, KeyRound } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { TenantSelector } from '@/components/tenant-selector'
import { ChangePasswordDialog } from '@/components/auth/change-password-dialog'
import { roleLabel } from '@/lib/format'

export function TopBar() {
  const { user, logout } = useAuth()
  const { toggleMobileMenu, mobileMenuOpen, isCollapsed } = useSidebarStore()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  if (!user) return null

  const productCode = process.env.NEXT_PUBLIC_PRODUCT_CODE
  const initial = user.user_name?.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-sticky flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm md:px-6">
      {/* Left: Mobile Menu Button + Logo/Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggleMobileMenu}
          aria-label="Buka menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
          aria-haspopup="dialog"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <div>
          <div className="text-lg font-bold text-primary md:text-xl">{productCode}</div>
          <p className="hidden text-xs text-muted-foreground sm:block">IoT Monitoring</p>
        </div>
      </div>

      {/* Right: Tenant (collapsed rail only), Theme Toggle & User Menu */}
      <div className="flex items-center gap-2">
        {isCollapsed && user.user_level === 0 && (
          <div className="mr-2 hidden lg:block">
            <TenantSelector id="topbar-tenant-select" variant="inline" />
          </div>
        )}
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-12 items-center gap-3"
              aria-label={`Menu pengguna ${user.user_name}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" aria-hidden="true">
                {initial}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium">{user.user_name}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(user.user_role)}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" aria-hidden="true">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.user_name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.user_email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {user.tenant?.tenant_name && (
              <>
                <div className="flex items-center px-2 py-1.5 text-sm">
                  <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Organisasi</p>
                    <p className="text-sm font-medium">{user.tenant.tenant_name}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            <div className="flex items-center px-2 py-1.5 text-sm">
              <User className="mr-2 h-4 w-4" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Peran</p>
                <Badge variant={user.user_role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                  {roleLabel(user.user_role)}
                </Badge>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setChangePasswordOpen(true)}
              className="cursor-pointer coarse:min-h-[44px]"
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Ganti Password
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive focus:text-destructive coarse:min-h-[44px]"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </header>
  )
}
