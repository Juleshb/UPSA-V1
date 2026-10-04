import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { PageHeading, Panel, Stat } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'

export function EscrowDashboard() {
  usePageTitle('40/60 escrow — UPSA Next Payment')
  const data = useLoad(() => api.escrow.summary())
  const summary = data.data
  return (
    <>
      <PageHeading
        kicker="40/60 escrow"
        title="Escrow, collateral and guarantee stay separate."
        lead="Member contributions, the restricted financing component, group collateral and the guarantee commitment are different control records. Cash moves through the payment service."
        icon="shield"
        actions={<Link className="button primary" to="/app/escrow/accounts/new">Open escrow account</Link>}
      />
      {data.error && <p className="form-error">{data.error}</p>}
      {summary && (
        <>
          <div className="app-stats">
            <Stat label="Escrow accounts" value={String(summary.accounts.total)} hint={`${summary.accounts.active} active · ${summary.accounts.pending} pending`} icon="ledger" />
            <Stat label="Escrow balance" value={money(summary.balances.total)} hint={`Available ${money(summary.balances.available)}`} />
            <Stat label="Restricted component" value={money(summary.balances.restricted)} hint="Financing component, not a loan" />
            <Stat label="Frozen" value={money(summary.balances.frozen)} hint={`Pending release ${money(summary.balances.pendingRelease)}`} />
            <Stat label="Member component" value={money(summary.balances.member)} hint="Not treated as lender collateral" />
            <Stat label="Eligible collateral" value={money(summary.exposure.collateral)} hint="Escrow cash is not counted again" />
            <Stat label="Guarantee exposure" value={money(summary.exposure.guarantee)} hint={`Claims ${money(summary.exposure.claims)}`} />
            <Stat label="Loan outstanding" value={money(summary.exposure.loans)} hint={`Recoveries ${money(summary.exposure.recoveries)}`} />
          </div>
          <Panel title="Scope" wide>
            <p>{summary.scope}</p>
          </Panel>
          <Panel title="Assumptions" wide>
            <ul className="app-list">
              {summary.assumptions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Panel>
          <Panel title="Roles and permission boundaries" wide>
            {summary.roles.map((item) => (
              <p key={item.role}><b>{item.role}.</b> {item.boundary}</p>
            ))}
          </Panel>
        </>
      )}
    </>
  )
}
