import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { PageHeading, Stat } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'

export function MembershipDashboard() {
  usePageTitle('Membership — UPSA Next Payment')
  const data = useLoad(() => api.membershipDesk.summary())
  const summary = data.data
  return (
    <>
      <PageHeading
        kicker="Membership"
        title="From registration to an active member."
        lead="A member is an existing school, or a school created in the school register. The membership fee is collected through the payment service."
        icon="shield"
        actions={<Link className="button primary" to="/app/membership/members/new">New member</Link>}
      />
      {data.error && <p className="form-error">{data.error}</p>}
      {summary && (
        <div className="app-stats">
          <Stat label="Members" value={String(summary.total)} hint={`${summary.active} active`} icon="school" />
          <Stat label="Pending applications" value={String(summary.pending)} hint={`${summary.verification} in document review or verification`} />
          <Stat label="Suspended" value={String(summary.suspended)} />
          <Stat label="Expired" value={String(summary.expired)} />
          <Stat label="Fees due" value={money(summary.feesDue)} />
          <Stat label="Fees collected" value={money(summary.feesCollected)} hint="Recorded after the payment service accepts the payment" />
        </div>
      )}
    </>
  )
}
