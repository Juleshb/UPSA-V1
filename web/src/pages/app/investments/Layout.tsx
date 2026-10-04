import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/app/investments', 'Dashboard', true],
  ['/app/investments/opportunities', 'Opportunities', false],
  ['/app/investments/applications', 'Applications', false],
  ['/app/investments/positions', 'Investments', false],
  ['/app/investments/portfolio', 'Portfolio', false],
  ['/app/investments/returns', 'Returns', false],
  ['/app/investments/exits', 'Exits', false],
  ['/app/investments/maturity', 'Maturity', false],
  ['/app/investments/reports', 'Reports', false],
  ['/app/investments/messages', 'Notifications', false],
  ['/app/investments/audit', 'Audit logs', false],
] as const

export function InvestmentLayout() {
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="Investment">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
