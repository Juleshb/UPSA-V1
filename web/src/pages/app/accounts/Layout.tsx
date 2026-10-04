import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/app/accounts', 'Dashboard', true],
  ['/app/accounts/applications', 'Applications', false],
  ['/app/accounts/register', 'Accounts', false],
  ['/app/accounts/reports', 'Reports', false],
  ['/app/accounts/messages', 'Notifications', false],
  ['/app/accounts/audit', 'Audit logs', false],
] as const

export function AccountLayout() {
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="Account opening">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
