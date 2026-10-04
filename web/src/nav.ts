export type NavItem = {
  to: string
  label: string
  hint: string
}

export type NavMenu = {
  id: string
  label: string
  to: string
  items: NavItem[]
}

export const navMenus: NavMenu[] = [
  {
    id: 'platform',
    label: 'Platform',
    to: '/platform',
    items: [
      { to: '/platform', label: 'Overview', hint: 'Ecosystem and core modules' },
      { to: '/platform/payments', label: 'Payments', hint: 'Fees, receipts and reconciliation' },
      { to: '/platform/financing', label: 'Financing', hint: 'Loan marketplace and credit workflow' },
      { to: '/platform/guarantee', label: 'Guarantee', hint: 'Collateral support for members' },
      { to: '/platform/compliance', label: 'Trust & compliance', hint: 'KYC, data protection and APIs' },
      { to: '/developers', label: 'API sandbox', hint: 'Try live v1 routes in the browser' },
    ],
  },
  {
    id: 'solutions',
    label: 'Solutions',
    to: '/solutions/schools',
    items: [
      { to: '/solutions/schools', label: 'Schools', hint: 'Collections, ledgers and dashboards' },
      { to: '/solutions/parents', label: 'Parents & guardians', hint: 'Balances, plans and receipts' },
      { to: '/solutions/partners', label: 'Banks & MFIs', hint: 'Verified data and portfolio tools' },
    ],
  },
  {
    id: 'about',
    label: 'About',
    to: '/about',
    items: [
      { to: '/about', label: 'About UPSA Next Payment', hint: 'Mandate, status and governance' },
      { to: '/brand', label: 'Brand identity', hint: 'Mark, colour and applications' },
    ],
  },
]

export function pathMatches(pathname: string, to: string) {
  return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`))
}

export function menuIsActive(pathname: string, menu: NavMenu) {
  return menu.items.some((item) => pathname === item.to) || pathname === menu.to
}
