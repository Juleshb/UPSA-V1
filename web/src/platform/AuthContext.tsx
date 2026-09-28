import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  api,
  clearSession,
  persistSession,
  storedUser,
  type SessionUser,
} from './api'

type AuthContextValue = {
  user: SessionUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => void
  can: (permission?: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => storedUser())
  const [ready, setReady] = useState(!storedUser())

  useEffect(() => {
    if (!storedUser()) {
      setReady(true)
      return
    }
    api.me()
      .then((profile) => {
        setUser(profile)
        localStorage.setItem('rupsa.app.user', JSON.stringify(profile))
      })
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    async login(email, password) {
      const session = await api.login(email, password)
      persistSession(session)
      setUser(session.user)
      return session.user
    },
    logout() {
      clearSession()
      setUser(null)
    },
    can(permission) {
      if (!permission) return true
      return Boolean(user?.permissions.includes(permission))
    },
  }), [user, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
