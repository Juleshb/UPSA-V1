import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Banner, PageHeading, Panel, Stat } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'

const ACTIONS = [
  ['/app/investments/opportunities/new', 'New opportunity'],
  ['/app/investments/applications/new', 'New application'],
  ['/app/investments/positions', 'Record a contribution'],
  ['/app/investments/applications', 'Approve an application'],
  ['/app/investments/returns', 'Record a return'],
  ['/app/investments/exits', 'Process an exit'],
  ['/app/investments/reports', 'Member statement'],
  ['/app/investments/portfolio', 'Open a portfolio'],
]

export function InvestmentDashboard() {
  usePageTitle('Investments — UPSA Next Payment')
  const summary = useLoad(() => api.investments.summary())
  const data = summary.data

  return (
    <>
      <PageHeading
        kicker="Investment"
        title="Member capital, from application to maturity."
        lead="Schools with verified membership and approved investor registrations are the members. Contributions use the payment service, then one investment ledger holds allocations, returns, dividends, fees, exits, and transfers."
        icon="ledger"
      />
      {summary.error && <Banner>{summary.error}</Banner>}
      <div className="app-stats">
        <Stat icon="ledger" label="Total portfolio" value={data ? money(data.totalPortfolio) : '—'} />
        <Stat icon="pay" label="Amount invested" value={data ? money(data.totalInvested) : '—'} />
        <Stat icon="school" label="Active investments" value={String(data?.activeInvestments ?? '—')} />
        <Stat icon="report" label="Matured" value={String(data?.maturedInvestments ?? '—')} />
        <Stat icon="user" label="Pending applications" value={String(data?.pendingApplications ?? '—')} />
        <Stat icon="shield" label="Approved" value={String(data?.approvedInvestments ?? '—')} />
        <Stat icon="loan" label="Expected returns" value={data ? money(data.expectedReturns) : '—'} />
        <Stat icon="pay" label="Realized returns" value={data ? money(data.realizedReturns) : '—'} />
        <Stat icon="report" label="Pending returns" value={data ? money(data.pendingReturns) : '—'} />
        <Stat icon="ledger" label="Withdrawals" value={data ? money(data.withdrawals) : '—'} />
        <Stat icon="school" label="Open opportunities" value={String(data?.openOpportunities ?? '—')} />
      </div>
      <Panel icon="pay" title="Quick actions">
        <div className="app-kind-grid">
          {ACTIONS.map(([to, label]) => (
            <Link key={to} className="app-kind-card" to={to}>
              <b>{label}</b>
              <span>Open this step in the investment lifecycle.</span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  )
}
