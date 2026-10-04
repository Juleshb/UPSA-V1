import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, PageHeading, Panel, SearchField, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Options, onSubmit, useAction } from '../donations/kit'
import { amount, rows, text, today } from './catalog'

export function PositionList() {
  usePageTitle('Investments — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const list = useLoad(() => api.investments.positions({ q: query || undefined, status: status || undefined }), [query, status])

  return (
    <>
      <PageHeading kicker="Investments" title="Investment positions" lead="Each approved application becomes one position. The agreement, contributions, returns, exits, and the ledger live on that position." icon="ledger" />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="search" title="All investments">
        <div className="app-inline-actions">
          <SearchField value={query} onChange={setQuery} placeholder="Member or opportunity…" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Investment status">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="MATURED">Matured</option>
            <option value="UPCOMING">Upcoming maturity</option>
            {['APPROVED', 'AGREEMENT_SIGNED', 'FUNDING', 'WITHDRAWAL_REQUESTED', 'REDEEMED', 'SETTLED', 'CLOSED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        {list.loading ? <p className="app-empty">Loading investments…</p> : (
          <Table
            columns={['Investment', 'Member', 'Opportunity', 'Value', 'Maturity', 'Status']}
            empty="No investments match that search."
            rows={(list.data?.items ?? []).map((item) => [
              <Link key={text(item.id)} to={`/app/investments/positions/${text(item.id)}`}>{text(item.id)}</Link>,
              text(item.member),
              text(item.opportunity),
              money(amount(item.currentValue), text(item.currency) || 'RWF'),
              text(item.maturityDate),
              <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function PositionFile() {
  usePageTitle('Investment — UPSA Next Payment')
  const { positionId = '' } = useParams()
  const { can } = useAuth()
  const file = useLoad(() => api.investments.position(positionId), [positionId])
  const peers = useLoad(() => api.investments.positions())
  const opportunities = useLoad(() => api.investments.opportunities({ status: 'OPEN' }))
  const { error, busy, run } = useAction()
  const data = file.data
  const write = can('investment.write')
  const status = text(data?.status)
  const currency = text(data?.currency) || 'RWF'
  const contributions = rows(data?.contributions)
  const payouts = rows(data?.payouts)
  const exits = rows(data?.exits)
  const ledger = rows(data?.ledger)
  const fundable = ['AGREEMENT_SIGNED', 'FUNDING', 'ACTIVE'].includes(status)

  function refresh(next: Record<string, unknown>) {
    file.setData(next)
  }

  return (
    <>
      <PageHeading
        kicker={text(data?.id) || 'Investment'}
        title={text(data?.member) || 'Investment'}
        lead={data ? `${text(data.opportunity)} · approved ${money(amount(data.amount), currency)} · value ${money(amount(data.currentValue), currency)}` : ''}
        icon="ledger"
        actions={data ? <StatusPill value={status} /> : undefined}
      />
      {(file.error || error) && <Banner>{file.error || error}</Banner>}
      {data && (
        <>
          <Panel icon="report" title="Agreement">
            <Table
              columns={['Field', 'Value']}
              empty="No agreement."
              rows={[
                ['Member', `${text(data.member)} · ${text(data.memberNumber)}`],
                ['Amount', money(amount(data.amount), currency)],
                ['Return', `${amount(data.returnRate)}% ${text(data.returnFrequency).replaceAll('_', ' ')}`],
                ['Start', text(data.startDate)],
                ['Maturity', text(data.maturityDate)],
                ['Accepted by', text(data.acceptedBy) || 'Pending'],
                ['Version', text(data.agreementVersion) || '—'],
              ]}
            />
            {write && status === 'APPROVED' && (
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => refresh(await api.investments.acceptAgreement(positionId, { representative: String(body.get('representative') ?? ''), version: String(body.get('version') ?? '') || undefined })))
              })}>
                <Field label="Representative" note="required"><input name="representative" required /></Field>
                <Field label="Agreement version" note="optional"><input name="version" defaultValue="1" /></Field>
                <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Accept agreement</button></div>
              </form>
            )}
          </Panel>
          {write && fundable && (
            <Panel icon="pay" title="Contribution">
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  refresh(await api.investments.contribute(positionId, {
                    amount: Number(body.get('amount')),
                    contributionDate: String(body.get('contributionDate') ?? ''),
                    paymentMethod: String(body.get('paymentMethod') ?? ''),
                    bank: String(body.get('bank') ?? '') || undefined,
                    accountReference: String(body.get('accountReference') ?? '') || undefined,
                  }))
                  event.currentTarget.reset()
                })
              })}>
                <Field label="Amount" note="required"><input name="amount" type="number" min="1" step="0.01" required /></Field>
                <Field label="Date" note="required"><input name="contributionDate" type="date" required defaultValue={today()} /></Field>
                <Field label="Method" note="required">
                  <select name="paymentMethod" required><Options options={['BANK_TRANSFER', 'MOBILE_PAYMENT', 'CASH', 'OTHER']} /></select>
                </Field>
                <Field label="Bank" note="optional"><input name="bank" /></Field>
                <Field label="Account reference" note="optional"><input name="accountReference" /></Field>
                <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Record contribution</button></div>
              </form>
            </Panel>
          )}
          {contributions.length > 0 && (
            <Panel icon="pay" title="Payments and allocation">
              <Table
                columns={['Reference', 'Amount', 'Received', 'Method', 'Reconciliation', 'Units', 'Status']}
                empty="No contributions."
                rows={contributions.map((item) => [
                  text(item.id),
                  money(amount(item.amount), text(item.currency) || currency),
                  item.receivedAmount == null ? '—' : money(amount(item.receivedAmount), currency),
                  text(item.paymentMethod).replaceAll('_', ' '),
                  text(item.reconciliationStatus),
                  item.allocatedUnits == null ? '—' : String(amount(item.allocatedUnits)),
                  text(item.status),
                ])}
              />
              {write && contributions.filter((item) => item.status === 'INITIATED' || item.status === 'PENDING').map((item) => (
                <form key={text(item.id)} className="app-form" onSubmit={onSubmit((event) => {
                  const body = new FormData(event.currentTarget)
                  void run(async () => refresh(await api.investments.confirmContribution(positionId, text(item.id), {
                    outcome: String(body.get('outcome') ?? 'SUCCESS') as 'SUCCESS' | 'FAILED',
                    externalTransactionId: String(body.get('externalTransactionId') ?? '') || undefined,
                    receivedAmount: body.get('receivedAmount') ? Number(body.get('receivedAmount')) : undefined,
                  })))
                })}>
                  <Field label={`Confirm ${text(item.id)}`} note="required">
                    <select name="outcome" required><option value="SUCCESS">Matched</option><option value="FAILED">Failed</option></select>
                  </Field>
                  <Field label="External transaction" note="required"><input name="externalTransactionId" required /></Field>
                  <Field label="Received amount" note="optional"><input name="receivedAmount" type="number" min="0" step="0.01" defaultValue={amount(item.amount)} /></Field>
                  <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Confirm payment</button></div>
                </form>
              ))}
            </Panel>
          )}
          {write && (status === 'ACTIVE' || status === 'MATURED') && (
            <Panel icon="report" title="Return">
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  refresh(await api.investments.recordReturn(positionId, {
                    period: String(body.get('period') ?? ''),
                    tax: body.get('tax') ? Number(body.get('tax')) : undefined,
                    paymentDate: String(body.get('paymentDate') ?? '') || undefined,
                    reviewedBy: String(body.get('reviewedBy') ?? ''),
                  }))
                  event.currentTarget.reset()
                })
              })}>
                <Field label="Period" note="required"><input name="period" required placeholder="2026" /></Field>
                <Field label="Tax" note="optional"><input name="tax" type="number" min="0" step="0.01" /></Field>
                <Field label="Payment date" note="optional"><input name="paymentDate" type="date" defaultValue={today()} /></Field>
                <Field label="Reviewed by" note="required" hint="A different officer from the one calculating this return."><input name="reviewedBy" required /></Field>
                <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Calculate return</button></div>
              </form>
            </Panel>
          )}
          {payouts.length > 0 && (
            <Panel icon="pay" title="Returns and dividends">
              <Table
                columns={['Payout', 'Kind', 'Period', 'Gross', 'Net', 'Status']}
                empty="No payouts."
                rows={payouts.map((item) => [text(item.id), text(item.kind), text(item.period), money(amount(item.gross), currency), money(amount(item.net), currency), text(item.status)])}
              />
              {write && payouts.filter((item) => item.status === 'CALCULATED').map((item) => (
                <button key={text(item.id)} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => refresh(await api.investments.approveReturn(positionId, text(item.id))))}>
                  Approve {text(item.id)}
                </button>
              ))}
            </Panel>
          )}
          {write && ['ACTIVE', 'MATURED', 'WITHDRAWAL_REQUESTED'].includes(status) && (
            <Panel icon="ledger" title="Withdrawal, redemption, or refund">
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  refresh(await api.investments.requestExit(positionId, {
                    kind: String(body.get('kind') ?? ''),
                    redemptionType: String(body.get('redemptionType') ?? '') || undefined,
                    amount: Number(body.get('amount')),
                    reason: String(body.get('reason') ?? ''),
                    requestDate: String(body.get('requestDate') ?? ''),
                    bankAccount: String(body.get('bankAccount') ?? '') || undefined,
                    destination: String(body.get('destination') ?? ''),
                    originalReference: String(body.get('originalReference') ?? '') || undefined,
                  }))
                })
              })}>
                <Field label="Kind" note="required">
                  <select name="kind" required><Options options={['WITHDRAWAL', 'REDEMPTION', 'REFUND']} /></select>
                </Field>
                <Field label="Redemption type" note="optional">
                  <select name="redemptionType"><option value="">Not a redemption</option><Options options={['FULL', 'PARTIAL', 'MATURITY', 'EARLY']} /></select>
                </Field>
                <Field label="Amount" note="required"><input name="amount" type="number" min="1" step="0.01" required /></Field>
                <Field label="Request date" note="required"><input name="requestDate" type="date" required defaultValue={today()} /></Field>
                <Field label="Destination" note="required"><input name="destination" required /></Field>
                <Field label="Bank account" note="optional"><input name="bankAccount" /></Field>
                <Field label="Original transaction" note="optional"><input name="originalReference" /></Field>
                <Field label="Reason" span="full" note="required"><textarea name="reason" required /></Field>
                <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Request exit</button></div>
              </form>
            </Panel>
          )}
          {exits.length > 0 && (
            <Panel icon="ledger" title="Exit decisions">
              <Table
                columns={['Exit', 'Kind', 'Amount', 'Net', 'Decision', 'Status']}
                empty="No exits."
                rows={exits.map((item) => [text(item.id), text(item.kind), money(amount(item.amount), currency), money(amount(item.net), currency), text(item.decision) || '—', text(item.status)])}
              />
              {write && exits.filter((item) => item.status === 'REQUESTED').map((item) => (
                <form key={text(item.id)} className="app-form" onSubmit={onSubmit((event) => {
                  const body = new FormData(event.currentTarget)
                  void run(async () => refresh(await api.investments.decideExit(positionId, text(item.id), { decision: String(body.get('decision') ?? ''), comments: String(body.get('comments') ?? '') || undefined })))
                })}>
                  <Field label={`Decision for ${text(item.id)}`} note="required">
                    <select name="decision" required><Options options={['APPROVE', 'PARTIAL', 'REJECT', 'MORE_INFORMATION']} /></select>
                  </Field>
                  <Field label="Comments" note="optional"><input name="comments" /></Field>
                  <div className="student-actions"><button className="button secondary" type="submit" disabled={busy}>Save decision</button></div>
                </form>
              ))}
              {write && exits.filter((item) => item.status === 'APPROVED').map((item) => (
                <button key={text(item.id)} className="button primary" type="button" disabled={busy} onClick={() => void run(async () => refresh(await api.investments.payExit(positionId, text(item.id))))}>
                  Pay {text(item.id)}
                </button>
              ))}
            </Panel>
          )}
          {write && (status === 'ACTIVE' || status === 'MATURED') && (
            <Panel icon="school" title="Transfer and maturity">
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  await api.investments.transfer(positionId, {
                    toPositionId: String(body.get('toPositionId') ?? ''),
                    amount: Number(body.get('amount')),
                    fees: body.get('fees') ? Number(body.get('fees')) : undefined,
                    reason: String(body.get('reason') ?? ''),
                    transferDate: String(body.get('transferDate') ?? ''),
                  })
                  event.currentTarget.reset()
                })
              })}>
                <Field label="Transferee investment" note="required">
                  <select name="toPositionId" required>
                    <option value="">Same opportunity</option>
                    {(peers.data?.items ?? []).filter((item) => text(item.opportunityId) === text(data.opportunityId) && text(item.id) !== positionId).map((item) => (
                      <option key={text(item.id)} value={text(item.id)}>{text(item.id)} · {text(item.member)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Amount" note="required"><input name="amount" type="number" min="1" step="0.01" required /></Field>
                <Field label="Fees" note="optional"><input name="fees" type="number" min="0" step="0.01" /></Field>
                <Field label="Date" note="required"><input name="transferDate" type="date" required defaultValue={today()} /></Field>
                <Field label="Reason" span="full" note="required"><textarea name="reason" required /></Field>
                <div className="student-actions"><button className="button secondary" type="submit" disabled={busy}>Request transfer</button></div>
              </form>
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  const instruction = String(body.get('instruction') ?? '')
                  refresh(await api.investments.maturity(positionId, {
                    instruction,
                    reinvestAmount: body.get('reinvestAmount') ? Number(body.get('reinvestAmount')) : undefined,
                    opportunityId: String(body.get('opportunityId') ?? '') || undefined,
                  }))
                })
              })}>
                <Field label="Maturity instruction" note="required">
                  <select name="instruction" required><Options options={['REDEEM', 'REINVEST', 'PARTIAL']} /></select>
                </Field>
                <Field label="Reinvest into" note="optional">
                  <select name="opportunityId">
                    <option value="">Current opportunity</option>
                    {(opportunities.data?.items ?? []).map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}
                  </select>
                </Field>
                <Field label="Partial amount" note="optional"><input name="reinvestAmount" type="number" min="1" step="0.01" /></Field>
                <div className="student-actions"><button className="button secondary" type="submit" disabled={busy}>Save instruction</button></div>
              </form>
            </Panel>
          )}
          {write && status !== 'CLOSED' && (
            <Panel icon="report" title="Adjustment and closure">
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => refresh(await api.investments.adjust(positionId, {
                  amount: Number(body.get('amount')),
                  adjustmentType: String(body.get('adjustmentType') ?? ''),
                  reason: String(body.get('reason') ?? ''),
                  documentName: String(body.get('documentName') ?? '') || undefined,
                })))
              })}>
                <Field label="Adjustment amount" note="required" hint="Use a negative amount to reduce the balance."><input name="amount" type="number" step="0.01" required /></Field>
                <Field label="Type" note="required"><input name="adjustmentType" required placeholder="CORRECTION" /></Field>
                <Field label="Document" note="optional"><input name="documentName" /></Field>
                <Field label="Reason" span="full" note="required"><textarea name="reason" required /></Field>
                <div className="student-actions"><button className="button secondary" type="submit" disabled={busy}>Post adjustment</button></div>
              </form>
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => refresh(await api.investments.close(positionId, {
                  reason: String(body.get('reason') ?? ''),
                  obligationsSettled: body.get('obligationsSettled') === 'on',
                  statementGenerated: body.get('statementGenerated') === 'on',
                  noBalance: body.get('noBalance') === 'on',
                })))
              })}>
                <label className="app-check"><input type="checkbox" name="obligationsSettled" /><span>Obligations are settled.</span></label>
                <label className="app-check"><input type="checkbox" name="statementGenerated" /><span>The final statement is generated.</span></label>
                <label className="app-check"><input type="checkbox" name="noBalance" /><span>The balance is zero.</span></label>
                <Field label="Closure reason" span="full" note="required"><textarea name="reason" required /></Field>
                <div className="student-actions"><button className="button secondary" type="submit" disabled={busy}>Close investment</button></div>
              </form>
            </Panel>
          )}
          <Panel icon="ledger" title="Ledger">
            <Table
              columns={['Date', 'Type', 'Description', 'Amount', 'Reference']}
              empty="No ledger entries yet."
              rows={ledger.map((item) => [text(item.date).slice(0, 10), text(item.type), text(item.description), money(amount(item.amount), text(item.currency) || currency), text(item.reference)])}
            />
          </Panel>
        </>
      )}
    </>
  )
}
