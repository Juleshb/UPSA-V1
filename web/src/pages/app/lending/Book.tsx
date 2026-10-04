import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { useAuth } from '../../../platform/AuthContext'
import { Field, PageHeading, Panel, Stat, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { onSubmit, useAction } from '../donations/kit'
import { PAYMENT_METHODS, checked, num, readable, str, today } from './catalog'

export function LoanList() {
  usePageTitle('Loan accounts — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const data = useLoad(() => api.lending.loans({ q: query, status }), [query, status])
  return (
    <>
      <PageHeading kicker="Loans" title="Loan accounts" lead="Principal, interest, fees, and penalties stay on separate lines. A repayment clears them in that order." icon="ledger" />
      <div className="app-form">
        <Field label="Search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Borrower, product, or reference" /></Field>
        <Field label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All accounts</option>
            {['OFFERED', 'CONTRACTED', 'ACTIVE', 'IN_ARREARS', 'OVERDUE', 'CURRENT', 'SETTLED', 'RECOVERY', 'DEFAULTED', 'WRITTEN_OFF'].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
          </select>
        </Field>
      </div>
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Borrower', 'Reference', 'Product', 'District', 'Outstanding', 'Past due', 'Status']}
        empty="No loan account yet."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.loanId} to={`/app/loans/book/${item.loanId}`}>{item.borrower}</Link>,
          item.loanId,
          readable(item.productCode),
          item.district,
          money(item.outstanding, item.currency),
          item.daysPastDue ? `${item.daysPastDue} days` : 'Current',
          <StatusPill key={`${item.loanId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

const LOAN_TABS = [
  ['schedule', 'Schedule'],
  ['disburse', 'Disburse'],
  ['repay', 'Repayment'],
  ['collections', 'Collections'],
  ['changes', 'Account changes'],
] as const

export function LoanFilePage() {
  usePageTitle('Loan account — UPSA Next Payment')
  const { loanId = '' } = useParams()
  const { can } = useAuth()
  const data = useLoad(() => api.lending.loan(loanId), [loanId])
  const action = useAction()
  const [tab, setTab] = useState('schedule')
  const [kind, setKind] = useState('RESTRUCTURE')
  const loan = data.data
  if (!loan) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the loan account.</p>
  const write = can('loan.write')
  const remaining = Math.max(loan.principal - loan.disbursed, 0)
  return (
    <>
      <PageHeading
        kicker="Loan account"
        title={loan.borrower}
        lead={`${readable(loan.productCode)} · ${loan.loanId}`}
        icon="ledger"
        actions={<Link className="button secondary" to={`/app/loans/applications/${loan.applicationId}`}>Application</Link>}
      />
      <div className="lend-facts">
        <StatusPill value={loan.status} />
        {loan.contractNumber && <span>Contract {loan.contractNumber}</span>}
        <span>{loan.interestRate}% · {loan.tenorMonths} months</span>
      </div>
      <div className="app-stats">
        <Stat label="Total outstanding" value={money(loan.total, loan.currency)} hint={loan.nextPaymentDate ? `Next payment ${loan.nextPaymentDate}` : 'No instalment is waiting'} icon="ledger" />
        <Stat label="Principal" value={money(loan.principalOutstanding, loan.currency)} hint={`of ${money(loan.principal, loan.currency)} approved`} />
        <Stat label="Interest" value={money(loan.interest, loan.currency)} />
        <Stat label="Fees" value={money(loan.fees, loan.currency)} />
        <Stat label="Penalties" value={money(loan.penalty, loan.currency)} hint={loan.daysPastDue ? `${loan.daysPastDue} days past due` : 'Current'} />
        <Stat label="Disbursed" value={money(loan.disbursed, loan.currency)} hint={remaining ? `${money(remaining, loan.currency)} still to send` : 'Fully disbursed'} />
      </div>
      {action.error && <p className="form-error">{action.error}</p>}
      {write && (
        <div className="lend-tabs" role="tablist">
          {LOAN_TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      )}
      {(!write || tab === 'schedule') && (
        <>
          <Panel title="Repayment schedule" wide>
            <Table
              columns={['#', 'Due', 'Principal', 'Interest', 'Fees', 'Total', 'Status']}
              empty="The schedule is created with the contract."
              rows={loan.schedule.map((item) => [String(item.number), item.dueDate ?? '—', money(item.principalDue, loan.currency), money(item.interestDue, loan.currency), money(item.feesDue, loan.currency), money(item.totalDue, loan.currency), <StatusPill key={item.number} value={item.status} />])}
            />
          </Panel>
          <Panel title="Money movement" wide>
            <Table columns={['Disbursement', 'Amount', 'Reference']} empty="Nothing has been disbursed." rows={loan.disbursements.map((item) => [item.disbursementId, money(item.amount, loan.currency), item.reference])} />
            <Table columns={['Repayment', 'Amount', 'Reference', 'Status']} empty="No repayment yet." rows={loan.repayments.map((item) => [item.repaymentId, money(item.amount, loan.currency), item.reference, <StatusPill key={item.repaymentId} value={item.status} />])} />
          </Panel>
        </>
      )}
      {write && tab === 'disburse' && (
        <Panel title="Disburse through the payment service" wide>
          <p className="lend-note">Cash leaves through the payment service. Interest and fees become due on the first disbursement, from the schedule.</p>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.lending.disburse(loanId, { amount: num(form, 'amount'), disbursementAccount: str(form, 'disbursementAccount'), paymentMethod: str(form, 'paymentMethod'), externalTransactionId: str(form, 'externalTransactionId') || undefined, disbursementDate: today() })
              data.reload()
            })
          })}>
            <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" defaultValue={String(remaining)} required /></Field>
            <Field label="Destination account"><input name="disbursementAccount" required placeholder="Account that receives the funds" /></Field>
            <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></Field>
            <Field label="External transaction ID" hint="Required for a bank, mobile, card, or PSP payment"><input name="externalTransactionId" placeholder="TX-LEN-1" /></Field>
            <button className="button primary" type="submit" disabled={action.busy || remaining <= 0}>Disburse</button>
          </form>
        </Panel>
      )}
      {write && tab === 'repay' && (
        <Panel title="Repayment" wide>
          <p className="lend-note">The payment service records the cash. This desk then applies it to fees, penalties, interest, and principal, and updates the earliest unpaid instalment.</p>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.lending.repay(loanId, { amount: num(form, 'amount'), paymentMethod: str(form, 'paymentMethod'), externalTransactionId: str(form, 'externalTransactionId') || undefined, paymentDate: today() })
              data.reload()
            })
          })}>
            <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
            <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></Field>
            <Field label="External transaction ID" hint="Required for a bank, mobile, card, or PSP payment"><input name="externalTransactionId" placeholder="TX-LEN-2" /></Field>
            <button className="button primary" type="submit" disabled={action.busy}>Record repayment</button>
          </form>
        </Panel>
      )}
      {write && tab === 'collections' && (
        <Panel title="Collections and promise to pay" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.lending.collect(loanId, { contactDate: today(), method: str(form, 'method'), person: str(form, 'person'), promiseAmount: num(form, 'promiseAmount') || undefined, promiseDate: str(form, 'promiseDate') || undefined, notes: str(form, 'notes') || undefined, status: str(form, 'status') })
              if (num(form, 'promiseAmount') > 0) await api.lending.promise(loanId, { promised: num(form, 'promiseAmount'), promiseDate: str(form, 'promiseDate') || today(), notes: str(form, 'notes') || undefined })
              data.reload()
            })
          })}>
            <Field label="Method"><select name="method">{['PHONE', 'VISIT', 'EMAIL', 'SMS'].map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></Field>
            <Field label="Contact person"><input name="person" required /></Field>
            <Field label="Promise amount" hint="optional"><input name="promiseAmount" type="number" min="0" step="0.01" /></Field>
            <Field label="Promise date" hint="optional"><input name="promiseDate" type="date" /></Field>
            <Field label="Status"><select name="status">{['OPEN', 'PROMISE_TO_PAY', 'FOLLOW_UP', 'ESCALATED', 'RESOLVED'].map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select></Field>
            <Field label="Notes" hint="optional"><input name="notes" /></Field>
            <button className="button secondary" type="submit" disabled={action.busy}>Save collection</button>
          </form>
        </Panel>
      )}
      {write && tab === 'changes' && (
        <Panel title="Restructure, holiday, top-up, or close the account" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              if (kind === 'RESTRUCTURE') await api.lending.restructure(loanId, { newTenor: num(form, 'newTenor'), frequency: 'MONTHLY', graceMonths: num(form, 'graceMonths'), reason: str(form, 'reason'), decision: 'APPROVE' })
              else if (kind === 'HOLIDAY') await api.lending.holiday(loanId, { months: num(form, 'graceMonths') || 1, reason: str(form, 'reason'), decision: 'APPROVE', startDate: today() })
              else if (kind === 'TOP_UP') await api.lending.topUp(loanId, { requested: num(form, 'amount'), purpose: str(form, 'reason'), tenorMonths: num(form, 'newTenor') || loan.tenorMonths, eligibility: 'Eligible', capacity: 'Adequate', decision: 'APPROVED' })
              else if (kind === 'RECOVERY') await api.lending.recovery(loanId, { stage: 'NOTICE', strategy: str(form, 'reason'), nextAction: 'Follow up', nextActionDate: today() })
              else if (kind === 'WRITE_OFF') await api.lending.writeOff(loanId, { reason: str(form, 'reason'), decision: 'APPROVE' })
              else await api.lending.settle(loanId, { principalSettled: checked(form, 'principalSettled'), interestSettled: checked(form, 'interestSettled'), feesSettled: checked(form, 'feesSettled'), clear: checked(form, 'clear') })
              data.reload()
            })
          })}>
            <Field label="Action">
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="RESTRUCTURE">Restructure</option>
                <option value="HOLIDAY">Payment holiday</option>
                <option value="TOP_UP">Top up</option>
                <option value="RECOVERY">Start recovery</option>
                <option value="WRITE_OFF">Write off</option>
                <option value="SETTLE">Settle</option>
              </select>
            </Field>
            {(kind === 'RESTRUCTURE' || kind === 'TOP_UP') && <Field label="Tenor in months"><input name="newTenor" type="number" min="1" defaultValue={String(loan.tenorMonths)} /></Field>}
            {(kind === 'RESTRUCTURE' || kind === 'HOLIDAY') && <Field label={kind === 'HOLIDAY' ? 'Holiday months' : 'Grace months'}><input name="graceMonths" type="number" min="0" defaultValue={kind === 'HOLIDAY' ? '1' : '0'} /></Field>}
            {kind === 'TOP_UP' && <Field label="Additional amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>}
            {kind !== 'SETTLE' && <Field label="Reason"><input name="reason" required /></Field>}
            {kind === 'SETTLE' && (
              <>
                <p className="lend-note product-hint">Settlement needs a zero balance and all four confirmations.</p>
                <label className="app-check"><input name="principalSettled" type="checkbox" /> Principal fully settled</label>
                <label className="app-check"><input name="interestSettled" type="checkbox" /> Interest fully settled</label>
                <label className="app-check"><input name="feesSettled" type="checkbox" /> Fees settled</label>
                <label className="app-check"><input name="clear" type="checkbox" /> No outstanding balance</label>
              </>
            )}
            {kind === 'WRITE_OFF' && <p className="lend-note">A write-off clears the balances and moves the loan into recovery. It is not a clean settlement.</p>}
            <button className="button secondary" type="submit" disabled={action.busy}>{kind === 'WRITE_OFF' ? 'Write off' : kind === 'SETTLE' ? 'Settle the loan' : 'Record'}</button>
          </form>
        </Panel>
      )}
    </>
  )
}
