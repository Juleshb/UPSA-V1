import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { GraphicIcon } from '../components/Graphics'
import { useAuth } from './AuthContext'
import { ProfileMenu } from './ProfileMenu'
import { APP_NAV } from './roles'
import { themeLogo, useTheme } from './ThemeContext'
import { ThemeToggle } from './ThemeToggle'

function currentSection(pathname: string) {
  return [...APP_NAV].reverse().find((item) => (
    item.to === '/app' ? pathname === '/app' : pathname.startsWith(item.to)
  )) ?? APP_NAV[0]
}

export function AppShell() {
  const { can } = useAuth()
  const { theme } = useTheme()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = APP_NAV.filter((item) => can(item.permission))
  const section = currentSection(location.pathname)

  function close() {
    setOpen(false)
  }

  return (
    <div className="app-shell">
      {open && <button type="button" className="app-overlay" aria-label="Close menu" onClick={close} />}
      <aside className={`app-sidebar${open ? ' open' : ''}`}>
        <Link className="app-brand" to="/app" onClick={close}>
          <img src={themeLogo(theme)} alt="UPSA Next Payment" />
        </Link>
        <p className="app-side-kicker">{theme === 'primary' ? 'Primary UI' : 'Reversed UI'}</p>
        <nav>
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              onClick={close}
            >
              <span className="app-nav-icon"><GraphicIcon name={item.icon} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-side-foot">
          <ThemeToggle />
          <Link className="app-side-link" to="/" onClick={close}>
            <GraphicIcon name="site" />
            Public site
          </Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button type="button" className="app-menu" onClick={() => setOpen((value) => !value)}>
            <GraphicIcon name="menu" />
            Menu
          </button>
          <div className="app-top-context">
            <span className="app-crumb">Workspace</span>
            <b>{section.label}</b>
          </div>
          <div className="app-top-tools">
            <span className="app-env">Rwanda · RWF</span>
            <ThemeToggle compact />
            <ProfileMenu />
          </div>
        </header>
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
