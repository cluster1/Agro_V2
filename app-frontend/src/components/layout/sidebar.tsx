'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useSidebarStore } from '@/stores/sidebar-store'
import {
  LayoutDashboard,
  MapPin,
  Radio,
  LineChart,
  Camera,
  Bell,
  FileText,
  Users,
  Building2,
  Leaf,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  Settings,
} from 'lucide-react'
import { TenantSelector } from '@/components/tenant-selector'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface NavItem {
  name: string
  href?: string
  icon: any
  roles: string[]
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'tenant_admin', 'operator', 'agronom']
  },
  {
    name: 'Monitoring',
    icon: LineChart,
    roles: ['admin', 'tenant_admin', 'operator', 'agronom'],
    children: [
      { name: 'Sensor Real-time', href: '/monitoring', icon: LineChart, roles: ['admin', 'tenant_admin', 'operator', 'agronom'] },
      { name: 'Galeri & CCTV', href: '/media', icon: Camera, roles: ['admin', 'tenant_admin', 'operator', 'agronom'] },
      { name: 'Alert', href: '/alerts', icon: Bell, roles: ['admin', 'tenant_admin', 'operator', 'agronom'] },
    ]
  },
  {
    name: 'Environment',
    icon: Layers,
    roles: ['admin', 'tenant_admin'],
    children: [
      { name: 'Sites & Cluster', href: '/sites', icon: MapPin, roles: ['admin', 'tenant_admin'] },
      { name: 'Device & Sensor', href: '/devices', icon: Radio, roles: ['admin', 'tenant_admin'] },
    ]
  },
  {
    name: 'Report',
    href: '/reports',
    icon: FileText,
    roles: ['admin', 'tenant_admin', 'agronom']
  },
  {
    name: 'Utility',
    icon: Settings,
    roles: ['admin', 'tenant_admin'],
    children: [
      { name: 'Tenant', href: '/tenants', icon: Building2, roles: ['admin'] },
      { name: 'Users', href: '/users', icon: Users, roles: ['admin', 'tenant_admin'] },
    ]
  },
]

const ring =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { isCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenuOpen } = useSidebarStore()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Environment: true,
    Utility: true,
  })
  const closedByNav = useRef(false)

  // Close the drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname, setMobileMenuOpen])

  // If the viewport grows to desktop while the drawer is open, close it
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setMobileMenuOpen])

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }))
  }

  const filteredNavigation = navigation.map(item => {
    if (item.children) {
      const filteredChildren = item.children.filter(child =>
        child.roles.includes(user?.user_role || '')
      )
      if (filteredChildren.length === 0) return null
      return { ...item, children: filteredChildren }
    }
    if (!item.roles.includes(user?.user_role || '')) return null
    return item
  }).filter(Boolean) as NavItem[]

  const productCode = process.env.NEXT_PUBLIC_PRODUCT_CODE

  const isPathActive = (href?: string) =>
    !!href && (pathname === href || !!pathname?.startsWith(href + '/'))

  const handleLinkClick = () => {
    closedByNav.current = true
    setMobileMenuOpen(false)
  }

  const renderNavItem = (item: NavItem, collapsed: boolean, prefix: string) => {
    const Icon = item.icon
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedMenus[item.name]
    const isActive = isPathActive(item.href)
    const hasActiveChild = item.children?.some(child => isPathActive(child.href))
    const submenuId = `${prefix}-submenu-${slug(item.name)}`

    const childLink = (child: NavItem) => {
      const ChildIcon = child.icon
      const isChildActive = isPathActive(child.href)
      return (
        <Link
          key={child.name}
          href={child.href || '#'}
          onClick={handleLinkClick}
          aria-current={isChildActive ? 'page' : undefined}
          className={cn(
            'group flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-sm transition-colors duration-200 coarse:min-h-[44px]',
            ring,
            isChildActive
              ? 'border-primary bg-primary/10 font-semibold text-primary'
              : 'border-transparent font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <ChildIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{child.name}</span>
        </Link>
      )
    }

    if (hasChildren) {
      const menuButton = (
        <button
          type="button"
          onClick={() => !collapsed && toggleMenu(item.name)}
          aria-label={collapsed ? item.name : undefined}
          aria-expanded={collapsed ? undefined : !!isExpanded}
          aria-controls={collapsed ? undefined : submenuId}
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl border-l-4 py-3 text-sm transition-colors duration-200 coarse:min-h-[44px]',
            ring,
            collapsed ? 'justify-center px-3' : 'px-4',
            hasActiveChild
              ? 'border-primary bg-primary/10 font-semibold text-primary'
              : 'border-transparent font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.name}</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </>
          )}
        </button>
      )

      return (
        <div key={item.name}>
          {collapsed ? (
            <Popover>
              <PopoverTrigger asChild>{menuButton}</PopoverTrigger>
              <PopoverContent side="right" className="w-56 p-2" sideOffset={10}>
                <div className="space-y-1">
                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                    {item.name}
                  </div>
                  {item.children?.map(childLink)}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <>
              {menuButton}
              {isExpanded && (
                <div id={submenuId} className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-4">
                  {item.children?.map(childLink)}
                </div>
              )}
            </>
          )}
        </div>
      )
    }

    const linkContent = (
      <Link
        key={item.name}
        href={item.href || '#'}
        onClick={handleLinkClick}
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? item.name : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-xl border-l-4 py-3 text-sm transition-colors duration-200 coarse:min-h-[44px]',
          ring,
          collapsed ? 'justify-center px-3' : 'px-4',
          isActive
            ? 'border-primary bg-primary/10 font-semibold text-primary'
            : 'border-transparent font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground motion-safe:hover:translate-x-0.5'
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        {!collapsed && <span>{item.name}</span>}
      </Link>
    )

    if (collapsed) {
      return (
        <Tooltip key={item.name} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name}
          </TooltipContent>
        </Tooltip>
      )
    }

    return linkContent
  }

  const renderNav = (collapsed: boolean, prefix: string) => (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        <TooltipProvider>
          <nav aria-label="Navigasi utama" className="space-y-1">
            {filteredNavigation.map(item => renderNavItem(item, collapsed, prefix))}
          </nav>
        </TooltipProvider>
      </div>

      {/* Tenant selector (global admin only; renders nothing otherwise).
          In the collapsed desktop rail it lives in the top bar instead. */}
      {!collapsed && user?.user_level === 0 && (
        <div className="border-t bg-muted/30 p-4">
          <TenantSelector id={`${prefix}-tenant-select`} />
        </div>
      )}
    </>
  )

  const brand = (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-primary-foreground/20 p-2">
        <Leaf className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
      </div>
      <div>
        <div className="text-base font-bold text-primary-foreground md:text-lg">{productCode}</div>
        <p className="text-xs text-primary-foreground">IoT Monitoring</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: inline collapsible sidebar */}
      <aside
        id="sidebar"
        className={cn(
          'hidden h-full flex-col border-r bg-card shadow-lg transition-[width] duration-300 motion-reduce:transition-none lg:flex',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b bg-primary px-4',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {!isCollapsed && brand}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!isCollapsed}
            aria-controls="sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground coarse:h-11 coarse:w-11"
          >
            {isCollapsed ? (
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
        {renderNav(isCollapsed, 'd')}
      </aside>

      {/* Mobile: drawer (Radix Dialog gives focus trap, Escape, aria-modal) */}
      <DialogPrimitive.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-drawer bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content
            id="mobile-nav"
            aria-describedby={undefined}
            onCloseAutoFocus={e => {
              if (closedByNav.current) {
                e.preventDefault()
                closedByNav.current = false
              }
            }}
            className="fixed inset-y-0 left-0 z-modal flex w-72 max-w-[85vw] flex-col border-r bg-card shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left motion-reduce:animate-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Menu navigasi</DialogPrimitive.Title>
            <div className="flex h-16 items-center justify-between border-b bg-primary px-4">
              {brand}
              <DialogPrimitive.Close
                aria-label="Tutup menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
            {renderNav(false, 'm')}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
