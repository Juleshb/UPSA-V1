import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { menuIsActive, navMenus } from '../nav'
import { useAuth } from '../platform/AuthContext'

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const { pathname } = useLocation()
  const { user } = useAuth()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null)
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <header className="topbar">
      <Link className="mini-brand" to="/" aria-label="UPSA Next Payment home">
        <img src="/rupsa-next-icon.svg" alt="" />
        <span className="brand-lockup">
          <span className="brand-line"><b>UPSA</b><em>Next</em></span>
          <small>Payment</small>
        </span>
      </Link>

      <nav
        id="mobile-nav"
        ref={navRef}
        className={`site-nav${menuOpen ? ' open' : ''}`}
        aria-label="Primary"
      >
        {navMenus.map((menu) => (
          <NavDropdown
            key={menu.id}
            menu={menu}
            pathname={pathname}
            open={openDropdown === menu.id}
            onToggle={() => setOpenDropdown((current) => (current === menu.id ? null : menu.id))}
          />
        ))}
        <NavLink to="/services">Online services</NavLink>
        <NavLink to={user ? '/app' : '/login'} className="nav-signin">
          {user ? 'Workspace' : 'Sign in'}
        </NavLink>
      </nav>

      <button
        className={`menu-toggle${menuOpen ? ' open' : ''}`}
        type="button"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        onClick={() => {
          setMenuOpen((value) => !value)
          setOpenDropdown(null)
        }}
      >
        <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
        <i />
        <i />
      </button>
    </header>
  )
}

function NavDropdown({
  menu,
  pathname,
  open,
  onToggle,
}: {
  menu: (typeof navMenus)[number]
  pathname: string
  open: boolean
  onToggle: () => void
}) {
  const panelId = useId()
  const active = menuIsActive(pathname, menu)

  return (
    <div className={`nav-item${open ? ' open' : ''}${active ? ' current' : ''}`}>
      <button
        type="button"
        className="nav-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={onToggle}
      >
        {menu.label}
        <svg viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" />
        </svg>
      </button>
      <div id={panelId} className="nav-dropdown" role="menu">
        {menu.items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            role="menuitem"
            className={pathname === item.to ? 'active' : undefined}
          >
            <b>{item.label}</b>
            <span>{item.hint}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
