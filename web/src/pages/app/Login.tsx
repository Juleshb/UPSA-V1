import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { DEMO_ACCOUNTS, ROLE_LABEL } from '../../platform/roles'
import { themeLogo } from '../../platform/ThemeContext'
import { ThemeToggle } from '../../platform/ThemeToggle'
import { usePageTitle } from '../../components/usePageTitle'

export function Login() {
  usePageTitle('Sign in — UPSA Next Payment')
  const { user, ready, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/app'
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email)
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to={from} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <Link to="/">
          <img src={themeLogo('reversed')} alt="UPSA Next Payment" />
        </Link>
        <p>Secure workspace for member schools, families and licensed institutions.</p>
        <ul>
          <li>School ledgers stay the record of what is owed</li>
          <li>Payments record how money arrived</li>
          <li>Credit decisions remain with licensed partners</li>
        </ul>
      </section>
      <section className="login-card">
        <div className="login-card-top">
          <div className="eyebrow"><span /> Workspace</div>
          <ThemeToggle />
        </div>
        <h1>Sign in</h1>
        <p>Use a seeded sandbox account or your issued credentials.</p>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="app-banner" role="alert">{error}</p>}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Enter workspace'}
          </button>
        </form>
        <div className="login-accounts">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email)
                setPassword(account.password)
              }}
            >
              <b>{account.label}</b>
              <span>{ROLE_LABEL[account.role]}</span>
              <small>{account.hint}</small>
            </button>
          ))}
        </div>
        <Link to="/">Back to the public site</Link>
      </section>
    </main>
  )
}
