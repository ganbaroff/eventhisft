import { create } from 'zustand'
import { User, AppContext } from '../types'
import { authApi, contextApi } from '../api/client'

interface AuthState {
  user: User | null
  context: AppContext | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loadContext: () => Promise<void>
  /** Refetch /auth/me — used after changePassword to clear mustChangePassword in the store. */
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  context: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const tokens = await authApi.login(email, password)
      localStorage.setItem('access_token', tokens.accessToken)
      localStorage.setItem('refresh_token', tokens.refreshToken)
      const user = await authApi.me()
      set({ user, isLoading: false })
    } catch {
      set({ error: 'Invalid credentials', isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, context: null })
  },

  loadContext: async () => {
    try {
      const context = await contextApi.get()
      set({ context })
    } catch {
      // Context load failure is non-fatal — app still works
    }
  },

  refreshUser: async () => {
    try {
      const user = await authApi.me()
      set({ user })
    } catch {
      // If me() fails (e.g. token expired), logout handler elsewhere picks it up.
    }
  },
}))
