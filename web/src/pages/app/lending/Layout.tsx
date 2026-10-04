import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/app/loans', 'Dashboard', true],
  ['/app/loans/products', 'Products', false],
  ['/app/loans/applications', 'Applications', false],
  ['/app/loans/book', 'Loan accounts', false],
  ['/app/loans/reports', 'Reports', false],
  ['/app/loans/notices', 'Notifications', false],
  ['/app/loans/audit', 'Audit logs', false],
] as const

export function LendingLayout() {
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="Lending">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
