export const CONSENT_COOKIE = 'rupsa.consent'
export const THEME_COOKIE = 'rupsa.theme'

export type CookieConsent = 'accepted' | 'essential'

export function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`
}

export function cookiesAllowed() {
  return getCookie(CONSENT_COOKIE) === 'accepted'
}

export function readConsent(): CookieConsent | null {
  const value = getCookie(CONSENT_COOKIE)
  return value === 'accepted' || value === 'essential' ? value : null
}
