import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../../platform/AuthContext'

const STUDY = [
  ['/training', 'Public training', false],
] as const

const ADMIN = [
  ['/app/literacy', 'Dashboard', true],
  ['/app/literacy/programmes', 'Programmes', false],
  ['/app/literacy/courses', 'Courses', false],
  ['/app/literacy/learners', 'Learners', false],
  ['/app/literacy/training', 'Sessions', false],
  ['/app/literacy/practice', 'Practice', false],
  ['/app/literacy/certificates', 'Certificates', false],
  ['/app/literacy/reports', 'Reports', false],
  ['/app/literacy/messages', 'Notifications', false],
  ['/app/literacy/audit', 'Audit logs', false],
] as const

export function LiteracyLayout() {
  const { can } = useAuth()
  const links = can('literacy.write') ? [...STUDY, ...ADMIN] : STUDY
  return (
    <div className="app-page">
      <nav className="app-subnav" aria-label="Financial literacy">
        {links.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}>{label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
