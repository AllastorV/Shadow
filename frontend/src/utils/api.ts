import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/auth'

const api = axios.create({
  baseURL: '/api/v1',
  // timeout: 0 — no global timeout; upload requests can take hours for large files.
  // Individual non-upload requests can set their own timeout via config.
  timeout: 0,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      // Only redirect if not already on auth pages
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login'
      }
    }
    // SECURITY: Don't log sensitive response data to console in production
    if (import.meta.env.DEV) {
      console.error('API error:', err.response?.status, err.config?.url)
    }
    return Promise.reject(err)
  }
)

export default api
