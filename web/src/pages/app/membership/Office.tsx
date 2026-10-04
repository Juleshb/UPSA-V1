import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Field, PageHeading, Panel, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { onSubmit, useAction } from '../donations/kit'
import { CHANNELS, DOCUMENT_TYPES, REPORTS, checked, num, str, today } from './catalog'

export function CategoryBoard() {
  usePageTitle('Membership categories — UPSA Next Payment')
  const data = useLoad(() => api.membershipDesk.categories())
  const action = useAction()
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Membership" title="Categories and requirements" lead="Each category sets the membership fee, the renewal fee, and the documents an officer must verify." icon="shield" />
      {data.error && <p className="form-error">{data.error}</p>}
      {(data.data?.items ?? []).map((item) => (
        <Panel key={item.categoryId} title={`${item.name} · ${money(item.membershipFee, item.currency)}`} wide>
          <p>{item.eligibility} Renewal {money(item.renewalFee, item.currency)} · {item.periodMonths} months · {item.status}</p>
          <Table columns={['Document', 'Mandatory', 'Verification']} empty="No requirement is configured." rows={item.requirements.map((requirement) => [requirement.documentType, requirement.mandatory ? 'Yes' : 'No', requirement.verificationRequired ? 'Required' : 'Optional'])} />
        </Panel>
      ))}
      {can('school.write') && (
        <Panel title="Add a category" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.membershipDesk.saveCategory({ code: str(form, 'code'), name: str(form, 'name'), description: str(form, 'description') || undefined, eligibility: str(form, 'eligibility') || undefined, membershipFee: num(form, 'membershipFee'), renewalFee: num(form, 'renewalFee'), periodMonths: num(form, 'periodMonths') || 12, effectiveDate: str(form, 'effectiveDate'), approvalRequired: checked(form, 'approvalRequired') })
              data.reload()
            })
          })}>
            <Field label="Code"><input name="code" required /></Field>
            <Field label="Name"><input name="name" required /></Field>
            <Field label="Description" hint="optional"><input name="description" /></Field>
            <Field label="Eligibility" hint="optional"><input name="eligibility" /></Field>
            <Field label="Membership fee"><input name="membershipFee" type="number" min="0" step="0.01" required /></Field>
            <Field label="Renewal fee"><input name="renewalFee" type="number" min="0" step="0.01" required /></Field>
            <Field label="Period in months"><input name="periodMonths" type="number" min="1" defaultValue="12" required /></Field>
            <Field label="Effective date"><input name="effectiveDate" type="date" defaultValue={today()} required /></Field>
            <label className="app-check"><input name="approvalRequired" type="checkbox" defaultChecked /> Approval required</label>
            {action.error && <p className="form-error">{action.error}</p>}
            <button className="button primary" type="submit" disabled={action.busy}>Save category</button>
          </form>
        </Panel>
      )}
      {can('school.write') && (
        <Panel title="Set a requirement" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.membershipDesk.saveRequirement(str(form, 'categoryId'), { documentType: str(form, 'documentType'), mandatory: checked(form, 'mandatory'), verificationRequired: checked(form, 'verificationRequired') })
              data.reload()
            })
          })}>
            <Field label="Category"><select name="categoryId" required><option value="">Choose</option>{(data.data?.items ?? []).map((item) => <option key={item.categoryId} value={item.categoryId}>{item.name}</option>)}</select></Field>
            <Field label="Document"><select name="documentType">{DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <label className="app-check"><input name="mandatory" type="checkbox" defaultChecked /> Mandatory</label>
            <label className="app-check"><input name="verificationRequired" type="checkbox" defaultChecked /> Verification required</label>
            <button className="button secondary" type="submit" disabled={action.busy}>Save requirement</button>
          </form>
        </Panel>
      )}
    </>
  )
}

export function MembershipReportBoard() {
  usePageTitle('Membership reports — UPSA Next Payment')
  const [type, setType] = useState<string>(REPORTS[0][0])
  const data = useLoad(() => api.membershipDesk.report(type), [type])
  const items = data.data?.items ?? []
  const columns = items[0] ? Object.keys(items[0]) : ['Report']
  return (
    <>
      <PageHeading kicker="Reports" title="Membership reports" lead="Filter the register by status, fees, payments, and growth." icon="report" />
      <Field label="Report"><select value={type} onChange={(event) => setType(event.target.value)}>{REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {data.error && <p className="form-error">{data.error}</p>}
      <Table columns={columns} empty="This report has no rows yet." rows={items.map((item) => columns.map((column) => String(item[column] ?? '')))} />
    </>
  )
}

export function MembershipNoticeBoard() {
  usePageTitle('Membership notifications — UPSA Next Payment')
  const data = useLoad(() => api.membershipDesk.notices())
  const action = useAction()
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Notifications" title="Membership messages" lead="Application, payment, activation, expiry, suspension, and renewal notices are kept here." icon="report" />
      <Table columns={['When', 'Event', 'Subject', 'Status']} empty="No notice yet." rows={(data.data?.items ?? []).map((item) => [item.createdAt.slice(0, 16), item.event, item.subject, item.status])} />
      {can('school.write') && (
        <Panel title="Send a notice" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.membershipDesk.sendNotice({ event: str(form, 'event'), channel: str(form, 'channel'), subject: str(form, 'subject'), body: str(form, 'body') })
              data.reload()
            })
          })}>
            <Field label="Event"><input name="event" required defaultValue="MEMBER_MESSAGE" /></Field>
            <Field label="Channel"><select name="channel">{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></Field>
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

export function MembershipAuditBoard() {
  usePageTitle('Membership audit — UPSA Next Payment')
  const data = useLoad(() => api.membershipDesk.audit())
  return (
    <>
      <PageHeading kicker="Audit" title="Membership actions" lead="Each registration, verification, approval, payment, and status change keeps the officer, the previous status, and the new status." icon="report" />
      {data.error && <p className="form-error">{data.error}</p>}
      <Table columns={['When', 'Action', 'Member', 'From', 'To', 'Officer']} empty="No membership action is recorded yet." rows={(data.data?.items ?? []).map((item) => [item.createdAt.slice(0, 16), item.action, item.memberId ?? '—', item.previousStatus ?? '—', item.newStatus ?? '—', item.userId ?? '—'])} />
    </>
  )
}
