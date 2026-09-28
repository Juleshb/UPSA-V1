import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { THEME_COOKIE, cookiesAllowed, getCookie, setCookie } from './cookies'

export type AppTheme = 'primary' | 'reversed'

type ThemeContextValue = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readTheme(): AppTheme {
  return getCookie(THEME_COOKIE) === 'reversed' ? 'reversed' : 'primary'
}

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const value = readTheme()
    applyTheme(value)
    return value
  })

  useEffect(() => {
    applyTheme(theme)
    if (cookiesAllowed()) setCookie(THEME_COOKIE, theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

export function themeLogo(theme: AppTheme) {
  return theme === 'primary' ? '/rupsa-next-logo.svg' : '/rupsa-next-logo-reversed.svg'
}
