'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { refreshAccessToken } from '@/lib/api'
import { LoadingState } from '@/components/ui/loading-state'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const lastPathname = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const { user, accessToken, logout } = useAuthStore.getState()
      // After a reload the access token is gone; get a new one from the httpOnly refresh cookie.
      // Without a stored user there is nothing to restore; the redirect effect below handles it.
      if (user && !accessToken) {
        try {
          await refreshAccessToken()
        } catch {
          logout()
        }
      }
      if (!cancelled) setIsLoading(false)
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Not signed in, or signed out elsewhere (e.g. refresh failed in the API interceptor)
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  // Move focus to the main region on client-side navigation (not on first mount)
  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    if (lastPathname.current !== null && lastPathname.current !== pathname) {
      document.getElementById('main')?.focus({ preventScroll: true })
    }
    lastPathname.current = pathname
  }, [pathname, isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-2 focus-visible:top-2 focus-visible:z-toast focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Lewati ke konten
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-background p-4 focus:outline-none md:p-6"
        >
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
