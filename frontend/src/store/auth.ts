import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, AuthState } from '../types'

/**
 * SECURITY NOTE on token storage:
 * - Tokens in localStorage persist across sessions and are accessible by any JS
 *   on the same origin (XSS risk).
 * - sessionStorage clears on tab/browser close and is NOT shared between tabs —
 *   slightly better XSS resilience.
 * - For the best security, tokens should be stored in httpOnly cookies (set by
 *   the backend) so JS cannot access them at all. This requires backend changes
 *   to use cookie-based auth instead of Bearer tokens.
 * - We use sessionStorage here as a pragmatic improvement over localStorage
 *   while keeping Bearer token auth.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user: User, token: string) => set({ user, token }),
      logout: () => {
        set({ user: null, token: null })
        // Clear both storages on logout
        try {
          sessionStorage.removeItem('shadow-auth')
          localStorage.removeItem('shadow-auth')
        } catch {}
      },
    }),
    {
      name: 'shadow-auth',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
