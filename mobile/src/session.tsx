import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, bindSession, clearTokens, setTokens, type AuthSession, type SessionUser } from './api'
import { clearSession, loadSession, saveSession } from './storage'

type SessionValue = {
  ready: boolean
  user: SessionUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    fullName: string
    email: string
    phone: string
    password: string
    nationalId: string
    parentalConsent: boolean
  }) => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    bindSession(async (session) => {
      await saveSession(session)
      setUser(session.user)
    })
    loadSession()
      .then((session) => {
        if (!session || session.user.role !== 'PARENT') return
        setTokens(session.accessToken, session.refreshToken)
        setUser(session.user)
      })
      .finally(() => setReady(true))
    return () => bindSession(null)
  }, [])

  const value = useMemo<SessionValue>(() => ({
    ready,
    user,
    async signIn(email, password) {
      const session = await api.login(email.trim(), password)
      if (session.user.role !== 'PARENT') {
        throw new Error('This app is for parents and guardians. School and partner staff use the web workspace.')
      }
      await accept(session, setUser)
    },
    async signUp(input) {
      const session = await api.register({
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim() || undefined,
        password: input.password,
        nationalId: input.nationalId.trim() || undefined,
        parentalConsent: input.parentalConsent,
      })
      await accept(session, setUser)
    },
    async signOut() {
      clearTokens()
      setUser(null)
      await clearSession()
    },
  }), [ready, user])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

async function accept(session: AuthSession, setUser: (user: SessionUser) => void) {
  setTokens(session.accessToken, session.refreshToken)
  await saveSession(session)
  setUser(session.user)
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Session is unavailable.')
  return value
}
