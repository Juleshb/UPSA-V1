import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraphicIcon } from '../components/Graphics'
import { useAuth } from './AuthContext'
import { ROLE_LABEL, ROLE_SHORT } from './roles'

function initials(name?: string) {
  return (name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  return (
    <div className={`app-profile${open ? ' open' : ''}`} ref={root}>
      <button
        type="button"
        className="app-profile-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="app-avatar" aria-hidden="true">{initials(user.fullName)}</span>
        <span className="app-profile-copy">
          <b>{user.email}</b>
          <small>{ROLE_SHORT[user.role]}</small>
        </span>
        <GraphicIcon name="chevron" />
      </button>
      {open && (
        <div className="app-profile-menu" role="menu">
          <div className="app-profile-card">
            <span className="app-avatar large" aria-hidden="true">{initials(user.fullName)}</span>
            <div>
              <b>{user.fullName}</b>
              <small>{user.email}</small>
              <em>{ROLE_LABEL[user.role]}</em>
            </div>
          </div>
          <Link className="app-profile-item" role="menuitem" to="/" onClick={() => setOpen(false)}>
            <GraphicIcon name="site" />
            Public site
          </Link>
          <button
            type="button"
            className="app-profile-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
              navigate('/login')
            }}
          >
            <GraphicIcon name="logout" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
