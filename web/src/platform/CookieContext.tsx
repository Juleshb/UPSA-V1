import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  CONSENT_COOKIE,
  THEME_COOKIE,
  readConsent,
  setCookie,
  type CookieConsent,
} from './cookies'
import type { AppTheme } from './ThemeContext'

type CookieContextValue = {
  consent: CookieConsent | null
  allowed: boolean
  allow: (theme: AppTheme) => void
  essential: () => void
}

const CookieContext = createContext<CookieContextValue | null>(null)

export function CookieProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readConsent())

  const value = useMemo<CookieContextValue>(() => ({
    consent,
    allowed: consent === 'accepted',
    allow(theme) {
      setCookie(CONSENT_COOKIE, 'accepted')
      setCookie(THEME_COOKIE, theme)
      setConsent('accepted')
    },
    essential() {
      setCookie(CONSENT_COOKIE, 'essential')
      setConsent('essential')
    },
  }), [consent])

  return <CookieContext.Provider value={value}>{children}</CookieContext.Provider>
}

export function useCookies() {
  const context = useContext(CookieContext)
  if (!context) throw new Error('useCookies must be used inside CookieProvider')
  return context
}

