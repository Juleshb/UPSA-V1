import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { PageHeading, Panel, Stat, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'

export function LendingDashboard() {
  usePageTitle('Lending — UPSA Next Payment')
  const data = useLoad(() => api.lending.summary())
  const applications = useLoad(() => api.lending.applications())
  const loans = useLoad(() => api.lending.loans())
  const summary = data.data
  return (
    <>
      <PageHeading
        kicker="Lending"
        title="Originate, assess, and administer. The institution decides."
        lead="UPSA Next keeps the application, the recommendation, the offer, the contract, and the repayment book. The licensed institution remains responsible for the credit decision."
        icon="loan"
        actions={<Link className="button primary" to="/app/loans/applications/new">New application</Link>}
      />
      {data.error && <p className="form-error">{data.error}</p>}
      {summary && (
        <div className="app-stats">
          <Stat label="Applications" value={String(summary.applications)} hint={`${summary.pending} still in review`} icon="loan" />
          <Stat label="Under assessment" value={String(summary.assessment)} />
          <Stat label="Approved" value={String(summary.approved)} hint={`${summary.declined} declined`} />
          <Stat label="Active loans" value={String(summary.active)} hint={`${summary.overdue} overdue · ${summary.recovery} in recovery`} icon="ledger" />
          <Stat label="Disbursed" value={money(summary.disbursed)} />
          <Stat label="Outstanding" value={money(summary.outstanding)} hint={`Principal ${money(summary.principal)} · interest ${money(summary.interest)} · fees ${money(summary.fees)}`} />
          <Stat label="Settled" value={String(summary.settled)} />
          <Stat label="Guarantee-backed" value={String(summary.guaranteed)} hint={`${summary.defaulted} in default or written off`} />
        </div>
      )}
      <div className="app-grid">
        <Panel title="Latest applications" action={<Link to="/app/loans/applications">Open register</Link>} icon="loan">
          <Table
            columns={['Applicant', 'Requested', 'Status']}
            empty="No lending application yet."
            rows={(applications.data?.items ?? []).slice(0, 6).map((item) => [
              <Link key={item.applicationId} to={`/app/loans/applications/${item.applicationId}`}>{item.applicant}</Link>,
              money(item.requestedAmount, item.currency),
              <StatusPill key={`${item.applicationId}-status`} value={item.status} />,
            ])}
          />
        </Panel>
        <Panel title="Loan book" action={<Link to="/app/loans/book">Open accounts</Link>} icon="ledger">
          <Table
            columns={['Borrower', 'Outstanding', 'Status']}
            empty="No loan account yet."
            rows={(loans.data?.items ?? []).slice(0, 6).map((item) => [
              <Link key={item.loanId} to={`/app/loans/book/${item.loanId}`}>{item.borrower}</Link>,
              money(item.outstanding, item.currency),
              <StatusPill key={`${item.loanId}-status`} value={item.status} />,
            ])}
          />
        </Panel>
      </div>
      <p className="lend-note">A repayment is applied to fees, then penalties, then interest, then principal. The product sets the amount and tenor. The institution still makes the credit decision.</p>
    </>
  )
}
