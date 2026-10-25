import { useAuthStore } from '@/stores/auth-store'
import api from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

export function useAuth() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, accessToken, setAuth, logout: logoutStore } = useAuthStore()

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { accessToken, user } = response.data

      setAuth(user, accessToken)
      toast.success('Login Success!', {
        duration: 3000,
      })
      router.push('/dashboard')
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login Failed! Please check your email and password.'
      toast.error(errorMessage, {
        duration: 6000,
        description: 'Please try again or contact administrator if the problem persists.',
      })
      return { success: false, error: errorMessage }
    }
  }

  const logout = () => {
    // Revoke the refresh token server-side (best effort), then clear local state
    api.post('/auth/logout').catch(() => {})
    logoutStore()
    queryClient.clear() // drop cached data so the next user on this browser never sees it
    router.push('/login')
    toast.success('Logout berhasil')
  }

  // Authenticated once a user is known and an in-memory access token exists
  const isAuthenticated = !!user && !!accessToken

  return {
    user,
    login,
    logout,
    isAuthenticated,
  }
}
