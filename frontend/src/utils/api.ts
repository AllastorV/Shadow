import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/auth'

const api = axios.create({
  baseURL: '/api/v1',
  // SECURITY: Set reasonable timeout to prevent hanging requests
  timeout: 30000,
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
