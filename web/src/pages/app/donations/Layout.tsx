import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/app/donations', 'Dashboard', true],
  ['/app/donations/donors', 'Donors', false],
  ['/app/donations/campaigns', 'Campaigns', false],
  ['/app/donations/pledges', 'Pledges', false],
  ['/app/donations/gifts', 'Donations', false],
  ['/app/donations/payments', 'Payments', false],
  ['/app/donations/beneficiaries', 'Beneficiaries', false],
  ['/app/donations/allocations', 'Allocation', false],
  ['/app/donations/distributions', 'Distribution', false],
  ['/app/donations/receipts', 'Receipts', false],
  ['/app/donations/impact', 'Impact', false],
  ['/app/donations/messages', 'Notifications', false],
  ['/app/donations/reports', 'Reports', false],
  ['/app/donations/audit', 'Audit logs', false],
] as const

export function DonationLayout() {
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="Donation">
        {LINKS.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
