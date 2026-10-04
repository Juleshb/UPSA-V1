import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, PageHeading, Panel, Stat, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { onSubmit, useAction } from '../donations/kit'
import { amount, rows, text } from './catalog'

export function PortfolioBoard() {
  usePageTitle('Portfolio — UPSA Next Payment')
  const members = useLoad(() => api.investments.members())
  const [memberId, setMemberId] = useState('')
  const selected = (members.data?.items ?? []).find((item) => item.id === memberId)
  const portfolio = useLoad(() => memberId ? api.investments.portfolio(memberId, selected?.source) : Promise.resolve(null), [memberId, selected?.source])
  const data = portfolio.data

  return (
    <>
      <PageHeading kicker="Portfolio" title="Member portfolio" lead="The portfolio number is the member number. Totals are calculated from the investment ledger." icon="user" />
      {(members.error || portfolio.error) && <Banner>{members.error || portfolio.error}</Banner>}
      <Panel icon="search" title="Member">
        <Field label="Member" note="required">
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Select a member</option>
            {(members.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}
          </select>
        </Field>
      </Panel>
      {data && (
        <>
          <div className="app-stats">
            <Stat icon="pay" label="Invested" value={money(amount(data.totalInvested))} />
            <Stat icon="ledger" label="Current value" value={money(amount(data.currentValue))} />
            <Stat icon="report" label="Expected return" value={money(amount(data.expectedReturn))} />
            <Stat icon="pay" label="Realized return" value={money(amount(data.realizedReturn))} />
            <Stat icon="ledger" label="Withdrawals" value={money(amount(data.withdrawals))} />
            <Stat icon="shield" label="Net investment" value={money(amount(data.netInvestment))} />
          </div>
          <Panel icon="ledger" title={text(data.member)}>
            <Table
              columns={['Investment', 'Opportunity', 'Contributed', 'Value', 'Status']}
              empty="This member has no investments."
              rows={rows(data.items).map((item) => [
                <Link key={text(item.id)} to={`/app/investments/positions/${text(item.id)}`}>{text(item.id)}</Link>,
                text(item.opportunity),
                money(amount(item.contributed), text(item.currency) || 'RWF'),
                money(amount(item.currentValue), text(item.currency) || 'RWF'),
                <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
              ])}
            />
          </Panel>
        </>
      )}
    </>
  )
}

export function ReturnBoard() {
  usePageTitle('Returns — UPSA Next Payment')
  const list = useLoad(() => api.investments.payouts())
  return (
    <>
      <PageHeading kicker="Returns" title="Returns and dividends" lead="A return and a dividend share one payout record. Approval posts the gross amount and the fee to the investment ledger." icon="pay" />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="report" title="Payouts">
        {list.loading ? <p className="app-empty">Loading payouts…</p> : (
          <Table
            columns={['Payout', 'Investment', 'Member', 'Kind', 'Period', 'Net', 'Status']}
            empty="No returns or dividends yet."
            rows={(list.data?.items ?? []).map((item) => [
              text(item.id),
              <Link key={text(item.investmentId)} to={`/app/investments/positions/${text(item.investmentId)}`}>{text(item.investmentId)}</Link>,
              text(item.member),
              text(item.kind),
              text(item.period),
              money(amount(item.net)),
              <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function ExitBoard() {
  usePageTitle('Exits — UPSA Next Payment')
  const { can } = useAuth()
  const exits = useLoad(() => api.investments.exits())
  const transfers = useLoad(() => api.investments.transfers())
  const { error, busy, run } = useAction()

  return (
    <>
      <PageHeading kicker="Exits" title="Withdrawals, redemptions, refunds, and transfers" lead="A withdrawal, redemption, and refund share one exit record. A transfer moves value between two positions on the same opportunity." icon="ledger" />
      {(exits.error || transfers.error || error) && <Banner>{exits.error || transfers.error || error}</Banner>}
      <Panel icon="ledger" title="Exit requests">
        <Table
          columns={['Exit', 'Investment', 'Member', 'Kind', 'Amount', 'Net', 'Status']}
          empty="No exit requests."
          rows={(exits.data?.items ?? []).map((item) => [
            text(item.id),
            <Link key={text(item.investmentId)} to={`/app/investments/positions/${text(item.investmentId)}`}>{text(item.investmentId)}</Link>,
            text(item.member),
            text(item.kind),
            money(amount(item.amount)),
            money(amount(item.net)),
            <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
          ])}
        />
      </Panel>
      <Panel icon="user" title="Transfers">
        <Table
          columns={['Transfer', 'From', 'To', 'Amount', 'Status']}
          empty="No transfers."
          rows={(transfers.data?.items ?? []).map((item) => [text(item.id), text(item.from), text(item.to), money(amount(item.amount)), text(item.status)])}
        />
        {can('investment.write') && (transfers.data?.items ?? []).filter((item) => text(item.status) === 'REQUESTED').map((item) => (
          <form key={text(item.id)} className="app-form" onSubmit={onSubmit((event) => {
            const body = new FormData(event.currentTarget)
            void run(async () => {
              await api.investments.decideTransfer(text(item.id), { decision: String(body.get('decision') ?? 'APPROVE'), reviewedBy: String(body.get('reviewedBy') ?? '') })
              transfers.reload()
            })
          })}>
            <Field label={`Decision for ${text(item.id)}`} note="required">
              <select name="decision" required><option value="APPROVE">Approve</option><option value="REJECT">Reject</option></select>
            </Field>
            <Field label="Reviewed by" note="required" hint="A different officer from the approver."><input name="reviewedBy" required /></Field>
            <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Save transfer</button></div>
          </form>
        ))}
      </Panel>
    </>
  )
}

export function MaturityBoard() {
  usePageTitle('Maturity — UPSA Next Payment')
  const upcoming = useLoad(() => api.investments.positions({ status: 'UPCOMING' }))
  const matured = useLoad(() => api.investments.positions({ status: 'MATURED' }))

  return (
    <>
      <PageHeading kicker="Maturity" title="Upcoming and matured investments" lead="Redeem, reinvest, or reinvest part of the balance from the investment file. Reinvestment opens a new approved position and posts both ledgers." icon="report" />
      {(upcoming.error || matured.error) && <Banner>{upcoming.error || matured.error}</Banner>}
      <Panel icon="report" title="Approaching maturity">
        <Table
          columns={['Investment', 'Member', 'Opportunity', 'Maturity', 'Value']}
          empty="No investments mature in the next 90 days."
          rows={(upcoming.data?.items ?? []).map((item) => [
            <Link key={text(item.id)} to={`/app/investments/positions/${text(item.id)}`}>{text(item.id)}</Link>,
            text(item.member),
            text(item.opportunity),
            text(item.maturityDate),
            money(amount(item.currentValue), text(item.currency) || 'RWF'),
          ])}
        />
      </Panel>
      <Panel icon="ledger" title="Matured">
        <Table
          columns={['Investment', 'Member', 'Opportunity', 'Maturity', 'Value', 'Status']}
          empty="No matured investments."
          rows={(matured.data?.items ?? []).map((item) => [
            <Link key={text(item.id)} to={`/app/investments/positions/${text(item.id)}`}>{text(item.id)}</Link>,
            text(item.member),
            text(item.opportunity),
            text(item.maturityDate),
            money(amount(item.currentValue), text(item.currency) || 'RWF'),
            <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
          ])}
        />
      </Panel>
    </>
  )
}
