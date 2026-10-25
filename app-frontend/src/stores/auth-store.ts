import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SESSION_FLAG } from '@/lib/config'

interface User {
  user_id: string
  user_name: string
  user_email: string
  user_role: string
  user_level: number
  tenant_id: string
  tenant?: {
    tenant_id: string
    tenant_name: string
  }
}

interface AuthState {
  user: User | null
  // In memory only. Never persisted: after a reload it is restored from the httpOnly refresh cookie.
  accessToken: string | null
  selectedTenantId: string | null
  setAuth: (user: User, accessToken: string) => void
  setAccessToken: (accessToken: string) => void
  setSelectedTenant: (tenantId: string) => void
  logout: () => void
}

function setSessionFlag(on: boolean) {
  if (typeof document === 'undefined') return
  document.cookie = on
    ? `${SESSION_FLAG}=1; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
    : `${SESSION_FLAG}=; path=/; max-age=0; SameSite=Lax`
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      selectedTenantId: null,
      setAuth: (user, accessToken) => {
        setSessionFlag(true)
        // Default selected tenant to user's tenant
        set({ user, accessToken, selectedTenantId: user.tenant_id })
      },
      setAccessToken: (accessToken) => set({ accessToken }),
      setSelectedTenant: (tenantId) => {
        set({ selectedTenantId: tenantId })
      },
      logout: () => {
        setSessionFlag(false)
        set({ user: null, accessToken: null, selectedTenantId: null })
      },
    }),
    {
      name: 'auth-storage',
      version: 1,
      // v0 persisted accessToken/refreshToken; drop them (and the legacy plain keys) on upgrade.
      migrate: (persisted: any) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
        return { user: persisted?.user ?? null, selectedTenantId: persisted?.selectedTenantId ?? null } as any
      },
      // Tokens are deliberately excluded from storage.
      partialize: (state) => ({
        user: state.user,
        selectedTenantId: state.selectedTenantId,
      }),
    }
  )
)
