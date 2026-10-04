import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, PageHeading, Panel, Stat, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Options, onSubmit, useAction } from '../donations/kit'
import { amount, text } from './catalog'

const REPORTS = [
  ['all', 'All investments'],
  ['active', 'Active'],
  ['matured', 'Matured'],
  ['upcoming', 'Upcoming maturity'],
  ['by-type', 'By type'],
  ['by-sector', 'By sector'],
  ['by-location', 'By location'],
  ['performance', 'Performance'],
]

export function ReportBoard() {
  usePageTitle('Investment reports — UPSA Next Payment')
  const [type, setType] = useState('all')
  const report = useLoad(() => api.investments.report(type), [type])
  const members = useLoad(() => api.investments.members())
  const [filters, setFilters] = useState({ memberId: '', positionId: '', from: '', to: '', entryType: '' })
  const [applied, setApplied] = useState(filters)
  const statement = useLoad(() => api.investments.statement({
    memberId: applied.memberId || undefined,
    positionId: applied.positionId || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
    entryType: applied.entryType || undefined,
  }), [applied])
  const summary = statement.data
  const lines = Array.isArray(summary?.lines) ? summary.lines as Record<string, unknown>[] : []
  const items = report.data?.items ?? []
  const grouped = items[0] && 'name' in items[0]

  return (
    <>
      <PageHeading kicker="Reports" title="Statements and investment reports" lead="The statement is the ledger: opening balance, contributions, returns, fees, withdrawals, adjustments, and transfers." icon="report" />
      {(report.error || statement.error) && <Banner>{report.error || statement.error}</Banner>}
      <Panel icon="search" title="Member statement">
        <form className="app-form" onSubmit={onSubmit(() => setApplied(filters))}>
          <Field label="Member" note="optional">
            <select value={filters.memberId} onChange={(event) => setFilters({ ...filters, memberId: event.target.value })}>
              <option value="">All members</option>
              {(members.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Investment" note="optional"><input value={filters.positionId} onChange={(event) => setFilters({ ...filters, positionId: event.target.value })} placeholder="RUPSA-IVT-000001" /></Field>
          <Field label="From" note="optional"><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></Field>
          <Field label="To" note="optional"><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></Field>
          <Field label="Transaction type" note="optional">
            <select value={filters.entryType} onChange={(event) => setFilters({ ...filters, entryType: event.target.value })}>
              <option value="">All types</option>
              <Options options={['CONTRIBUTION', 'RETURN', 'DIVIDEND', 'FEE', 'WITHDRAWAL', 'REDEMPTION', 'REFUND', 'ADJUSTMENT', 'TRANSFER']} />
            </select>
          </Field>
          <div className="student-actions"><button className="button primary" type="submit">Apply filters</button></div>
        </form>
        {summary && (
          <div className="app-stats">
            <Stat icon="ledger" label="Opening" value={money(amount(summary.openingBalance))} />
            <Stat icon="pay" label="Contributions" value={money(amount(summary.contributions))} />
            <Stat icon="report" label="Returns" value={money(amount(summary.returns))} />
            <Stat icon="shield" label="Fees" value={money(amount(summary.fees))} />
            <Stat icon="ledger" label="Withdrawals" value={money(amount(summary.withdrawals))} />
            <Stat icon="pay" label="Closing" value={money(amount(summary.closingBalance))} />
          </div>
        )}
        <Table
          columns={['Date', 'Investment', 'Member', 'Type', 'Description', 'Amount', 'Reference']}
          empty="No ledger lines match those filters."
          rows={lines.map((item) => [text(item.date).slice(0, 10), text(item.investmentId), text(item.member), text(item.type), text(item.description), money(amount(item.amount), text(item.currency) || 'RWF'), text(item.reference)])}
        />
      </Panel>
      <Panel icon="report" title="Reports">
        <Field label="Report" note="required">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {grouped ? (
          <Table columns={['Group', 'Value']} empty="No grouped results." rows={items.map((item) => [text(item.name), money(amount(item.value))])} />
        ) : (
          <Table
            columns={['Record', 'Detail', 'Value', 'Status']}
            empty="No rows in this report."
            rows={items.map((item) => [text(item.id || item.investment), text(item.member || item.opportunity), money(amount(item.value ?? item.contributed)), text(item.status || item.maturity)])}
          />
        )}
      </Panel>
    </>
  )
}

export function MessageBoard() {
  usePageTitle('Investment notifications — UPSA Next Payment')
  const { can } = useAuth()
  const list = useLoad(() => api.investments.messages())
  const positions = useLoad(() => api.investments.positions())
  const { error, busy, run } = useAction()

  return (
    <>
      <PageHeading kicker="Notifications" title="Investment notifications" lead="Messages queue through the platform notification service. Channels are SMS, email, in-app, and push." icon="user" />
      {(list.error || error) && <Banner>{list.error || error}</Banner>}
      {can('investment.write') && (
        <Panel icon="user" title="Send a notice">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const body = new FormData(event.currentTarget)
            void run(async () => {
              await api.investments.sendMessage({
                positionId: String(body.get('positionId') ?? '') || undefined,
                kind: String(body.get('kind') ?? ''),
                channel: String(body.get('channel') ?? ''),
                subject: String(body.get('subject') ?? ''),
                message: String(body.get('message') ?? ''),
              })
              event.currentTarget.reset()
              list.reload()
            })
          })}>
            <Field label="Investment" note="optional">
              <select name="positionId">
                <option value="">All members</option>
                {(positions.data?.items ?? []).map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.id)} · {text(item.member)}</option>)}
              </select>
            </Field>
            <Field label="Kind" note="required"><input name="kind" required placeholder="RETURN_PAID" /></Field>
            <Field label="Channel" note="required">
              <select name="channel" required><Options options={['IN_APP', 'EMAIL', 'SMS', 'PUSH']} /></select>
            </Field>
            <Field label="Subject" note="required"><input name="subject" required /></Field>
            <Field label="Message" span="full" note="required"><textarea name="message" required /></Field>
            <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Queue notice</button></div>
          </form>
        </Panel>
      )}
      <Panel icon="report" title="Sent notices">
        <Table
          columns={['Notice', 'Member', 'Kind', 'Channel', 'Subject', 'Status']}
          empty="No notices yet."
          rows={(list.data?.items ?? []).map((item) => [text(item.id), text(item.member), text(item.kind), text(item.channel), text(item.subject), text(item.status)])}
        />
      </Panel>
    </>
  )
}

export function AuditBoard() {
  usePageTitle('Investment audit — UPSA Next Payment')
  const list = useLoad(() => api.investments.audit())
  return (
    <>
      <PageHeading kicker="Audit" title="Investment audit log" lead="Each status change records the officer, the previous and new status, the amount, and the request reference." icon="shield" />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="shield" title="Events">
        <Table
          columns={['When', 'Action', 'Investment', 'From', 'To', 'Amount', 'Officer', 'Reason', 'Reference']}
          empty="No investment events yet."
          rows={(list.data?.items ?? []).map((item) => [
            text(item.createdAt).slice(0, 16).replace('T', ' '),
            text(item.action),
            text(item.investmentId) || '—',
            text(item.previousStatus) || '—',
            text(item.newStatus) || '—',
            item.amount == null ? '—' : money(amount(item.amount)),
            text(item.userId) || '—',
            text(item.reason) || '—',
            text(item.reference) || '—',
          ])}
        />
      </Panel>
    </>
  )
}
