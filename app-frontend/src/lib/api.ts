import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'

import { API_URL } from '@/lib/config'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Sends the httpOnly refresh cookie to the /auth endpoints
  withCredentials: true,
})

// Single in-flight refresh shared by all concurrent 401s and the startup bootstrap
let refreshPromise: Promise<string> | null = null

function requestRefresh(): Promise<string> {
  return axios
    .post(`${API_URL}/auth/refresh`, undefined, { withCredentials: true, timeout: 10000 })
    .then((response) => {
      const { accessToken } = response.data
      useAuthStore.getState().setAccessToken(accessToken)
      return accessToken as string
    })
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    // The refresh cookie is rotated on every use and shared by all tabs. A cross-tab lock makes
    // tabs refresh one after another, so each sends the cookie the previous one just received
    // instead of racing for the same token.
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    const run = locks ? locks.request('agro-refresh', requestRefresh) : requestRefresh()
    refreshPromise = Promise.resolve(run).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// Request interceptor for adding auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const isAuthRoute = (url?: string) => !!url && /\/auth\/(login|refresh|logout)/.test(url)

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRoute(originalRequest.url)
    ) {
      originalRequest._retry = true

      try {
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        useAuthStore.getState().logout()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// Export both default and named for flexibility
export { api }
export default api
