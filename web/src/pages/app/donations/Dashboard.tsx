import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Banner, PageHeading, Panel, Stat } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'

const ACTIONS = [
  ['/app/donations/donors/new', 'Register donor'],
  ['/app/donations/campaigns/new', 'Create campaign'],
  ['/app/donations/pledges', 'Record pledge'],
  ['/app/donations/gifts/new', 'Receive donation'],
  ['/app/donations/allocations', 'Allocate donation'],
  ['/app/donations/beneficiaries/new', 'Register beneficiary'],
  ['/app/donations/distributions', 'Distribute donation'],
  ['/app/donations/receipts', 'Generate receipt'],
  ['/app/donations/reports', 'Generate report'],
]

export function DonationDashboard() {
  usePageTitle('Donations — UPSA Next Payment')
  const summary = useLoad(() => api.donations.summary())
  const data = summary.data

  return (
    <>
      <PageHeading
        kicker="Donation"
        title="Donations, from pledge to impact."
        lead="Donors and campaigns are verified before a gift is accepted. Money moves through the payment service, then the donation ledger, receipt, allocation, and beneficiary confirmation."
        icon="pay"
      />
      {summary.error && <Banner>{summary.error}</Banner>}
      <div className="app-stats">
        <Stat icon="pay" label="Total donations" value={data ? money(data.totalDonations) : '—'} />
        <Stat icon="ledger" label="This month" value={data ? money(data.donationsThisMonth) : '—'} />
        <Stat icon="report" label="This year" value={data ? money(data.donationsThisYear) : '—'} />
        <Stat icon="user" label="Total donors" value={String(data?.totalDonors ?? '—')} />
        <Stat icon="school" label="Active campaigns" value={String(data?.activeCampaigns ?? '—')} />
        <Stat icon="loan" label="Pending pledges" value={String(data?.pendingPledges ?? '—')} />
        <Stat icon="pay" label="Donations received" value={String(data?.donationsReceived ?? '—')} />
        <Stat icon="report" label="Donations pending" value={String(data?.donationsPending ?? '—')} />
        <Stat icon="ledger" label="Donations allocated" value={data ? money(data.allocatedAmount) : '—'} hint={data ? `${data.donationsAllocated} allocations` : undefined} />
        <Stat icon="family" label="Donations distributed" value={data ? money(data.distributedAmount) : '—'} hint={data ? `${data.donationsDistributed} deliveries` : undefined} />
        <Stat icon="shield" label="Unallocated" value={data ? money(data.unallocatedDonations) : '—'} />
        <Stat icon="report" label="Refunds" value={data ? money(data.refunds) : '—'} />
      </div>
      <Panel icon="pay" title="Quick actions">
        <div className="app-kind-grid">
          {ACTIONS.map(([to, label]) => (
            <Link key={to} className="app-kind-card" to={to}>
              <b>{label}</b>
              <span>Open this step in the donation lifecycle.</span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  )
}
