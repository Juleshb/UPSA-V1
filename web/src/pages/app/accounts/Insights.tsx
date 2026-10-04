import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { useAuth } from '../../../platform/AuthContext'
import { Banner, Field, PageHeading, Panel, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Options, onSubmit, useAction } from '../donations/kit'
import { label } from './catalog'

const REPORTS = [
  ['applications', 'Applications'],
  ['active', 'Active accounts'],
  ['suspended', 'Suspended and dormant'],
  ['closed', 'Closed'],
  ['rejected', 'Rejected'],
  ['duplicates', 'Duplicate matches'],
  ['by-type', 'By account type'],
]

export function AccountReportBoard() {
  usePageTitle('Account reports — UPSA Next Payment')
  const [type, setType] = useState('applications')
  const [accountId, setAccountId] = useState('')
  const [requested, setRequested] = useState('')
  const report = useLoad(() => api.accounts.report(type), [type])
  const statement = useLoad(() => requested ? api.accounts.statement(requested) : Promise.resolve(null), [requested])
  const items = report.data?.items ?? []
  const grouped = type === 'by-type'

  return (
    <>
      <PageHeading kicker="Reports" title="Account reports and statements" lead="A statement reads the invoices and student balance already held for the linked school or student." icon="report" />
      {(report.error || statement.error) && <Banner>{report.error || statement.error}</Banner>}
      <Panel icon="search" title="Account statement">
        <form className="app-form" onSubmit={onSubmit(() => setRequested(accountId.trim()))}>
          <Field label="Account number" note="required"><input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="RUPSA-ACC-000001" /></Field>
          <div className="student-actions"><button className="button primary" type="submit">Open statement</button></div>
        </form>
        {statement.data && (
          <Table
            columns={['Invoice', 'Description', 'Balance', 'Status']}
            empty="This account has no invoices on the linked record."
            rows={statement.data.invoices.map((item) => [item.id, item.description, String(item.balance), item.status])}
          />
        )}
      </Panel>
      <Panel icon="report" title="Reports">
        <Field label="Report" note="required">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {REPORTS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </Field>
        {grouped ? (
          <Table columns={['Account type', 'Count']} empty="No accounts yet." rows={items.map((item) => [label(String((item as { name?: string }).name ?? item.accountType)), String((item as { value?: number }).value ?? '')])} />
        ) : (
          <Table
            columns={['Account', 'Type', 'Applicant', 'Linked record', 'Status']}
            empty="No rows in this report."
            rows={items.map((item) => [
              <Link key={item.id} to={`/app/accounts/applications/${item.id}`}>{item.id}</Link>,
              label(item.accountType),
              item.applicantName,
              item.party ?? '—',
              item.status,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function AccountMessageBoard() {
  usePageTitle('Account notifications — UPSA Next Payment')
  const auth = useAuth()
  const messages = useLoad(() => api.accounts.messages())
  const { error, busy, run } = useAction()

  return (
    <>
      <PageHeading kicker="Notifications" title="Account notices" lead="Welcome and service notices are queued on the same notification record used by the rest of the platform." icon="report" />
      {(messages.error || error) && <Banner>{messages.error || error}</Banner>}
      {auth.can('account.write') && (
        <Panel icon="user" title="Queue a notice">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            void run(async () => {
              await api.accounts.sendMessage({
                accountId: String(data.get('accountId') ?? '') || undefined,
                kind: String(data.get('kind')),
                channel: String(data.get('channel')),
                subject: String(data.get('subject')),
                message: String(data.get('message')),
              })
              event.currentTarget.reset()
              messages.reload()
            })
          })}>
            <Field label="Account number" note="optional"><input name="accountId" placeholder="RUPSA-ACC-000001" /></Field>
            <Field label="Kind" note="required"><select name="kind" required defaultValue="WELCOME"><Options options={['WELCOME', 'STATUS', 'REMINDER', 'DOCUMENT']} /></select></Field>
            <Field label="Channel" note="required"><select name="channel" required defaultValue="IN_APP"><Options options={['IN_APP', 'EMAIL', 'SMS']} /></select></Field>
            <Field label="Subject" note="required"><input name="subject" required /></Field>
            <Field label="Message" span="full" note="required"><textarea name="message" required /></Field>
            <button className="button primary" type="submit" disabled={busy}>Queue notice</button>
          </form>
        </Panel>
      )}
      <Panel icon="report" title="Queued notices">
        <Table
          columns={['When', 'Account', 'Kind', 'Channel', 'Subject', 'Status']}
          empty="No account notices yet."
          rows={(messages.data?.items ?? []).map((item) => [item.sentAt.slice(0, 16).replace('T', ' '), item.account, label(item.kind), item.channel, item.subject, item.status])}
        />
      </Panel>
    </>
  )
}

export function AccountAuditBoard() {
  usePageTitle('Account audit — UPSA Next Payment')
  const audit = useLoad(() => api.accounts.audit())

  return (
    <>
      <PageHeading kicker="Audit" title="Account opening audit log" lead="Every submission, review, approval, activation, change, and closure is written here and on the platform audit log." icon="shield" />
      {audit.error && <Banner>{audit.error}</Banner>}
      <Panel icon="shield" title="Recent actions">
        <Table
          columns={['When', 'Account', 'Applicant', 'Action', 'Status', 'Note']}
          empty="No account actions yet."
          rows={(audit.data?.items ?? []).map((item) => [
            String(item.at ?? '').slice(0, 16).replace('T', ' '),
            item.accountId ?? '',
            item.account ?? '',
            item.action ? label(item.action) : '',
            item.newStatus ? label(item.newStatus) : '',
            item.reason ?? '',
          ])}
        />
      </Panel>
    </>
  )
}
