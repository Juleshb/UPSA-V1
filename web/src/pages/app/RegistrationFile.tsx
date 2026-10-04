import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, openProtectedFile, type RegistrationChecklist } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { shortDate } from '../../platform/format'
import { Banner, Field, PageHeading, Panel, RowActions, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'
import { DOCUMENT_TYPES, PARTY_FIELDS, isPartyKind, optionLabel, type PartyKind } from './registrationCatalog'

const CHECKS: Array<[keyof RegistrationChecklist, string]> = [
  ['identityVerified', 'Identity, KYC or KYB completed'],
  ['documentsVerified', 'Required documents verified'],
  ['contactVerified', 'Contact information verified'],
  ['addressVerified', 'Address verified'],
  ['financialVerified', 'Financial information verified'],
  ['consentCaptured', 'Consent captured'],
  ['duplicateChecked', 'Duplicate check completed'],
]

const LIFECYCLE = ['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'VERIFICATION', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE']

export function RegistrationFile() {
  const { registrationId = '' } = useParams()
  const { can } = useAuth()
  const record = useLoad(() => api.registrations.get(registrationId), [registrationId])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const data = record.data
  const kind = data && isPartyKind(data.kind) ? data.kind : null
  usePageTitle(data ? `${data.displayName} — Registration` : 'Registration — UPSA Next Payment')

  async function run(task: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await task()
      record.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The registration could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      result: String(form.get('result')),
      comments: String(form.get('comments') || ''),
      identityVerified: form.get('identityVerified') === 'on',
      documentsVerified: form.get('documentsVerified') === 'on',
      contactVerified: form.get('contactVerified') === 'on',
      addressVerified: form.get('addressVerified') === 'on',
      financialVerified: form.get('financialVerified') === 'on',
      consentCaptured: form.get('consentCaptured') === 'on',
      duplicateChecked: form.get('duplicateChecked') === 'on',
    }
    void run(() => api.registrations.verify(registrationId, body))
  }

  function onApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(() => api.registrations.approve(registrationId, {
      decision: String(form.get('decision')),
      conditions: String(form.get('conditions') || ''),
      comments: String(form.get('comments') || ''),
    }))
  }

  function onDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void run(async () => {
      const file = data.get('file')
      let uploadId: string | undefined
      let fileName = String(data.get('documentType'))
      if (file instanceof File && file.size) {
        const body = new FormData()
        body.set('file', file)
        const uploaded = await api.registrations.upload(body)
        uploadId = uploaded.uploadId
        fileName = uploaded.fileName
      }
      await api.registrations.addDocument(registrationId, {
        documentType: String(data.get('documentType')),
        documentNumber: String(data.get('documentNumber') || '') || undefined,
        issueDate: String(data.get('issueDate') || '') || undefined,
        expiryDate: String(data.get('expiryDate') || '') || undefined,
        issuingAuthority: String(data.get('issuingAuthority') || '') || undefined,
        fileName,
        uploadId,
      })
      form.reset()
    })
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Registration"
        title={data?.displayName ?? 'Registration file'}
        lead={data ? `${data.kind.replaceAll('_', ' ')} · ${data.registrationId}` : 'Loading the registration file.'}
        icon="user"
        actions={<Link className="button secondary" to="/app/registration">Back to registry</Link>}
      />
      {(record.error || error) && <Banner>{record.error || error}</Banner>}
      {data && (
        <>
          <ol className="app-steps">
            {LIFECYCLE.map((step) => {
              const index = LIFECYCLE.indexOf(data.status)
              const stepIndex = LIFECYCLE.indexOf(step)
              const className = data.status === step ? 'current' : stepIndex >= 0 && index > stepIndex ? 'done' : ''
              return <li key={step} className={className}>{step.replaceAll('_', ' ')}</li>
            })}
          </ol>
          {!LIFECYCLE.includes(data.status) && <p className="app-note">Current status: {data.status.replaceAll('_', ' ')}</p>}

          <div className="app-grid">
            <Panel icon="user" title="Application">
              <dl className="app-dl">
                <div><dt>Registration ID</dt><dd>{data.registrationId}</dd></div>
                <div><dt>Reference</dt><dd>{data.referenceCode ?? '—'}</dd></div>
                <div><dt>Status</dt><dd><StatusPill value={data.status} /></dd></div>
                <div><dt>Email</dt><dd>{data.email ?? '—'}</dd></div>
                <div><dt>Telephone</dt><dd>{data.phone ?? '—'}</dd></div>
                {data.schoolName && <div><dt>School</dt><dd>{data.schoolId ? <Link to={`/app/schools/${data.schoolId}`}>{data.schoolName}</Link> : data.schoolName}</dd></div>}
                {data.guardianId && <div><dt>Guardian ID</dt><dd>{data.guardianId}</dd></div>}
                <div><dt>Opened</dt><dd>{shortDate(data.createdAt)}</dd></div>
              </dl>
            </Panel>
            <Panel icon="report" title="Profile">
              <dl className="app-dl">
                {(kind ? PARTY_FIELDS[kind] : []).filter((field) => field.input !== 'checkbox').map((field) => {
                  const raw = data.profile[field.key]
                  const partyId = field.key === 'parentId' ? data.guardianId : data.registrationId
                  const value = field.input === 'automatic'
                    ? (field.key.endsWith('Id') ? (partyId ?? '—') : 'Recorded with this registration')
                    : raw == null || raw === '' ? '—' : typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : field.input === 'select' ? optionLabel(field, String(raw)) : String(raw)
                  return <div key={field.key}><dt>{field.label}</dt><dd>{value}</dd></div>
                })}
              </dl>
            </Panel>
          </div>

          <Panel icon="ledger" title="Documents">
            <Table
              columns={['Type', 'Number', 'File', 'Status', '']}
              empty="No documents uploaded."
              rows={data.documents.map((document) => [
                document.documentType.replaceAll('_', ' '),
                document.documentNumber ?? '—',
                document.hasFile
                  ? <button key={document.id} type="button" onClick={() => openProtectedFile(`/registrations/${encodeURIComponent(data.registrationId)}/documents/${encodeURIComponent(document.id)}/file`)}>{document.fileName}</button>
                  : document.fileName,
                <StatusPill key={`${document.id}-status`} value={document.verificationStatus} />,
                can('school.write') ? (
                  <RowActions key={`${document.id}-actions`}>
                    <button type="button" onClick={() => run(() => api.registrations.reviewDocument(data.registrationId, document.id, 'VERIFIED'))}>Verify</button>
                    <button type="button" className="danger" onClick={() => run(() => api.registrations.reviewDocument(data.registrationId, document.id, 'REJECTED'))}>Reject</button>
                  </RowActions>
                ) : '—',
              ])}
            />
            {can('school.write') && kind && (
              <form className="app-form" onSubmit={onDocument}>
                <Field label="Document type">
                  <select name="documentType" defaultValue={DOCUMENT_TYPES[kind as PartyKind][0][0]}>
                    {DOCUMENT_TYPES[kind].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Document number"><input name="documentNumber" /></Field>
                <Field label="Issue date"><input name="issueDate" type="date" /></Field>
                <Field label="Expiry date"><input name="expiryDate" type="date" /></Field>
                <Field label="Issuing authority"><input name="issuingAuthority" /></Field>
                <Field label="File" hint="PDF, PNG, or JPEG.">
                  <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" />
                </Field>
                <button className="button secondary" type="submit" disabled={busy}>Add document</button>
              </form>
            )}
          </Panel>

          <div className="app-grid">
            <Panel icon="shield" title="Verification">
              {can('school.write') ? (
                <form className="app-form" onSubmit={onVerify}>
                  {CHECKS.map(([name, label]) => (
                    <label key={name} className="app-check">
                      <input name={name} type="checkbox" defaultChecked={data.checklist[name]} />
                      {label}
                    </label>
                  ))}
                  <Field label="Result">
                    <select name="result" defaultValue="VERIFIED">
                      <option value="VERIFIED">Verified — send to approval</option>
                      <option value="MORE_INFORMATION_REQUIRED">More information required</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="ESCALATED">Escalated</option>
                    </select>
                  </Field>
                  <Field label="Comments" span="full"><input name="comments" defaultValue={data.comments ?? ''} /></Field>
                  <button className="button secondary" type="submit" disabled={busy}>Save verification</button>
                </form>
              ) : (
                <dl className="app-dl">
                  {CHECKS.map(([name, label]) => <div key={name}><dt>{label}</dt><dd>{data.checklist[name] ? 'Yes' : 'No'}</dd></div>)}
                </dl>
              )}
            </Panel>
            <Panel icon="report" title="Approval">
              <dl className="app-dl">
                <div><dt>Decision</dt><dd>{data.decision ? <StatusPill value={data.decision} /> : '—'}</dd></div>
                <div><dt>Approved by</dt><dd>{data.approvedBy ?? '—'}</dd></div>
                <div><dt>Approval date</dt><dd>{data.approvalDate ? shortDate(data.approvalDate) : '—'}</dd></div>
                <div><dt>Conditions</dt><dd>{data.conditions ?? '—'}</dd></div>
              </dl>
              {can('school.write') && (
                <form className="app-form" onSubmit={onApprove}>
                  <Field label="Decision">
                    <select name="decision" defaultValue="APPROVE">
                      <option value="APPROVE">Approve</option>
                      <option value="CONDITIONAL">Conditionally approve</option>
                      <option value="MORE_INFORMATION">Request more information</option>
                      <option value="REJECT">Reject</option>
                    </select>
                  </Field>
                  <Field label="Conditions"><input name="conditions" defaultValue={data.conditions ?? ''} /></Field>
                  <Field label="Comments" span="full"><input name="comments" defaultValue={data.comments ?? ''} /></Field>
                  <button className="button primary" type="submit" disabled={busy}>Record decision</button>
                </form>
              )}
            </Panel>
          </div>

          <Panel icon="report" title="Audit log">
            <Table
              columns={['When', 'Action', 'From', 'To', 'Reason']}
              empty="No registration events yet."
              rows={data.events.map((event) => [
                shortDate(event.createdAt),
                event.action,
                event.previousStatus?.replaceAll('_', ' ') ?? '—',
                event.newStatus?.replaceAll('_', ' ') ?? '—',
                event.reason ?? '—',
              ])}
            />
          </Panel>
        </>
      )}
    </div>
  )
}
