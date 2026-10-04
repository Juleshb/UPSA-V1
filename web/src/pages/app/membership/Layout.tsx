import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/app/membership', 'Dashboard', true],
  ['/app/membership/members', 'Members', false],
  ['/app/membership/categories', 'Categories', false],
  ['/app/membership/reports', 'Reports', false],
  ['/app/membership/notices', 'Notifications', false],
  ['/app/membership/audit', 'Audit logs', false],
  ['/app/membership/requests', 'Public requests', false],
] as const

export function MembershipLayout() {
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="Membership">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
