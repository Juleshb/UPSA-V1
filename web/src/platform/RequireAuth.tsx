import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth({ children, permission }: { children: ReactNode; permission?: string }) {
  const { user, ready, can } = useAuth()
  const location = useLocation()

  if (!ready) {
    return <div className="app-loading">Opening workspace…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (permission && !can(permission)) {
    return <Navigate to="/app" replace />
  }
  return children
}
