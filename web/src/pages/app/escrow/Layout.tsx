import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/app/escrow', 'Dashboard', true],
  ['/app/escrow/groups', 'Groups', false],
  ['/app/escrow/accounts', 'Escrow accounts', false],
  ['/app/escrow/collateral', 'Collateral', false],
  ['/app/escrow/facilities', 'Facilities', false],
  ['/app/escrow/applications', 'Applications', false],
  ['/app/escrow/guarantees', 'Guarantees', false],
  ['/app/escrow/reports', 'Reports', false],
  ['/app/escrow/reconciliation', 'Reconciliation', false],
  ['/app/escrow/documents', 'Documents', false],
  ['/app/escrow/notices', 'Notifications', false],
  ['/app/escrow/audit', 'Audit logs', false],
  ['/app/guarantees', 'Lending register', false],
] as const

export function EscrowLayout() {
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="40/60 escrow and guarantee">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
