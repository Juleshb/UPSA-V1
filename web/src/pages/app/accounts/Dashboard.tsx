import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, PageHeading, Panel, Stat } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'

const ACTIONS = [
  ['/app/accounts/applications/new', 'Open an account'],
  ['/app/accounts/applications', 'Review applications'],
  ['/app/accounts/register', 'Active accounts'],
  ['/app/accounts/reports', 'Statements and reports'],
]

export function AccountDashboard() {
  usePageTitle('Account opening — UPSA Next Payment')
  const summary = useLoad(() => api.accounts.summary())
  const data = summary.data

  return (
    <>
      <PageHeading
        kicker="Account opening"
        title="One file for every school, parent, student, teacher, and supplier."
        lead="The application links to the school, guardian, student, or registration that already exists. KYC, duplicate checks, approval, and activation stay on that file."
        icon="user"
      />
      {summary.error && <Banner>{summary.error}</Banner>}
      <div className="app-stats">
        <Stat icon="user" label="Applications in review" value={String(data?.pending ?? '—')} />
        <Stat icon="shield" label="Approved" value={String(data?.approved ?? '—')} />
        <Stat icon="school" label="Active" value={String(data?.active ?? '—')} />
        <Stat icon="report" label="Suspended" value={String(data?.suspended ?? '—')} />
        <Stat icon="ledger" label="Dormant" value={String(data?.dormant ?? '—')} />
        <Stat icon="pay" label="Closed" value={String(data?.closed ?? '—')} />
        <Stat icon="school" label="Schools" value={String(data?.school ?? '—')} />
        <Stat icon="family" label="Parents" value={String(data?.parent ?? '—')} />
        <Stat icon="user" label="Students" value={String(data?.student ?? '—')} />
        <Stat icon="shield" label="Teachers" value={String(data?.teacher ?? '—')} />
        <Stat icon="ledger" label="Suppliers" value={String(data?.supplier ?? '—')} />
      </div>
      <Panel icon="user" title="Quick actions">
        <div className="app-kind-grid">
          {ACTIONS.map(([to, label]) => (
            <Link key={to} className="app-kind-card" to={to}>
              <b>{label}</b>
              <span>Open this step in account opening.</span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  )
}
