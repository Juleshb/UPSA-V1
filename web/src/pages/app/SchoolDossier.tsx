import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, openSchoolDocument, type SchoolRegistration } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { RwandaAddress } from '../../platform/RwandaAddress'
import { Banner, Field, FieldGroup, Modal, PageHeading, Panel, RowActions, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

const FLOW = [
  ['APPLICATION', 'Application'],
  ['SUBMITTED', 'Submitted'],
  ['DOCUMENT_REVIEW', 'Document review'],
  ['PENDING_VERIFICATION', 'Membership'],
  ['VERIFICATION', 'KYC / KYB'],
  ['APPROVED', 'Approved'],
  ['ACTIVE', 'Active'],
] as const

const NEXT_LABEL: Record<string, string> = {
  SUBMITTED: 'Submit application',
  DOCUMENT_REVIEW: 'Start document review',
  PENDING_VERIFICATION: 'Send to membership verification',
  VERIFICATION: 'Start KYC / KYB',
  APPROVED: 'Approve school',
  ACTIVE: 'Activate school',
  SUSPENDED: 'Suspend school',
  INACTIVE: 'Deactivate school',
}

const DOCUMENTS = [
  ['LICENSE', 'Operating licence'],
  ['REGISTRATION_CERTIFICATE', 'Registration certificate'],
  ['TIN_CERTIFICATE', 'TIN certificate'],
  ['RUPSA_MEMBERSHIP', 'UPSA membership letter'],
  ['OWNER_IDENTITY', 'Owner identity'],
  ['BANK_LETTER', 'Bank confirmation'],
  ['OTHER', 'Other'],
]

const EDITABLE = ['APPLICATION', 'SUBMITTED', 'DOCUMENT_REVIEW', 'PENDING_VERIFICATION', 'VERIFICATION']

function stepClass(status: string, step: string) {
  if (status === 'SUSPENDED' || status === 'INACTIVE') return 'done'
  const order = FLOW.map(([value]) => value)
  const current = order.indexOf(status as (typeof FLOW)[number][0])
  const index = order.indexOf(step as (typeof FLOW)[number][0])
  if (current === -1 || index < current) return 'done'
  if (index === current) return 'current'
  return ''
}

export function SchoolDossier() {
  const { schoolId = '' } = useParams()
  const { can } = useAuth()
  const file = useLoad(() => api.schools.registration(schoolId), [schoolId])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const school = file.data?.school
  usePageTitle(school ? `${school.schoolName} — UPSA Next Payment` : 'School registration — UPSA Next Payment')
  const editable = Boolean(school && EDITABLE.includes(school.status) && can('school.write'))
  const reviewer = can('admin.write')

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      setConfirm(null)
      file.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The registration file could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  function onProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(() => api.schools.update(schoolId, {
      schoolName: String(form.get('schoolName')),
      taxIdentificationNumber: String(form.get('taxIdentificationNumber') || ''),
      rupsaMemberId: String(form.get('rupsaMemberId') || ''),
      phone: String(form.get('phone')),
      email: String(form.get('email')),
      province: String(form.get('province')),
      district: String(form.get('district')),
      sector: String(form.get('sector') || ''),
    }))
  }

  function onPerson(role: 'MANAGEMENT' | 'SIGNATORY') {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const target = event.currentTarget
      void run(async () => {
        await api.schools.addPerson(schoolId, {
          role,
          fullName: String(form.get('fullName')),
          title: String(form.get('title')),
          phone: String(form.get('phone') || '') || undefined,
          email: String(form.get('email') || '') || undefined,
        })
        target.reset()
      })
    }
  }

  function onOwnership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const target = event.currentTarget
    void run(async () => {
      await api.schools.addOwnership(schoolId, {
        ownerName: String(form.get('ownerName')),
        ownershipPct: Number(form.get('ownershipPct')),
        nationalId: String(form.get('nationalId') || '') || undefined,
      })
      target.reset()
    })
  }

  function onBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const target = event.currentTarget
    void run(async () => {
      await api.schools.addBank(schoolId, {
        bankName: String(form.get('bankName')),
        accountName: String(form.get('accountName')),
        accountNumber: String(form.get('accountNumber')),
        currency: 'RWF',
        isPrimary: form.get('isPrimary') === 'on',
      })
      target.reset()
    })
  }

  function onDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fileInput = event.currentTarget.elements.namedItem('file') as HTMLInputElement
    const uploaded = fileInput.files?.[0]
    if (!uploaded) return
    const target = event.currentTarget
    const body = new FormData()
    body.set('documentType', String(form.get('documentType')))
    body.set('file', uploaded)
    void run(async () => {
      await api.schools.addDocument(schoolId, body)
      target.reset()
    })
  }

  function onMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(() => api.schools.membership(schoolId, {
      decision: String(form.get('decision')) as 'PENDING' | 'VERIFIED' | 'REJECTED',
      rupsaMemberId: String(form.get('rupsaMemberId') || '') || undefined,
    }))
  }

  function onKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const target = event.currentTarget
    void run(async () => {
      await api.schools.kyc(schoolId, {
        kind: String(form.get('kind')) as 'KYC' | 'KYB',
        status: String(form.get('status')) as 'PENDING' | 'VERIFIED' | 'REJECTED',
        notes: String(form.get('notes') || '') || undefined,
      })
      target.reset()
    })
  }

  const data = file.data
  const forward = data?.workflow.next.filter((status) => status !== 'SUSPENDED' && status !== 'INACTIVE') ?? []
  const statusActions = data?.workflow.next.filter((status) => status === 'SUSPENDED' || status === 'INACTIVE' || (data.school.status === 'SUSPENDED' && status === 'ACTIVE')) ?? []

  return (
    <div className="app-page">
      <PageHeading
        kicker="Module 1"
        title={school?.schoolName ?? 'School registration file'}
        lead="Verified digital identity for a UPSA member school. Licensed payment activity stays closed until this file is approved and active."
        icon="school"
        actions={<Link className="button secondary" to="/app/schools">Back to register</Link>}
      />
      {(file.error || error) && <Banner>{file.error || error}</Banner>}
      {file.loading || !data || !school ? <p className="app-empty">Loading the registration file…</p> : (
        <DossierBody
          data={data}
          editable={editable}
          reviewer={reviewer}
          busy={busy}
          forward={forward}
          statusActions={statusActions}
          onProfile={onProfile}
          onPerson={onPerson}
          onOwnership={onOwnership}
          onBank={onBank}
          onDocument={onDocument}
          onMembership={onMembership}
          onKyc={onKyc}
          onRemove={(action) => void run(action)}
          onAdvance={(status) => setConfirm(status)}
        />
      )}

      <Modal
        open={confirm !== null}
        title={confirm ? NEXT_LABEL[confirm] ?? 'Update status' : 'Update status'}
        onClose={() => setConfirm(null)}
        footer={(
          <>
            <button className="button secondary" type="button" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="button primary" type="button" disabled={busy || !confirm} onClick={() => confirm && void run(() => api.schools.transition(schoolId, confirm))}>
              {busy ? 'Updating…' : 'Confirm'}
            </button>
          </>
        )}
      >
        <p className="app-empty">This moves {school?.schoolName ?? 'the school'} to {confirm?.replaceAll('_', ' ').toLowerCase()}.</p>
      </Modal>
    </div>
  )
}

function DossierBody({
  data,
  editable,
  reviewer,
  busy,
  forward,
  statusActions,
  onProfile,
  onPerson,
  onOwnership,
  onBank,
  onDocument,
  onMembership,
  onKyc,
  onRemove,
  onAdvance,
}: {
  data: SchoolRegistration
  editable: boolean
  reviewer: boolean
  busy: boolean
  forward: string[]
  statusActions: string[]
  onProfile: (event: FormEvent<HTMLFormElement>) => void
  onPerson: (role: 'MANAGEMENT' | 'SIGNATORY') => (event: FormEvent<HTMLFormElement>) => void
  onOwnership: (event: FormEvent<HTMLFormElement>) => void
  onBank: (event: FormEvent<HTMLFormElement>) => void
  onDocument: (event: FormEvent<HTMLFormElement>) => void
  onMembership: (event: FormEvent<HTMLFormElement>) => void
  onKyc: (event: FormEvent<HTMLFormElement>) => void
  onRemove: (action: () => Promise<unknown>) => void
  onAdvance: (status: string) => void
}) {
  const school = data.school
  const canSubmit = school.status === 'APPLICATION'
  const canReviewStep = reviewer && forward.some((status) => status !== 'SUBMITTED')

  return (
    <>
      <Panel icon="school" title="Approval workflow">
        <ol className="app-steps">
          {FLOW.map(([status, label]) => (
            <li key={status} className={stepClass(school.status, status)}>{label}</li>
          ))}
        </ol>
        <div className="app-inline-actions">
          <StatusPill value={school.status} />
          <StatusPill value={school.membershipStatus ?? 'UNVERIFIED'} />
          <StatusPill value={school.kybStatus} />
          {canSubmit && <button className="button primary" type="button" disabled={busy} onClick={() => onAdvance('SUBMITTED')}>Submit application</button>}
          {canReviewStep && forward.filter((status) => status !== 'SUBMITTED').map((status) => (
            <button key={status} className="button primary" type="button" disabled={busy} onClick={() => onAdvance(status)}>{NEXT_LABEL[status]}</button>
          ))}
          {reviewer && statusActions.map((status) => (
            <button key={status} className="button secondary" type="button" disabled={busy} onClick={() => onAdvance(status)}>{NEXT_LABEL[status]}</button>
          ))}
        </div>
        {!editable && <p className="app-note">This file is locked because the school is {school.status.replaceAll('_', ' ').toLowerCase()}.</p>}
      </Panel>

      <form className="app-form" onSubmit={onProfile}>
        <FieldGroup title="School profile and registration">
          <Field label="School name" span="full">
            <input name="schoolName" required defaultValue={school.schoolName} disabled={!editable} />
          </Field>
          <Field label="Registration number">
            <input value={school.registrationNumber ?? ''} disabled />
          </Field>
          <Field label="Tax identification number">
            <input name="taxIdentificationNumber" defaultValue={school.taxIdentificationNumber ?? ''} disabled={!editable} />
          </Field>
          <Field label="School ID">
            <input value={school.schoolId} disabled />
          </Field>
          <Field label="UPSA member ID">
            <input name="rupsaMemberId" defaultValue={school.rupsaMemberId ?? ''} disabled={!editable} />
          </Field>
        </FieldGroup>
        <FieldGroup title="Contact information">
          <Field label="Phone">
            <input name="phone" required defaultValue={school.phone ?? ''} disabled={!editable} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required defaultValue={school.email} disabled={!editable} />
          </Field>
        </FieldGroup>
        <FieldGroup title="School location">
          <RwandaAddress
            defaultProvince={school.address.province}
            defaultDistrict={school.address.district}
            defaultSector={school.address.sector ?? ''}
          />
        </FieldGroup>
        {editable && <div className="app-field full"><button className="button primary" type="submit" disabled={busy}>Save profile</button></div>}
      </form>

      <div className="app-grid">
        <Panel icon="family" title="Ownership">
          <Table
            columns={['Owner', 'Share', 'National ID', '']}
            empty="No owners recorded."
            rows={data.ownership.map((row) => [
              row.ownerName,
              `${row.ownershipPct}%`,
              row.nationalId ?? '—',
              editable ? <RowActions key={row.id}><button type="button" className="danger" onClick={() => onRemove(() => api.schools.removeOwnership(school.schoolId, row.id))}>Remove</button></RowActions> : '—',
            ])}
          />
          {editable && (
            <form className="app-form" onSubmit={onOwnership}>
              <Field label="Owner name"><input name="ownerName" required /></Field>
              <Field label="Ownership %"><input name="ownershipPct" type="number" min="1" max="100" required /></Field>
              <Field label="National ID" span="full"><input name="nationalId" /></Field>
              <button className="button secondary" type="submit" disabled={busy}>Add owner</button>
            </form>
          )}
        </Panel>
        <Panel icon="user" title="Bank account">
          <Table
            columns={['Bank', 'Account', 'Currency', '']}
            empty="No collection account recorded."
            rows={data.bankAccounts.map((row) => [
              row.bankName,
              `${row.accountName} · ${row.accountNumber}${row.isPrimary ? ' · Primary' : ''}`,
              row.currency,
              editable ? <RowActions key={row.id}><button type="button" className="danger" onClick={() => onRemove(() => api.schools.removeBank(school.schoolId, row.id))}>Remove</button></RowActions> : '—',
            ])}
          />
          {editable && (
            <form className="app-form" onSubmit={onBank}>
              <Field label="Bank"><input name="bankName" required placeholder="Bank of Kigali" /></Field>
              <Field label="Account name"><input name="accountName" required /></Field>
              <Field label="Account number"><input name="accountNumber" required /></Field>
              <Field label="Primary account"><input name="isPrimary" type="checkbox" defaultChecked /></Field>
              <button className="button secondary" type="submit" disabled={busy}>Add account</button>
            </form>
          )}
        </Panel>
      </div>

      <div className="app-grid">
        <PeoplePanel title="Management" people={data.management} editable={editable} busy={busy} schoolId={school.schoolId} onSubmit={onPerson('MANAGEMENT')} onRemove={onRemove} />
        <PeoplePanel title="Authorized signatories" people={data.signatories} editable={editable} busy={busy} schoolId={school.schoolId} onSubmit={onPerson('SIGNATORY')} onRemove={onRemove} />
      </div>

      <Panel icon="ledger" title="Licensing and registration documents">
        <Table
          columns={['Document', 'File', 'Status', 'Open', '']}
          empty="No documents uploaded."
          rows={data.documents.map((row) => [
            labelFor(row.documentType),
            row.fileName,
            <StatusPill key={row.id} value={row.status} />,
            reviewer && row.viewable ? (
              <button key={`${row.id}-view`} type="button" onClick={() => void openSchoolDocument(school.schoolId, row.id)}>View</button>
            ) : reviewer ? 'Name only' : '—',
            reviewer && row.status === 'SUBMITTED' ? (
              <RowActions key={`${row.id}-review`}>
                <button type="button" onClick={() => onRemove(() => api.schools.reviewDocument(school.schoolId, row.id, 'ACCEPTED'))}>Accept</button>
                <button type="button" className="danger" onClick={() => onRemove(() => api.schools.reviewDocument(school.schoolId, row.id, 'REJECTED'))}>Reject</button>
              </RowActions>
            ) : '—',
          ])}
        />
        {editable && (
          <form className="app-form" onSubmit={onDocument}>
            <Field label="Document type">
              <select name="documentType" defaultValue="REGISTRATION_CERTIFICATE">
                {DOCUMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Upload" hint="PDF, PNG, or JPEG. A UPSA administrator can open it here and on the workspace home.">
              <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required />
            </Field>
            <button className="button secondary" type="submit" disabled={busy}>Upload document</button>
          </form>
        )}
      </Panel>

      <div className="app-grid">
        <Panel icon="shield" title="UPSA membership verification">
          <dl className="app-dl">
            <div><dt>Membership reference</dt><dd>{school.rupsaMemberId ?? '—'}</dd></div>
            <div><dt>Membership</dt><dd><StatusPill value={school.membershipStatus ?? 'UNVERIFIED'} /></dd></div>
          </dl>
          <p className="app-note">A school can be verified only after a confirmed UPSA membership is linked. Use the membership reference, such as RUPSA-MBA-000002.</p>
          {reviewer && (
            <form className="app-form" onSubmit={onMembership}>
              <Field label="Membership reference"><input name="rupsaMemberId" defaultValue={school.rupsaMemberId ?? ''} placeholder="RUPSA-MBA-000002" /></Field>
              <Field label="Decision">
                <select name="decision" defaultValue="VERIFIED">
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </Field>
              <button className="button secondary" type="submit" disabled={busy}>Record membership decision</button>
            </form>
          )}
        </Panel>
        <Panel icon="report" title="KYC / KYB verification">
          <Table
            columns={['Check', 'Status', 'Notes']}
            empty="No verification recorded."
            rows={data.kyc.map((row) => [row.kind, <StatusPill key={row.id} value={row.status} />, row.notes ?? '—'])}
          />
          {reviewer && (
            <form className="app-form" onSubmit={onKyc}>
              <Field label="Check">
                <select name="kind" defaultValue="KYB">
                  <option value="KYB">KYB — school</option>
                  <option value="KYC">KYC — signatory</option>
                </select>
              </Field>
              <Field label="Outcome">
                <select name="status" defaultValue="VERIFIED">
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </Field>
              <Field label="Notes" span="full"><input name="notes" placeholder="Registry and identity documents checked" /></Field>
              <button className="button secondary" type="submit" disabled={busy}>Record verification</button>
            </form>
          )}
        </Panel>
      </div>
    </>
  )
}

function PeoplePanel({
  title,
  people,
  editable,
  busy,
  schoolId,
  onSubmit,
  onRemove,
}: {
  title: string
  people: SchoolRegistration['management']
  editable: boolean
  busy: boolean
  schoolId: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onRemove: (action: () => Promise<unknown>) => void
}) {
  return (
    <Panel icon="user" title={title}>
      <Table
        columns={['Name', 'Title', 'Contact', '']}
        empty={`No ${title.toLowerCase()} recorded.`}
        rows={people.map((row) => [
          row.fullName,
          row.title,
          row.email ?? row.phone ?? '—',
          editable ? <RowActions key={row.id}><button type="button" className="danger" onClick={() => onRemove(() => api.schools.removePerson(schoolId, row.id))}>Remove</button></RowActions> : '—',
        ])}
      />
      {editable && (
        <form className="app-form" onSubmit={onSubmit}>
          <Field label="Full name"><input name="fullName" required /></Field>
          <Field label="Title"><input name="title" required placeholder={title === 'Authorized signatories' ? 'Head of school' : 'Bursar'} /></Field>
          <Field label="Phone"><input name="phone" /></Field>
          <Field label="Email"><input name="email" type="email" /></Field>
          <button className="button secondary" type="submit" disabled={busy}>Add</button>
        </form>
      )}
    </Panel>
  )
}

function labelFor(value: string) {
  return DOCUMENTS.find(([code]) => code === value)?.[1] ?? value.replaceAll('_', ' ')
}
