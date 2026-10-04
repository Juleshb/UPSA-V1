import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCells, getDistricts, getProvinces, getSectors } from 'rwanda-locations'
import { usePageTitle } from '../../../components/usePageTitle'
import { api, openProtectedFile } from '../../../platform/api'
import { money } from '../../../platform/format'
import { MembershipCertificate } from '../../../components/MembershipCertificate'
import { Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import type { MemberFile } from '../../../platform/membership'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { FormSteps, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { DOCUMENT_TYPES, INSTITUTION_TYPES, PAYMENT_METHODS, VERIFICATION_CHECKS, checked, documentLabel, num, str, today } from './catalog'

export function MemberList() {
  usePageTitle('Members — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const data = useLoad(() => api.membershipDesk.members({ q: query, status }), [query, status])
  return (
    <>
      <PageHeading kicker="Members" title="Member register" lead="Search by member, membership number, school, registration number, telephone, email, or district." icon="school" actions={<Link className="button primary" to="/app/membership/members/new">New member</Link>} />
      <div className="app-form">
        <Field label="Search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, number, telephone, email" /></Field>
        <Field label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'VERIFICATION', 'PENDING_APPROVAL', 'FEE_PAYMENT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REJECTED', 'TERMINATED', 'MORE_INFORMATION_REQUIRED'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
      </div>
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Member', 'Number', 'Category', 'District', 'Expiry', 'Payment', 'Status']}
        empty="No member is registered yet."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.memberId} to={`/app/membership/members/${item.memberId}`}>{item.institutionName}</Link>,
          item.membershipNumber ?? item.memberId,
          item.category,
          item.district,
          item.expiryDate ?? '—',
          item.payment,
          <StatusPill key={`${item.memberId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

const STEPS = ['Institution', 'Location', 'Contact and legal', 'Bank', 'Representative']

export function MemberForm() {
  usePageTitle('Register a member — UPSA Next Payment')
  const navigate = useNavigate()
  const schools = useLoad(() => api.schools.list())
  const categories = useLoad(() => api.membershipDesk.categories())
  const form = useFormSteps()
  const action = useAction()
  const provinces = useMemo(() => getProvinces(), [])
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [sector, setSector] = useState('')
  const [cell, setCell] = useState('')
  const districts = province ? getDistricts(province) ?? [] : []
  const sectors = province && district ? getSectors(province, district) ?? [] : []
  const cells = province && district && sector ? getCells(province, district, sector) ?? [] : []
  return (
    <>
      <PageHeading kicker="Membership" title="Register a member" lead="Link an existing school, or leave the school blank and a school record is created from this registration." icon="school" />
      <form className="form-wizard" onSubmit={onSubmit((event) => {
        const values = Object.fromEntries(Object.entries(form.collect(event.currentTarget)).filter(([, value]) => value !== ''))
        action.run(async () => {
          const created = await api.membershipDesk.registerMember({
            ...values,
            mode: 'submit',
            province,
            district,
            sector,
            cell,
            studentCount: Number(values.studentCount || 0) || undefined,
            staffCount: Number(values.staffCount || 0) || undefined,
            schoolId: values.schoolId || undefined,
          })
          navigate(`/app/membership/members/${String(created.memberId)}`)
        })
      })}>
        <FormSteps steps={STEPS} step={form.step} onPick={(index) => form.move(document.querySelector('.form-wizard') as HTMLFormElement, index, STEPS.length)} />
        {form.step === 0 && (
          <div className="app-form">
            <Field label="Existing school" hint="optional"><select name="schoolId" defaultValue={kept(form.values, 'schoolId')}><option value="">Create from this form</option>{(schools.data?.items ?? []).map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></Field>
            <Field label="Membership category"><select name="categoryCode" defaultValue={kept(form.values, 'categoryCode')} required><option value="">Choose</option>{(categories.data?.items ?? []).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Field>
            <Field label="Institution name"><input name="institutionName" defaultValue={kept(form.values, 'institutionName')} required /></Field>
            <Field label="Registration number"><input name="registrationNumber" defaultValue={kept(form.values, 'registrationNumber')} required /></Field>
            <Field label="Institution type"><select name="institutionType" defaultValue={kept(form.values, 'institutionType', 'SECONDARY')}>{INSTITUTION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Date established" hint="optional"><input name="dateEstablished" type="date" defaultValue={kept(form.values, 'dateEstablished')} /></Field>
            <Field label="Number of students" hint="optional"><input name="studentCount" type="number" min="0" defaultValue={kept(form.values, 'studentCount')} /></Field>
            <Field label="Number of staff" hint="optional"><input name="staffCount" type="number" min="0" defaultValue={kept(form.values, 'staffCount')} /></Field>
          </div>
        )}
        {form.step === 1 && (
          <div className="app-form">
            <Field label="Province"><select value={province} onChange={(event) => { setProvince(event.target.value); setDistrict(''); setSector(''); setCell('') }} required><option value="">Choose</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="District"><select value={district} onChange={(event) => { setDistrict(event.target.value); setSector(''); setCell('') }} required><option value="">Choose</option>{districts.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Sector"><select value={sector} onChange={(event) => { setSector(event.target.value); setCell('') }} required><option value="">Choose</option>{sectors.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Cell"><select value={cell} onChange={(event) => setCell(event.target.value)} required><option value="">Choose</option>{cells.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Village" hint="optional"><input name="village" defaultValue={kept(form.values, 'village')} /></Field>
            <Field label="Physical address"><input name="physicalAddress" defaultValue={kept(form.values, 'physicalAddress')} required /></Field>
          </div>
        )}
        {form.step === 2 && (
          <div className="app-form">
            <Field label="Official telephone"><input name="phone" defaultValue={kept(form.values, 'phone')} required /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={kept(form.values, 'email')} required /></Field>
            <Field label="Website" hint="optional"><input name="website" defaultValue={kept(form.values, 'website')} /></Field>
            <Field label="P.O. Box" hint="optional"><input name="postalAddress" defaultValue={kept(form.values, 'postalAddress')} /></Field>
            <Field label="Alternative telephone" hint="optional"><input name="alternativePhone" defaultValue={kept(form.values, 'alternativePhone')} /></Field>
            <Field label="Registration certificate number"><input name="registrationCertificateNumber" defaultValue={kept(form.values, 'registrationCertificateNumber')} required /></Field>
            <Field label="Registration date" hint="optional"><input name="registrationDate" type="date" defaultValue={kept(form.values, 'registrationDate')} /></Field>
            <Field label="Tax identification number" hint="optional"><input name="taxIdentificationNumber" defaultValue={kept(form.values, 'taxIdentificationNumber')} /></Field>
            <Field label="Issuing authority" hint="optional"><input name="issuingAuthority" defaultValue={kept(form.values, 'issuingAuthority')} /></Field>
          </div>
        )}
        {form.step === 3 && (
          <div className="app-form">
            <Field label="Bank name" hint="optional"><input name="bankName" defaultValue={kept(form.values, 'bankName')} /></Field>
            <Field label="Account name" hint="optional"><input name="bankAccountName" defaultValue={kept(form.values, 'bankAccountName')} /></Field>
            <Field label="Account number" hint="optional"><input name="bankAccountNumber" defaultValue={kept(form.values, 'bankAccountNumber')} /></Field>
            <Field label="Branch" hint="optional"><input name="bankBranch" defaultValue={kept(form.values, 'bankBranch')} /></Field>
            <Field label="Currency"><input name="currency" defaultValue={kept(form.values, 'currency', 'RWF')} required /></Field>
          </div>
        )}
        {form.step === 4 && (
          <div className="app-form">
            <Field label="Full name"><input name="representativeName" defaultValue={kept(form.values, 'representativeName')} required /></Field>
            <Field label="Position"><input name="representativePosition" defaultValue={kept(form.values, 'representativePosition')} required /></Field>
            <Field label="National ID or passport" hint="optional"><input name="representativeNationalId" defaultValue={kept(form.values, 'representativeNationalId')} /></Field>
            <Field label="Telephone"><input name="representativePhone" defaultValue={kept(form.values, 'representativePhone')} required /></Field>
            <Field label="Email"><input name="representativeEmail" type="email" defaultValue={kept(form.values, 'representativeEmail')} required /></Field>
          </div>
        )}
        {action.error && <p className="form-error">{action.error}</p>}
        <StepNav step={form.step} count={STEPS.length} busy={action.busy} submitLabel="Submit application" onBack={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step - 1, STEPS.length)} onNext={() => {
          if (form.step === 1 && (!province || !district || !sector || !cell)) {
            action.setError('Choose the province, district, sector, and cell.')
            return
          }
          action.setError('')
          form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step + 1, STEPS.length)
        }} />
      </form>
    </>
  )
}

const VERIFY_STEPS = ['Register', 'Address', 'Representative', 'Bank', 'Decision']
const VERIFY_GROUPS = [
  ['registrationVerified', 'nameVerified', 'numberVerified'],
  ['addressVerified', 'legalVerified'],
  ['identityVerified', 'authorityVerified', 'contactVerified'],
  ['bankVerified', 'bankBelongsToInstitution'],
] as const

function VerificationWizard({
  file,
  busy,
  onSave,
}: {
  file: MemberFile
  busy: boolean
  onSave: (body: Record<string, unknown>) => void
}) {
  const steps = useFormSteps()
  const saved = file.verification
  const facts = [
    [['Institution', file.institutionName], ['Registration number', file.registrationNumber]],
    [['Address', file.physicalAddress || '—']],
    [['Representative', file.representativeName], ['Telephone', file.phone], ['Email', file.email]],
    [['Bank', file.bankName || '—']],
  ]
  function marked(name: string) {
    const prior = saved && name in saved && saved[name as keyof typeof saved] === true ? 'on' : ''
    return kept(steps.values, name, prior) === 'on'
  }
  return (
    <form className="form-wizard" onSubmit={onSubmit((event) => {
      const values = steps.collect(event.currentTarget)
      const flag = (name: typeof VERIFICATION_CHECKS[number][0]) => name in values ? values[name] === 'on' : saved?.[name] === true
      onSave({
        registrationVerified: flag('registrationVerified'),
        nameVerified: flag('nameVerified'),
        numberVerified: flag('numberVerified'),
        addressVerified: flag('addressVerified'),
        legalVerified: flag('legalVerified'),
        identityVerified: flag('identityVerified'),
        authorityVerified: flag('authorityVerified'),
        contactVerified: flag('contactVerified'),
        bankVerified: flag('bankVerified'),
        bankBelongsToInstitution: flag('bankBelongsToInstitution'),
        result: values.result || saved?.result || 'PENDING',
        comments: (values.comments ?? saved?.comments ?? '').trim() || undefined,
      })
    })}>
      <p className="lend-note">Work through the register, the address, the representative, and the bank account. Save on the last step. A verified result moves the file to approval.</p>
      <FormSteps steps={VERIFY_STEPS} step={steps.step} onPick={(index) => steps.move(document.querySelector('.form-wizard') as HTMLFormElement, index, VERIFY_STEPS.length)} />
      {steps.step < VERIFY_GROUPS.length && (
        <>
          <div className="lend-facts">
            {facts[steps.step].map(([label, value]) => <p key={label}><b>{label}</b> {value}</p>)}
          </div>
          <div className="app-form">
            {VERIFY_GROUPS[steps.step].map((name) => {
              const label = VERIFICATION_CHECKS.find((item) => item[0] === name)?.[1] ?? name
              return <label key={name} className="app-check"><input name={name} type="checkbox" defaultChecked={marked(name)} /> {label}</label>
            })}
          </div>
        </>
      )}
      {steps.step === VERIFY_STEPS.length - 1 && (
        <div className="app-form">
          <Field label="Result">
            <select name="result" defaultValue={kept(steps.values, 'result', saved?.result ?? 'PENDING')}>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="MORE_INFORMATION_REQUIRED">More information required</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </Field>
          <Field label="Comments" hint="optional"><input name="comments" defaultValue={kept(steps.values, 'comments', saved?.comments ?? '')} /></Field>
        </div>
      )}
      <StepNav
        step={steps.step}
        count={VERIFY_STEPS.length}
        busy={busy}
        submitLabel="Save verification"
        onBack={() => steps.move(document.querySelector('.form-wizard') as HTMLFormElement, steps.step - 1, VERIFY_STEPS.length)}
        onNext={() => steps.move(document.querySelector('.form-wizard') as HTMLFormElement, steps.step + 1, VERIFY_STEPS.length)}
      />
    </form>
  )
}

export function MemberFilePage() {
  usePageTitle('Member — UPSA Next Payment')
  const { memberId = '' } = useParams()
  const { can } = useAuth()
  const data = useLoad(() => api.membershipDesk.member(memberId), [memberId])
  const action = useAction()
  const file = data.data
  const write = can('school.write')
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the membership file.</p>
  const fee = file.fees.find((item) => item.outstanding > 0) ?? file.fees[0]
  return (
    <>
      <PageHeading kicker="Member" title={file.institutionName} lead={`${file.categoryName} · ${file.registrationNumber}`} icon="school" />
      <p><StatusPill value={file.status} /> {file.membershipNumber ?? file.memberId}{file.schoolId ? ` · school ${file.schoolId}` : ''}</p>
      <div className="app-stats">
        <p><b>Fees due</b> {money(file.feeDue, file.currency)}</p>
        <p><b>Fees collected</b> {money(file.feeCollected, file.currency)}</p>
        <p><b>Expiry</b> {file.expiryDate ?? '—'}</p>
      </div>
      {file.certificate && (
        <Panel title="Membership certificate" wide>
          <MembershipCertificate
            applicationId={file.certificate.certificateNumber}
            schoolName={file.institutionName}
            location={file.certificate.location}
            reviewedAt={file.certificate.issuedAt}
            reviewerName={file.certificate.signatory}
            reviewerTitle={file.categoryName}
            verifyUrl={file.certificate.verifyUrl}
          />
        </Panel>
      )}
      {file.verification && (
        <Panel title="Verification on file" wide>
          <p><StatusPill value={file.verification.result} /> {file.verification.officerName ? `Recorded by ${file.verification.officerName}.` : ''} {file.verification.comments}</p>
          <ul className="app-steps">
            {VERIFICATION_CHECKS.map(([name, label]) => (
              <li key={name} className={file.verification?.[name] ? 'done' : undefined}>{label}</li>
            ))}
          </ul>
        </Panel>
      )}
      {file.decision && <p>Decision: {file.decision.decision} by {file.decision.officerName}.{file.decision.conditions ? ` ${file.decision.conditions}` : ''}</p>}
      {action.error && <p className="form-error">{action.error}</p>}
      {write && (
        <>
          <Panel title="Verify this membership" wide>
            <VerificationWizard file={file} busy={action.busy} onSave={(body) => action.run(async () => { await api.membershipDesk.verify(memberId, body); data.reload() })} />
          </Panel>
          <Panel title="Membership application" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.membershipDesk.apply(memberId, { reason: str(form, 'reason'), referredBy: str(form, 'referredBy') || undefined, accurate: checked(form, 'accurate'), termsAccepted: checked(form, 'termsAccepted'), verifyAuthorized: checked(form, 'verifyAuthorized'), applicationDate: today() })
                data.reload()
              })
            })}>
              <Field label="Reason for joining"><textarea name="reason" required /></Field>
              <Field label="Referred by" hint="optional"><input name="referredBy" /></Field>
              <label className="app-check"><input name="accurate" type="checkbox" /> I confirm that the information provided is accurate.</label>
              <label className="app-check"><input name="termsAccepted" type="checkbox" /> I agree to the UPSA membership terms and conditions.</label>
              <label className="app-check"><input name="verifyAuthorized" type="checkbox" /> I authorize UPSA Next to verify the information provided.</label>
              <button className="button secondary" type="submit" disabled={action.busy}>Submit application</button>
            </form>
          </Panel>
          <Panel title="Documents" wide>
            <Table columns={['Type', 'Number', 'File', 'Status']} empty="No document is on the file." rows={file.documents.map((item) => [
              documentLabel(item.documentType),
              item.documentNumber ?? '—',
              item.hasFile
                ? <button key={item.documentId} className="app-text-btn" type="button" onClick={() => void openProtectedFile(`/membership/members/${encodeURIComponent(memberId)}/documents/${encodeURIComponent(item.documentId)}/file`)}>{item.fileName}</button>
                : item.fileName,
              item.status,
            ])} />
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              const file = form.get('file')
              action.run(async () => {
                if (!(file instanceof File) || file.size === 0) return
                const body = new FormData()
                body.set('file', file)
                const uploaded = await api.membershipDesk.upload(body)
                await api.membershipDesk.addDocument(memberId, { documentType: str(form, 'documentType'), documentNumber: str(form, 'documentNumber') || undefined, issueDate: str(form, 'issueDate') || undefined, expiryDate: str(form, 'expiryDate') || undefined, issuingAuthority: str(form, 'issuingAuthority') || undefined, fileName: uploaded.fileName, uploadId: uploaded.uploadId })
                data.reload()
              })
            })}>
              <Field label="Document type"><select name="documentType">{DOCUMENT_TYPES.map((item) => <option key={item} value={item}>{documentLabel(item)}</option>)}</select></Field>
              <Field label="Document number" hint="optional"><input name="documentNumber" /></Field>
              <Field label="Issue date" hint="optional"><input name="issueDate" type="date" /></Field>
              <Field label="Expiry date" hint="optional"><input name="expiryDate" type="date" /></Field>
              <Field label="Issuing authority" hint="optional"><input name="issuingAuthority" /></Field>
              <Field label="File"><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Upload document</button>
            </form>
            {file.documents.length > 0 && (
              <form className="app-form" onSubmit={onSubmit((event) => {
                const form = new FormData(event.currentTarget)
                action.run(async () => {
                  await api.membershipDesk.reviewDocument(memberId, str(form, 'documentId'), { status: str(form, 'status'), comment: str(form, 'comment') || undefined })
                  data.reload()
                })
              })}>
                <Field label="Document"><select name="documentId">{file.documents.map((item) => <option key={item.documentId} value={item.documentId}>{item.documentType}</option>)}</select></Field>
                <Field label="Verification status"><select name="status"><option>VERIFIED</option><option>REJECTED</option><option>PENDING</option></select></Field>
                <Field label="Comment" hint="optional"><input name="comment" /></Field>
                <button className="button secondary" type="submit" disabled={action.busy}>Update document</button>
              </form>
            )}
          </Panel>
          <Panel title="Approval" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.membershipDesk.decide(memberId, { decision: str(form, 'decision') as 'APPROVE', comment: str(form, 'comment') || undefined, conditions: str(form, 'conditions') || undefined })
                data.reload()
              })
            })}>
              <Field label="Decision"><select name="decision"><option value="APPROVE">Approve</option><option value="CONDITIONAL">Conditionally approve</option><option value="MORE_INFORMATION">Request more information</option><option value="REJECT">Reject</option></select></Field>
              <Field label="Comment" hint="optional"><input name="comment" /></Field>
              <Field label="Conditions" hint="optional"><input name="conditions" /></Field>
              <button className="button primary" type="submit" disabled={action.busy}>Record decision</button>
            </form>
          </Panel>
          <Panel title="Fee and payment" wide>
            <Table columns={['Fee', 'Payable', 'Paid', 'Outstanding', 'Status']} empty="No fee is due." rows={file.fees.map((item) => [item.feeId, money(item.totalPayable, item.currency), money(item.paid, item.currency), money(item.outstanding, item.currency), item.status])} />
            {fee && fee.outstanding > 0 && (
              <form className="app-form" onSubmit={onSubmit((event) => {
                const form = new FormData(event.currentTarget)
                action.run(async () => {
                  await api.membershipDesk.pay(memberId, { feeId: fee.feeId, amount: num(form, 'amount'), paymentMethod: str(form, 'paymentMethod'), payerName: str(form, 'payerName'), payerPhone: str(form, 'payerPhone') || undefined, paymentReference: str(form, 'paymentReference') || undefined, externalTransactionId: str(form, 'externalTransactionId') || undefined, paymentDate: today() })
                  data.reload()
                })
              })}>
                <Field label="Payer"><input name="payerName" defaultValue={file.institutionName} required /></Field>
                <Field label="Payer phone" hint="optional"><input name="payerPhone" defaultValue={file.phone} /></Field>
                <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" defaultValue={String(fee.outstanding)} required /></Field>
                <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="External transaction ID" hint="Required for a bank, PSP, mobile money, or card payment."><input name="externalTransactionId" /></Field>
                <Field label="Payment reference" hint="optional"><input name="paymentReference" /></Field>
                <button className="button primary" type="submit" disabled={action.busy}>Record payment</button>
              </form>
            )}
          </Panel>
          <Panel title="Renewal" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.membershipDesk.renew(memberId, { informationConfirmed: checked(form, 'informationConfirmed'), documentsValid: checked(form, 'documentsValid'), requirementsMet: checked(form, 'requirementsMet'), feePaid: checked(form, 'feePaid') })
                data.reload()
              })
            })}>
              <label className="app-check"><input name="informationConfirmed" type="checkbox" /> Member information confirmed</label>
              <label className="app-check"><input name="documentsValid" type="checkbox" /> Documents still valid</label>
              <label className="app-check"><input name="requirementsMet" type="checkbox" /> Membership requirements satisfied</label>
              <label className="app-check"><input name="feePaid" type="checkbox" /> Renewal fee paid, or no fee is due</label>
              <button className="button secondary" type="submit" disabled={action.busy}>Renew membership</button>
            </form>
          </Panel>
          <Panel title="Profile update" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.membershipDesk.change(memberId, { institutionName: str(form, 'institutionName') || undefined, physicalAddress: str(form, 'physicalAddress') || undefined, phone: str(form, 'phone') || undefined, email: str(form, 'email') || undefined, representativeName: str(form, 'representativeName') || undefined, bankName: str(form, 'bankName') || undefined, reason: str(form, 'reason') })
                data.reload()
              })
            })}>
              <Field label="Institution name" hint="optional"><input name="institutionName" defaultValue={file.institutionName} /></Field>
              <Field label="Address" hint="optional"><input name="physicalAddress" defaultValue={file.physicalAddress} /></Field>
              <Field label="Telephone" hint="optional"><input name="phone" defaultValue={file.phone} /></Field>
              <Field label="Email" hint="optional"><input name="email" defaultValue={file.email} /></Field>
              <Field label="Representative" hint="optional"><input name="representativeName" defaultValue={file.representativeName} /></Field>
              <Field label="Bank" hint="optional"><input name="bankName" defaultValue={file.bankName ?? ''} /></Field>
              <Field label="Reason for change"><input name="reason" required /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Save change</button>
            </form>
          </Panel>
          <Panel title="Suspension, reactivation, termination" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              const kind = str(form, 'kind')
              action.run(async () => {
                if (kind === 'SUSPEND') await api.membershipDesk.suspend(memberId, { decision: 'SUSPEND', reason: str(form, 'reason'), effectiveDate: today(), reviewDate: str(form, 'reviewDate') || undefined })
                else if (kind === 'REACTIVATE') await api.membershipDesk.reactivate(memberId, { reason: str(form, 'reason'), documentsVerified: checked(form, 'documentsVerified'), reactivationDate: today() })
                else await api.membershipDesk.terminate(memberId, { reason: str(form, 'reason'), effectiveDate: today(), refundDue: num(form, 'refundDue'), confirmed: checked(form, 'confirmed') })
                data.reload()
              })
            })}>
              <Field label="Action"><select name="kind"><option value="SUSPEND">Suspend</option><option value="REACTIVATE">Reactivate</option><option value="TERMINATE">Terminate</option></select></Field>
              <Field label="Reason"><input name="reason" required /></Field>
              <Field label="Review date" hint="optional"><input name="reviewDate" type="date" /></Field>
              <Field label="Refund due" hint="optional"><input name="refundDue" type="number" min="0" step="0.01" defaultValue="0" /></Field>
              <label className="app-check"><input name="documentsVerified" type="checkbox" /> Documents verified for reactivation</label>
              <label className="app-check"><input name="confirmed" type="checkbox" /> I confirm that the membership termination has been authorized.</label>
              <button className="button secondary" type="submit" disabled={action.busy}>Record action</button>
            </form>
          </Panel>
        </>
      )}
    </>
  )
}
