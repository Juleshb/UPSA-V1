import { Link } from 'react-router-dom'
import { usePageTitle } from '../components/usePageTitle'

export function NotFound() {
  usePageTitle('Page not found — UPSA Next Payment')

  return (
    <main className="not-found">
      <div className="eyebrow"><span /> Error 404</div>
      <h1>This page is not on the official site.</h1>
      <p className="hero-copy">The address may have changed. Return to the homepage or request a briefing.</p>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <Link className="button primary" to="/">Back to home</Link>
        <Link className="button secondary" to="/contact">Request a briefing</Link>
      </div>
    </main>
  )
}
