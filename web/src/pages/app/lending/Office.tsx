import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { useAuth } from '../../../platform/AuthContext'
import { Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { onSubmit, useAction } from '../donations/kit'
import { CUSTOMER_TYPES, checked, num, readable, str } from './catalog'

const REPORTS = [
  ['portfolio', 'Loan portfolio'],
  ['active', 'Active loans'],
  ['outstanding', 'Outstanding loans'],
  ['applications', 'Applications'],
  ['approvals', 'Approvals'],
  ['declines', 'Declines'],
  ['repayments', 'Repayments'],
  ['overdue', 'Overdue loans'],
  ['restructured', 'Restructured loans'],
  ['settled', 'Settled loans'],
  ['par', 'Portfolio at risk'],
  ['concentration', 'Concentration'],
] as const

export function ProductBoard() {
  usePageTitle('Lending products — UPSA Next Payment')
  const data = useLoad(() => api.lending.products())
  const action = useAction()
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Products" title="Lending products" lead="Working capital, development, equipment, fees, supplier, invoice, purchase-order, asset, emergency, bridge, investment, and guarantee-backed loans." icon="loan" />
      {data.error && <p className="form-error">{data.error}</p>}
      <div className="app-kind-grid">
        {(data.data?.items ?? []).map((item) => (
          <article className="app-kind-card" key={item.productId}>
            <b>{item.name}</b>
            <span>{item.interestRate}% {readable(item.interestMethod)} · {item.minimumTenor}–{item.maximumTenor} months</span>
            <span>{money(item.minimumAmount, item.currency)} – {money(item.maximumAmount, item.currency)}</span>
            <span>{item.guaranteeRequired ? 'Guarantee required' : 'Guarantee optional'} · {item.collateralRequired ? 'Collateral required' : 'Collateral optional'}</span>
            <StatusPill value={item.status} />
          </article>
        ))}
      </div>
      {can('loan.write') && (
        <Panel title="Add a product" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.lending.saveProduct({ code: str(form, 'code'), name: str(form, 'name'), customerType: str(form, 'customerType'), purpose: str(form, 'purpose'), interestRate: num(form, 'interestRate'), interestMethod: str(form, 'interestMethod'), minimumAmount: num(form, 'minimumAmount'), maximumAmount: num(form, 'maximumAmount'), minimumTenor: num(form, 'minimumTenor'), maximumTenor: num(form, 'maximumTenor'), graceMonths: num(form, 'graceMonths'), processingFeeRate: num(form, 'processingFeeRate'), guaranteeRequired: checked(form, 'guaranteeRequired'), collateralRequired: checked(form, 'collateralRequired') })
              data.reload()
            })
          })}>
            <Field label="Code"><input name="code" required /></Field>
            <Field label="Name"><input name="name" required /></Field>
            <Field label="Customer"><select name="customerType">{CUSTOMER_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Purpose"><input name="purpose" required /></Field>
            <Field label="Interest rate"><input name="interestRate" type="number" min="0" step="0.001" required /></Field>
            <Field label="Interest method"><select name="interestMethod"><option>DECLINING</option><option>FLAT</option></select></Field>
            <Field label="Minimum amount"><input name="minimumAmount" type="number" min="0" step="0.01" required /></Field>
            <Field label="Maximum amount"><input name="maximumAmount" type="number" min="1" step="0.01" required /></Field>
            <Field label="Minimum tenor"><input name="minimumTenor" type="number" min="1" required /></Field>
            <Field label="Maximum tenor"><input name="maximumTenor" type="number" min="1" required /></Field>
            <Field label="Grace months"><input name="graceMonths" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Processing fee percent"><input name="processingFeeRate" type="number" min="0" step="0.01" defaultValue="1" /></Field>
            <label className="app-check"><input name="guaranteeRequired" type="checkbox" /> Guarantee required</label>
            <label className="app-check"><input name="collateralRequired" type="checkbox" /> Collateral required</label>
            {action.error && <p className="form-error">{action.error}</p>}
            <button className="button primary" type="submit" disabled={action.busy}>Save product</button>
          </form>
        </Panel>
      )}
    </>
  )
}

export function LendingReportBoard() {
  usePageTitle('Lending reports — UPSA Next Payment')
  const [type, setType] = useState<string>(REPORTS[0][0])
  const data = useLoad(() => api.lending.report(type), [type])
  const items = data.data?.items ?? []
  const columns = items[0] ? Object.keys(items[0]) : ['Report']
  return (
    <>
      <PageHeading kicker="Reports" title="Lending reports" lead="Portfolio, credit decisions, repayments, arrears, and concentration." icon="report" />
      <Field label="Report"><select value={type} onChange={(event) => setType(event.target.value)}>{REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {data.error && <p className="form-error">{data.error}</p>}
      <Table columns={columns} empty="This report has no rows yet." rows={items.map((item) => columns.map((column) => String(item[column] ?? '')))} />
    </>
  )
}

export function LendingNoticeBoard() {
  usePageTitle('Lending notifications — UPSA Next Payment')
  const data = useLoad(() => api.lending.notices())
  const action = useAction()
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Notifications" title="Lending messages" lead="Application, offer, disbursement, repayment, arrears, and settlement notices stay on the file." icon="report" />
      <Table columns={['When', 'Event', 'Subject', 'Status']} empty="No notice yet." rows={(data.data?.items ?? []).map((item) => [item.createdAt.slice(0, 16), item.event, item.subject, item.status])} />
      {can('loan.write') && (
        <Panel title="Queue a notice" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.lending.sendNotice({ event: str(form, 'event'), channel: 'IN_APP', subject: str(form, 'subject'), body: str(form, 'body') })
              data.reload()
            })
          })}>
            <Field label="Event"><input name="event" defaultValue="LOAN_MESSAGE" required /></Field>
            <Field label="Subject"><input name="subject" required /></Field>
            <Field label="Message"><textarea name="body" required /></Field>
            {action.error && <p className="form-error">{action.error}</p>}
            <button className="button primary" type="submit" disabled={action.busy}>Queue notice</button>
          </form>
        </Panel>
      )}
    </>
  )
}

export function LendingAuditBoard() {
  usePageTitle('Lending audit — UPSA Next Payment')
  const data = useLoad(() => api.lending.audit())
  return (
    <>
      <PageHeading kicker="Audit" title="Lending actions" lead="Each application, recommendation, institution decision, disbursement, and repayment keeps the officer, the previous status, and the new status." icon="report" />
      {data.error && <p className="form-error">{data.error}</p>}
      <Table columns={['When', 'Action', 'Reference', 'From', 'To', 'Officer']} empty="No lending action is recorded yet." rows={(data.data?.items ?? []).map((item) => [item.createdAt.slice(0, 16), item.action, item.reference ?? '—', item.previousStatus ?? '—', item.newStatus ?? '—', item.userId ?? '—'])} />
    </>
  )
}
