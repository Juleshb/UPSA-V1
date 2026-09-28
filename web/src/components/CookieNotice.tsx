import { Link } from 'react-router-dom'
import { useCookies } from '../platform/CookieContext'
import { useTheme } from '../platform/ThemeContext'

export function CookieNotice() {
  const { consent, allow, essential } = useCookies()
  const { theme } = useTheme()

  if (consent) return null

  return (
    <div className="cookie-notice" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-copy">
      <div>
        <p id="cookie-title">Allow cookies</p>
        <p id="cookie-copy">
          UPSA Next Payment uses cookies to remember Primary or Reversed appearance and keep this site working.
          Analytics and advertising cookies are not used.
        </p>
      </div>
      <div className="cookie-notice-actions">
        <Link to="/platform/compliance">Privacy</Link>
        <button type="button" className="button secondary" onClick={essential}>Essential only</button>
        <button type="button" className="button primary" onClick={() => allow(theme)}>Allow cookies</button>
      </div>
    </div>
  )
}
