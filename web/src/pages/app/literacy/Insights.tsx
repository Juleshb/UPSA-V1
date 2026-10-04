import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { onSubmit, useAction } from '../donations/kit'

export function LiteracyCertificateBoard() {
  usePageTitle('Certificates — UPSA Next Payment')
  const rows = useLoad(() => api.literacy.certificates())
  const retraining = useLoad(() => api.literacy.retraining())
  const { error, busy, run } = useAction()
  return (
    <>
      <PageHeading kicker="Certificates" title="Issued after a passed assessment" lead="A certificate names the learner, the course, the score, and the date it expires. Retraining opens when a post-assessment is below the pass mark." icon="shield" />
      {(rows.error || error) && <Banner>{rows.error || error}</Banner>}
      <Panel icon="shield" title="Certificates">
        <Table
          columns={['Certificate', 'Learner', 'Course', 'Score', 'Status']}
          empty="No certificate yet."
          rows={(rows.data?.items ?? []).map((item) => [
            String(item.id ?? ''),
            String(item.learnerName ?? ''),
            String(item.courseName ?? ''),
            String(item.score ?? ''),
            <StatusPill key={String(item.id)} value={String(item.status ?? '')} />,
          ])}
        />
      </Panel>
      <Panel icon="user" title="Retraining">
        <Table
          columns={['Learner', 'Course', 'Focus', 'Status', '']}
          empty="No retraining is open."
          rows={(retraining.data?.items ?? []).map((item) => [
            item.learnerName,
            item.previousCourse,
            item.modules,
            <StatusPill key={item.id} value={item.status} />,
            item.status === 'REQUIRED'
              ? <button key={`${item.id}-assign`} className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.assignRetraining(item.id, { status: 'ASSIGNED' }); retraining.reload() })}>Assign</button>
              : '—',
          ])}
        />
      </Panel>
    </>
  )
}

const REPORTS = ['learners', 'completion', 'evidence', 'certificates', 'retraining'] as const

export function LiteracyReportBoard() {
  usePageTitle('Training reports — UPSA Next Payment')
  const [type, setType] = useState<(typeof REPORTS)[number]>('completion')
  const rows = useLoad(() => api.literacy.report(type), [type])
  const items = rows.data?.items ?? []
  const columns = items[0] ? Object.keys(items[0]).slice(0, 6) : ['Record']
  return (
    <>
      <PageHeading kicker="Reports" title="Evidence the training happened" lead="Completion, certificates, and understanding records are the compliance file: who was trained, on what, in which language, and whether they confirmed they understood." icon="report" />
      {rows.error && <Banner>{rows.error}</Banner>}
      <Panel icon="report" title="Report" action={
        <select value={type} onChange={(event) => setType(event.target.value as (typeof REPORTS)[number])}>
          {REPORTS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      }>
        <Table
          columns={columns}
          empty="Nothing in this report yet."
          rows={items.map((item, index) => columns.map((column) => {
            const value = item[column]
            if (column === 'status' && typeof value === 'string') return <StatusPill key={`${index}-${column}`} value={value} />
            if (typeof value === 'boolean') return value ? 'Yes' : 'No'
            return value == null ? '—' : String(value)
          }))}
        />
      </Panel>
    </>
  )
}

export function LiteracyMessageBoard() {
  usePageTitle('Training notices — UPSA Next Payment')
  const rows = useLoad(() => api.literacy.messages())
  const { error, busy, run } = useAction()
  return (
    <>
      <PageHeading kicker="Notifications" title="Notices for a learner or a group" lead="Enrolment and certificates also queue a notice. This form records an extra message." icon="report" />
      {(rows.error || error) && <Banner>{rows.error || error}</Banner>}
      <Panel icon="report" title="Send a notice">
        <form className="app-form" onSubmit={onSubmit((event) => {
          const data = new FormData(event.currentTarget)
          void run(async () => {
            await api.literacy.sendMessage({
              kind: String(data.get('kind') ?? ''),
              channel: String(data.get('channel') ?? ''),
              subject: String(data.get('subject') ?? ''),
              message: String(data.get('message') ?? ''),
            })
            rows.reload()
          })
        })}>
          <Field label="Kind" note="required"><input name="kind" required defaultValue="REMINDER" /></Field>
          <Field label="Channel" note="required"><select name="channel" defaultValue="IN_APP"><option>IN_APP</option><option>EMAIL</option><option>SMS</option></select></Field>
          <Field label="Subject" note="required"><input name="subject" required /></Field>
          <Field label="Message" note="required" span="full"><textarea name="message" required /></Field>
          <div className="app-inline-actions"><button className="button primary" type="submit" disabled={busy}>Queue notice</button></div>
        </form>
        <Table columns={['To', 'Subject', 'Channel', 'Status']} empty="No notice yet." rows={(rows.data?.items ?? []).map((item) => [String(item.learnerName ?? ''), String(item.subject ?? ''), String(item.channel ?? ''), String(item.status ?? '')])} />
      </Panel>
    </>
  )
}

export function LiteracyAuditBoard() {
  usePageTitle('Training audit — UPSA Next Payment')
  const rows = useLoad(() => api.literacy.audit())
  return (
    <>
      <PageHeading kicker="Audit logs" title="Who changed a training record" lead="Registration, enrolment, assessment, certificates, and understanding confirmations are written here and on the platform audit log." icon="shield" />
      {rows.error && <Banner>{rows.error}</Banner>}
      <Panel icon="shield" title="Audit">
        <Table
          columns={['When', 'Action', 'Actor', 'Reference', 'Detail']}
          empty="No training audit yet."
          rows={(rows.data?.items ?? []).map((item) => [String(item.createdAt ?? '').slice(0, 16), String(item.action ?? ''), String(item.actorName ?? ''), String(item.reference ?? ''), String(item.detail ?? '')])}
        />
      </Panel>
    </>
  )
}
