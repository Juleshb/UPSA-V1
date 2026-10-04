import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getCells, getDistricts, getProvinces, getSectors, getVillages } from 'rwanda-locations'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { api, type SchoolApplicationStatus } from '../platform/api'
import { StatusPill } from '../platform/ui'

const SCHOOL_TYPES = [
  ['NURSERY', 'Nursery'],
  ['PRIMARY', 'Primary'],
  ['SECONDARY', 'Secondary'],
  ['TVET', 'TVET'],
  ['SPECIAL_EDUCATION', 'Special education'],
  ['COMBINED', 'Combined school'],
  ['OTHER', 'Other'],
] as const

const OWNERSHIP_TYPES = [
  ['PRIVATE', 'Private'],
  ['PUBLIC', 'Public'],
  ['GOVERNMENT_AIDED', 'Government-aided'],
  ['FAITH_BASED', 'Faith-based'],
  ['COMMUNITY', 'Community'],
  ['OTHER', 'Other'],
] as const

const OPERATING_STATUSES = [
  ['OPERATING', 'Operating'],
  ['TEMPORARILY_CLOSED', 'Temporarily closed'],
  ['CLOSED', 'Closed'],
] as const

const LEGAL_STATUSES = [
  ['REGISTERED', 'Registered'],
  ['PROVISIONALLY_REGISTERED', 'Provisionally registered'],
  ['LICENSED', 'Licensed'],
  ['SUSPENDED', 'Suspended'],
  ['OTHER', 'Other'],
] as const

const POSITIONS = [
  'Owner',
  'Director',
  'Head Teacher',
  'Administrator',
  'Finance Officer',
  'Authorized Representative',
] as const

const CURRENCIES = ['RWF', 'USD', 'EUR'] as const

const LEGAL_DOCUMENTS = [
  { type: 'REGISTRATION_CERTIFICATE', label: 'Registration certificate', required: true },
  { type: 'LICENSE', label: 'Operating license', required: true },
  { type: 'TIN_CERTIFICATE', label: 'Tax certificate', required: false },
  { type: 'OWNERSHIP_DOCUMENTS', label: 'Ownership documents', required: false },
  { type: 'OTHER', label: 'Other legal documents', required: false },
] as const

const STEPS = [
  { label: 'School', title: 'Basic school information', lead: 'Use the official name and registration number. The school ID is assigned when the application is submitted.' },
  { label: 'Location', title: 'Location and contact', lead: 'Where the school operates in Rwanda, and how UPSA should reach the office.' },
  { label: 'Legal', title: 'Legal information', lead: 'Registration, licence, and tax details, with the supporting files.' },
  { label: 'Representative', title: 'Authorized representative', lead: 'The person authorized to act for the school. A representative ID is assigned on submission.' },
  { label: 'Bank', title: 'Bank account', lead: 'The account that will receive school settlements. Account verification is completed by UPSA.' },
  { label: 'Review', title: 'Review and submit', lead: 'Confirm the file before it is sent. UPSA then marks the registration pending, verified, needing more information, or rejected.' },
] as const

const STATUS_COPY: Record<string, string> = {
  APPLICATION: 'The file is still a draft.',
  SUBMITTED: 'The request was sent. The school can be approved after it has a confirmed UPSA membership.',
  DOCUMENT_REVIEW: 'Licensing and registration documents are under review.',
  PENDING_VERIFICATION: 'UPSA is checking membership.',
  VERIFICATION: 'Identity checks are underway.',
  APPROVED: 'The school is approved. Activation is the remaining step.',
  ACTIVE: 'This school is an active UPSA member on the platform.',
  SUSPENDED: 'This school file is suspended.',
  INACTIVE: 'This school file is inactive.',
}

const REVIEW_COPY: Record<string, string> = {
  PENDING: 'Registration verification is pending.',
  VERIFIED: 'The registration checklist is verified.',
  MORE_INFORMATION_REQUIRED: 'UPSA needs more information before this registration can be verified.',
  REJECTED: 'This registration was rejected.',
}

type Lookup = SchoolApplicationStatus
type Draft = {
  schoolName: string
  registrationNumber: string
  schoolType: string
  ownershipType: string
  dateEstablished: string
  operatingStatus: string
  studentCount: string
  teacherCount: string
  staffCount: string
  rupsaMemberId: string
  phone: string
  alternativePhone: string
  email: string
  website: string
  emergencyContact: string
  province: string
  district: string
  sector: string
  cell: string
  village: string
  physicalAddress: string
  gpsCoordinates: string
  postalAddress: string
  registrationCertificateNumber: string
  registrationDate: string
  registrationAuthority: string
  taxIdentificationNumber: string
  licenseNumber: string
  licenseExpiryDate: string
  legalStatus: string
  representativeName: string
  position: string
  nationalId: string
  representativePhone: string
  representativeEmail: string
  appointmentDate: string
  bankName: string
  branch: string
  accountName: string
  accountNumber: string
  currency: string
  swiftCode: string
}

function emptyDraft(): Draft {
  return {
    schoolName: '',
    registrationNumber: '',
    schoolType: '',
    ownershipType: '',
    dateEstablished: '',
    operatingStatus: '',
    studentCount: '',
    teacherCount: '',
    staffCount: '',
    rupsaMemberId: '',
    phone: '',
    alternativePhone: '',
    email: '',
    website: '',
    emergencyContact: '',
    province: '',
    district: '',
    sector: '',
    cell: '',
    village: '',
    physicalAddress: '',
    gpsCoordinates: '',
    postalAddress: '',
    registrationCertificateNumber: '',
    registrationDate: '',
    registrationAuthority: '',
    taxIdentificationNumber: '',
    licenseNumber: '',
    licenseExpiryDate: '',
    legalStatus: '',
    representativeName: '',
    position: '',
    nationalId: '',
    representativePhone: '',
    representativeEmail: '',
    appointmentDate: '',
    bankName: '',
    branch: '',
    accountName: '',
    accountNumber: '',
    currency: 'RWF',
    swiftCode: '',
  }
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function countOk(value: string, required: boolean) {
  if (!value.trim()) return !required
  return /^\d+$/.test(value.trim()) && Number(value) <= 200000
}

function notFuture(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= new Date().toISOString().slice(0, 10)
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function labelOf(options: readonly (readonly [string, string])[], value: string) {
  return options.find(([code]) => code === value)?.[1] ?? value
}

export function RegisterSchool({ embedded = false, onDismiss }: { embedded?: boolean; onDismiss?: () => void } = {}) {
  usePageTitle(embedded ? 'Online services — UPSA Next Payment' : 'Register a school — UPSA Next Payment')
  const provinces = getProvinces()
  const [open, setOpen] = useState(embedded || new URLSearchParams(window.location.search).get('apply') === '1')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [files, setFiles] = useState<Record<string, { fileName: string; uploadId: string }>>({})
  const [uploading, setUploading] = useState('')
  const [receipt, setReceipt] = useState<{
    schoolId: string
    schoolName: string
    email: string
    emailSent: boolean
    membershipStatus: string
    membershipReference: string | null
  } | null>(null)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [statusError, setStatusError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)

  const districts = draft.province ? getDistricts(draft.province) : []
  const sectors = draft.province && draft.district ? getSectors(draft.province, draft.district) : []
  const cells = draft.province && draft.district && draft.sector ? getCells(draft.province, draft.district, draft.sector) : []
  const villages = draft.province && draft.district && draft.sector && draft.cell
    ? getVillages(draft.province, draft.district, draft.sector, draft.cell)
    : []
  const current = STEPS[step]

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }))
  }

  function closeWizard() {
    if (embedded) onDismiss?.()
    else setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeWizard()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, embedded, onDismiss])

  function hasFile(type: string) {
    return Boolean(files[type]?.uploadId)
  }

  function problemAt(index: number) {
    if (index === 0) {
      if (draft.schoolName.trim().length < 2) return 'Enter the official school name.'
      if (draft.registrationNumber.trim().length < 2) return 'Enter the school registration number.'
      if (!draft.schoolType) return 'Choose the school type.'
      if (!draft.ownershipType) return 'Choose the ownership type.'
      if (!notFuture(draft.dateEstablished)) return 'Enter the date the school was established.'
      if (!draft.operatingStatus) return 'Choose the school status.'
      if (!countOk(draft.studentCount, true)) return 'Enter the number of students.'
      if (!countOk(draft.teacherCount, true)) return 'Enter the number of teachers.'
      if (!countOk(draft.staffCount, false)) return 'Enter the number of staff as a whole number, or leave it blank.'
    }
    if (index === 1) {
      if (!draft.province || !draft.district || !draft.sector || !draft.cell || !draft.village) {
        return 'Choose the province, district, sector, cell, and village.'
      }
      if (draft.physicalAddress.trim().length < 4) return 'Enter the physical address.'
      if (draft.phone.trim().length < 8) return 'Enter a school telephone number.'
      if (!emailOk(draft.email)) return 'Enter a valid school email.'
    }
    if (index === 2) {
      if (draft.registrationCertificateNumber.trim().length < 2) return 'Enter the registration certificate number.'
      if (!notFuture(draft.registrationDate)) return 'Enter the registration date.'
      if (draft.registrationAuthority.trim().length < 2) return 'Enter the registration authority.'
      if (draft.taxIdentificationNumber.trim().length < 2) return 'Enter the tax identification number.'
      if (draft.licenseNumber.trim().length < 2) return 'Enter the license number.'
      if (!isDate(draft.licenseExpiryDate)) return 'Enter the license expiry date.'
      if (!draft.legalStatus) return 'Choose the legal status.'
      if (!hasFile('REGISTRATION_CERTIFICATE') || !hasFile('LICENSE')) {
        return 'Attach the registration certificate and the operating license.'
      }
    }
    if (index === 3) {
      if (draft.representativeName.trim().length < 2) return 'Enter the representative’s full name.'
      if (!draft.position) return 'Choose the representative’s position.'
      if (draft.nationalId.trim().length < 4) return 'Enter the national ID or passport number.'
      if (draft.representativePhone.trim().length < 8) return 'Enter the representative’s telephone.'
      if (!emailOk(draft.representativeEmail)) return 'Enter a valid representative email.'
      if (!notFuture(draft.appointmentDate)) return 'Enter the appointment date.'
      if (!hasFile('AUTHORIZATION_LETTER') || !hasFile('ID_DOCUMENT')) {
        return 'Attach the authorization letter and the identity document.'
      }
    }
    if (index === 4) {
      if (draft.bankName.trim().length < 2 || draft.branch.trim().length < 2) return 'Enter the bank and the branch.'
      if (draft.accountName.trim().length < 2) return 'Enter the account name.'
      if (draft.accountNumber.trim().length < 4) return 'Enter the account number.'
      if (!draft.currency) return 'Choose the currency.'
      if (draft.swiftCode.trim() && !/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(draft.swiftCode.trim())) {
        return 'Enter an 8 or 11 character SWIFT code, or leave it blank.'
      }
      if (!hasFile('BANK_LETTER')) return 'Attach the bank confirmation letter.'
    }
    if (index === 5 && !consent) return 'Confirm that the details are accurate before submitting.'
    return ''
  }

  function goTo(next: number) {
    for (let index = 0; index < next; index += 1) {
      const problem = problemAt(index)
      if (problem) {
        setStep(index)
        setError(problem)
        return
      }
    }
    setError('')
    setStep(next)
  }

  async function attachFile(documentType: string, file: File) {
    setUploading(documentType)
    setError('')
    const body = new FormData()
    body.set('file', file)
    body.set('documentType', documentType)
    try {
      const saved = await api.schoolApplications.upload(body)
      setFiles((currentFiles) => ({ ...currentFiles, [documentType]: saved }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be attached.')
    } finally {
      setUploading('')
    }
  }

  async function submit() {
    const problem = problemAt(5)
    if (problem) {
      setError(problem)
      return
    }
    const documents = Object.entries(files)
      .filter((entry): entry is [string, { fileName: string; uploadId: string }] => Boolean(entry[1]?.uploadId))
      .map(([documentType, item]) => ({ documentType, fileName: item.fileName, uploadId: item.uploadId }))
    setBusy(true)
    setError('')
    try {
      const created = await api.schoolApplications.submit({
        schoolName: draft.schoolName.trim(),
        registrationNumber: draft.registrationNumber.trim(),
        schoolType: draft.schoolType,
        ownershipType: draft.ownershipType,
        dateEstablished: draft.dateEstablished,
        operatingStatus: draft.operatingStatus,
        studentCount: Number(draft.studentCount),
        teacherCount: Number(draft.teacherCount),
        staffCount: draft.staffCount.trim() ? Number(draft.staffCount) : undefined,
        rupsaMemberId: draft.rupsaMemberId.trim() || undefined,
        phone: draft.phone.trim(),
        alternativePhone: draft.alternativePhone.trim() || undefined,
        email: draft.email.trim(),
        website: draft.website.trim() || undefined,
        emergencyContact: draft.emergencyContact.trim() || undefined,
        address: {
          province: draft.province,
          district: draft.district,
          sector: draft.sector,
          cell: draft.cell,
          village: draft.village,
          physicalAddress: draft.physicalAddress.trim(),
          gpsCoordinates: draft.gpsCoordinates.trim() || undefined,
          postalAddress: draft.postalAddress.trim() || undefined,
        },
        taxIdentificationNumber: draft.taxIdentificationNumber.trim(),
        registrationCertificateNumber: draft.registrationCertificateNumber.trim(),
        registrationDate: draft.registrationDate,
        registrationAuthority: draft.registrationAuthority.trim(),
        licenseNumber: draft.licenseNumber.trim(),
        licenseExpiryDate: draft.licenseExpiryDate,
        legalStatus: draft.legalStatus,
        representative: {
          fullName: draft.representativeName.trim(),
          position: draft.position,
          nationalId: draft.nationalId.trim(),
          phone: draft.representativePhone.trim(),
          email: draft.representativeEmail.trim(),
          appointmentDate: draft.appointmentDate,
        },
        bankAccount: {
          bankName: draft.bankName.trim(),
          branch: draft.branch.trim(),
          accountName: draft.accountName.trim(),
          accountNumber: draft.accountNumber.trim(),
          currency: draft.currency,
          swiftCode: draft.swiftCode.trim() || undefined,
        },
        documents,
      })
      setReceipt(created)
      if (!embedded) setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The application could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  async function onStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatusBusy(true)
    setStatusError('')
    setLookup(null)
    try {
      setLookup(await api.schoolApplications.status(
        String(form.get('schoolId')).trim(),
        String(form.get('statusEmail')).trim(),
      ))
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'That application could not be found.')
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <>
    {!embedded && <main>
      <PageHero
        kicker="Member schools"
        title="Register your school."
        lead="Submit the school profile, location, legal papers, authorized representative, and bank account. UPSA verifies the file before the school becomes active."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Register a school' }]}
        image="/images/scene-schools.png"
        imageAlt="A school administrator preparing a member registration"
      />
      <section className="page-block alt">
        <div className="register-landing">
          <article className="register-card">
            <p className="eyebrow"><span /> Application</p>
            <h2>The registration file.</h2>
            <ol className="register-preview">
              {STEPS.map((item) => <li key={item.label}>{item.label}</li>)}
            </ol>
            {receipt ? (
              <div className="form-success" role="status">
                <h3>Application received.</h3>
                <p>{receipt.schoolName} was sent to UPSA. School ID <strong>{receipt.schoolId}</strong>.</p>
                <p>Registration verification is pending until a UPSA reviewer completes the checklist.</p>
                <p>{membershipNote(receipt.membershipStatus, receipt.membershipReference)}</p>
                <p>
                  {receipt.emailSent
                    ? `A confirmation was sent to ${receipt.email}.`
                    : `The request is saved. The confirmation email to ${receipt.email} could not be sent.`}
                </p>
                {receipt.membershipStatus !== 'VERIFIED' && (
                  <MembershipLink
                    schoolId={receipt.schoolId}
                    email={receipt.email}
                    onLinked={(next) => setReceipt((currentReceipt) => currentReceipt ? { ...currentReceipt, ...next } : currentReceipt)}
                  />
                )}
                <p><Link className="button secondary" to="/membership">Become a UPSA member</Link></p>
              </div>
            ) : (
              <button className="button primary" type="button" onClick={() => { setError(''); setOpen(true) }}>
                Start application
              </button>
            )}
          </article>

          <form className="contact-form" onSubmit={onStatus}>
            <p className="eyebrow"><span /> Already applied</p>
            <h2>Check status</h2>
            <p className="register-note">Use the school ID from your confirmation and the school email on the application.</p>
            {statusError && <p className="form-error" role="alert">{statusError}</p>}
            <div className="field">
              <label htmlFor="schoolId">School ID</label>
              <input id="schoolId" name="schoolId" required placeholder="RUPSA-SCH-000123" defaultValue={receipt?.schoolId} key={receipt?.schoolId ?? 'blank'} />
            </div>
            <div className="field">
              <label htmlFor="statusEmail">School email</label>
              <input id="statusEmail" name="statusEmail" type="email" required placeholder="office@school.rw" defaultValue={receipt?.email} key={receipt?.email ?? 'blank-email'} />
            </div>
            <button className="button primary" type="submit" disabled={statusBusy}>{statusBusy ? 'Checking…' : 'Check application'}</button>
            {lookup && (
              <div className="form-success" role="status">
                <h3>{lookup.schoolName}</h3>
                <p>{lookup.schoolId}</p>
                <p>{STATUS_COPY[lookup.status] ?? 'UPSA is processing this file.'}</p>
                <p>{REVIEW_COPY[lookup.reviewStatus] ?? 'UPSA is reviewing this registration.'}</p>
                <p>{membershipNote(lookup.membershipStatus, lookup.membershipReference)}</p>
                <p className="register-pills">
                  <StatusPill value={lookup.status} />
                  <StatusPill value={lookup.reviewStatus} />
                  <StatusPill value={lookup.membershipStatus} />
                  <StatusPill value={lookup.kybStatus} />
                </p>
                {lookup.membershipStatus !== 'VERIFIED' && (
                  <MembershipLink schoolId={lookup.schoolId} email={lookup.email} onLinked={setLookup} />
                )}
              </div>
            )}
          </form>
        </div>
      </section>
    </main>}

      {open && createPortal(
        <div className="wizard-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWizard() }}>
          <div className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
            <aside className="wizard-rail">
              <div>
                <p>Member school</p>
                <strong>Registration</strong>
              </div>
              <ol>
                {STEPS.map((item, index) => {
                  const state = index === step ? 'current' : index < step && !problemAt(index) ? 'done' : ''
                  return (
                    <li key={item.label}>
                      <button className={state} type="button" onClick={() => goTo(index)}>
                        <i>{state === 'done' ? '✓' : index + 1}</i>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              <button className="wizard-dismiss" type="button" onClick={closeWizard}>Close</button>
            </aside>
            <div className="wizard-main">
              <header>
                <div className="wizard-kicker">
                  <p>Step {step + 1} of {STEPS.length}</p>
                  <button className="text-action" type="button" onClick={closeWizard}>Close</button>
                </div>
                <h2 id="wizard-title">{current.title}</h2>
                <p>{current.lead}</p>
                <div className="wizard-progress" aria-hidden="true">
                  <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
                </div>
              </header>
              <div className="wizard-body">
                {embedded && receipt ? (
                  <div className="form-success" role="status">
                    <h3>Application received.</h3>
                    <p>{receipt.schoolName} was sent to UPSA. School ID <strong>{receipt.schoolId}</strong>.</p>
                    <p>Registration verification is pending until a UPSA reviewer completes the checklist.</p>
                  </div>
                ) : (
                <>
                {error && <p className="wizard-alert" role="alert">{error}</p>}
                {step === 0 && (
                  <>
                    <FormSection title="Identity" note="Use the name and number printed on the official papers.">
                      <Field label="School ID" htmlFor="schoolIdPreview" locked hint="Assigned automatically when you submit.">
                        <input id="schoolIdPreview" value="Assigned on submission" disabled />
                      </Field>
                      <Field label="School registration number" htmlFor="registrationNumber" hint="The number on the school’s official registration papers.">
                        <input id="registrationNumber" autoComplete="off" value={draft.registrationNumber} onChange={(event) => set('registrationNumber', event.target.value)} placeholder="Number printed on the certificate" autoFocus />
                      </Field>
                      <Field label="School name" htmlFor="schoolName">
                        <input id="schoolName" autoComplete="organization" value={draft.schoolName} onChange={(event) => set('schoolName', event.target.value)} placeholder="Green Hills Academy" />
                      </Field>
                    </FormSection>
                    <FormSection title="Classification">
                      <div className="field-row">
                        <Field label="School type" htmlFor="schoolType">
                          <select id="schoolType" value={draft.schoolType} onChange={(event) => set('schoolType', event.target.value)}>
                            <option value="">Select type</option>
                            {SCHOOL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </Field>
                        <Field label="Ownership type" htmlFor="ownershipType">
                          <select id="ownershipType" value={draft.ownershipType} onChange={(event) => set('ownershipType', event.target.value)}>
                            <option value="">Select ownership</option>
                            {OWNERSHIP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Date established" htmlFor="dateEstablished">
                          <input id="dateEstablished" type="date" value={draft.dateEstablished} onChange={(event) => set('dateEstablished', event.target.value)} />
                        </Field>
                        <Field label="School status" htmlFor="operatingStatus">
                          <select id="operatingStatus" value={draft.operatingStatus} onChange={(event) => set('operatingStatus', event.target.value)}>
                            <option value="">Select status</option>
                            {OPERATING_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </Field>
                      </div>
                    </FormSection>
                    <FormSection title="Size">
                      <div className="field-row thirds">
                        <Field label="Students" htmlFor="studentCount">
                          <input id="studentCount" inputMode="numeric" value={draft.studentCount} onChange={(event) => set('studentCount', event.target.value)} placeholder="0" />
                        </Field>
                        <Field label="Teachers" htmlFor="teacherCount">
                          <input id="teacherCount" inputMode="numeric" value={draft.teacherCount} onChange={(event) => set('teacherCount', event.target.value)} placeholder="0" />
                        </Field>
                        <Field label="Staff" htmlFor="staffCount" optional>
                          <input id="staffCount" inputMode="numeric" value={draft.staffCount} onChange={(event) => set('staffCount', event.target.value)} placeholder="0" />
                        </Field>
                      </div>
                    </FormSection>
                    <FormSection title="Membership" note="The school can be approved only after a confirmed membership is linked.">
                      <Field
                        label="UPSA membership reference"
                        htmlFor="rupsaMemberId"
                        optional
                        hint={<>Enter a reference such as RUPSA-MBA-000002, or leave this blank and add it later. <Link to="/membership" target="_blank" rel="noreferrer">Become a UPSA member</Link></>}
                      >
                        <input id="rupsaMemberId" value={draft.rupsaMemberId} onChange={(event) => set('rupsaMemberId', event.target.value)} placeholder="RUPSA-MBA-000002" />
                      </Field>
                    </FormSection>
                  </>
                )}
                {step === 1 && (
                  <>
                    <FormSection title="Administrative address" note="Choose each level in order. The next list opens after the one above it.">
                      <div className="field-row">
                        <Field label="Province" htmlFor="province">
                          <select id="province" value={draft.province} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, province: event.target.value, district: '', sector: '', cell: '', village: '' }))}>
                            <option value="">Select province</option>
                            {provinces.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                        <Field label="District" htmlFor="district">
                          <select id="district" value={draft.district} disabled={!draft.province} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, district: event.target.value, sector: '', cell: '', village: '' }))}>
                            <option value="">{draft.province ? 'Select district' : 'Choose a province first'}</option>
                            {districts.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Sector" htmlFor="sector">
                          <select id="sector" value={draft.sector} disabled={!draft.district} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, sector: event.target.value, cell: '', village: '' }))}>
                            <option value="">{draft.district ? 'Select sector' : 'Choose a district first'}</option>
                            {sectors.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                        <Field label="Cell" htmlFor="cell">
                          <select id="cell" value={draft.cell} disabled={!draft.sector} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, cell: event.target.value, village: '' }))}>
                            <option value="">{draft.sector ? 'Select cell' : 'Choose a sector first'}</option>
                            {cells.map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </Field>
                      </div>
                      <Field label="Village" htmlFor="village">
                        <select id="village" value={draft.village} disabled={!draft.cell} onChange={(event) => set('village', event.target.value)}>
                          <option value="">{draft.cell ? 'Select village' : 'Choose a cell first'}</option>
                          {villages.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                      <Field label="Physical address" htmlFor="physicalAddress">
                        <input id="physicalAddress" autoComplete="street-address" value={draft.physicalAddress} onChange={(event) => set('physicalAddress', event.target.value)} placeholder="Street, plot, or landmark" />
                      </Field>
                      <div className="field-row">
                        <Field label="GPS coordinates" htmlFor="gpsCoordinates" optional hint="Latitude and longitude.">
                          <input id="gpsCoordinates" value={draft.gpsCoordinates} onChange={(event) => set('gpsCoordinates', event.target.value)} placeholder="-1.9441, 30.0619" />
                        </Field>
                        <Field label="Postal address" htmlFor="postalAddress" optional>
                          <input id="postalAddress" autoComplete="postal-code" value={draft.postalAddress} onChange={(event) => set('postalAddress', event.target.value)} placeholder="P.O. Box" />
                        </Field>
                      </div>
                    </FormSection>
                    <FormSection title="Office contact" note="UPSA uses these details for this application.">
                      <div className="field-row">
                        <Field label="Telephone" htmlFor="phone">
                          <input id="phone" type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => set('phone', event.target.value)} placeholder="+250 788 000 000" />
                        </Field>
                        <Field label="Alternative telephone" htmlFor="alternativePhone" optional>
                          <input id="alternativePhone" type="tel" autoComplete="tel" value={draft.alternativePhone} onChange={(event) => set('alternativePhone', event.target.value)} placeholder="+250 788 000 000" />
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Email" htmlFor="email">
                          <input id="email" type="email" autoComplete="email" value={draft.email} onChange={(event) => set('email', event.target.value)} placeholder="office@school.rw" />
                        </Field>
                        <Field label="Website" htmlFor="website" optional>
                          <input id="website" type="url" autoComplete="url" value={draft.website} onChange={(event) => set('website', event.target.value)} placeholder="https://school.rw" />
                        </Field>
                      </div>
                      <Field label="Emergency contact" htmlFor="emergencyContact" optional hint="Name and telephone.">
                        <input id="emergencyContact" value={draft.emergencyContact} onChange={(event) => set('emergencyContact', event.target.value)} placeholder="Aline Mukamana, +250 788 000 000" />
                      </Field>
                    </FormSection>
                  </>
                )}
                {step === 2 && (
                  <>
                    <FormSection title="Registration">
                      <Field label="Registration certificate number" htmlFor="registrationCertificateNumber">
                        <input id="registrationCertificateNumber" value={draft.registrationCertificateNumber} onChange={(event) => set('registrationCertificateNumber', event.target.value)} placeholder="Certificate number" autoFocus />
                      </Field>
                      <div className="field-row">
                        <Field label="Registration date" htmlFor="registrationDate">
                          <input id="registrationDate" type="date" value={draft.registrationDate} onChange={(event) => set('registrationDate', event.target.value)} />
                        </Field>
                        <Field label="Registration authority" htmlFor="registrationAuthority">
                          <input id="registrationAuthority" value={draft.registrationAuthority} onChange={(event) => set('registrationAuthority', event.target.value)} placeholder="Rwanda Development Board" />
                        </Field>
                      </div>
                    </FormSection>
                    <FormSection title="Licence and tax">
                      <Field label="Tax identification number" htmlFor="taxIdentificationNumber" hint="Issued by the Rwanda Revenue Authority.">
                        <input id="taxIdentificationNumber" value={draft.taxIdentificationNumber} onChange={(event) => set('taxIdentificationNumber', event.target.value)} placeholder="TIN" />
                      </Field>
                      <div className="field-row">
                        <Field label="License number" htmlFor="licenseNumber">
                          <input id="licenseNumber" value={draft.licenseNumber} onChange={(event) => set('licenseNumber', event.target.value)} placeholder="Operating licence number" />
                        </Field>
                        <Field label="License expiry date" htmlFor="licenseExpiryDate">
                          <input id="licenseExpiryDate" type="date" value={draft.licenseExpiryDate} onChange={(event) => set('licenseExpiryDate', event.target.value)} />
                        </Field>
                      </div>
                      <Field label="Legal status" htmlFor="legalStatus">
                        <select id="legalStatus" value={draft.legalStatus} onChange={(event) => set('legalStatus', event.target.value)}>
                          <option value="">Select legal status</option>
                          {LEGAL_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </Field>
                    </FormSection>
                    <FormSection title="Supporting documents" note="PDF, PNG, or JPEG. The certificate and operating licence are required.">
                      <div className="file-list">
                        {LEGAL_DOCUMENTS.map((document) => (
                          <FileAttach
                            key={document.type}
                            id={document.type}
                            label={document.label}
                            required={document.required}
                            fileName={uploading === document.type ? 'Uploading…' : files[document.type]?.fileName ?? ''}
                            onPick={(file) => void attachFile(document.type, file)}
                            onClear={() => clearFile(document.type, setFiles)}
                          />
                        ))}
                      </div>
                    </FormSection>
                  </>
                )}
                {step === 3 && (
                  <>
                    <FormSection title="Person" note="The person authorized to act for the school.">
                      <Field label="Representative ID" htmlFor="representativeId" locked hint="Assigned automatically when you submit.">
                        <input id="representativeId" value="Assigned on submission" disabled />
                      </Field>
                      <div className="field-row">
                        <Field label="Full name" htmlFor="representativeName">
                          <input id="representativeName" autoComplete="name" value={draft.representativeName} onChange={(event) => set('representativeName', event.target.value)} placeholder="Full name" autoFocus />
                        </Field>
                        <Field label="Position" htmlFor="position">
                          <select id="position" value={draft.position} onChange={(event) => set('position', event.target.value)}>
                            <option value="">Select position</option>
                            {POSITIONS.map((position) => <option key={position}>{position}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="National ID or passport" htmlFor="nationalId">
                          <input id="nationalId" autoComplete="off" value={draft.nationalId} onChange={(event) => set('nationalId', event.target.value)} placeholder="ID or passport number" />
                        </Field>
                        <Field label="Appointment date" htmlFor="appointmentDate">
                          <input id="appointmentDate" type="date" value={draft.appointmentDate} onChange={(event) => set('appointmentDate', event.target.value)} />
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Telephone" htmlFor="representativePhone">
                          <input id="representativePhone" type="tel" autoComplete="tel" value={draft.representativePhone} onChange={(event) => set('representativePhone', event.target.value)} placeholder="+250 788 000 000" />
                        </Field>
                        <Field label="Email" htmlFor="representativeEmail">
                          <input id="representativeEmail" type="email" autoComplete="email" value={draft.representativeEmail} onChange={(event) => set('representativeEmail', event.target.value)} placeholder="name@school.rw" />
                        </Field>
                      </div>
                    </FormSection>
                    <FormSection title="Authority documents" note="Both files are required.">
                      <div className="file-list">
                        <FileAttach
                          id="AUTHORIZATION_LETTER"
                          label="Authorization letter"
                          required
                          fileName={uploading === 'AUTHORIZATION_LETTER' ? 'Uploading…' : files.AUTHORIZATION_LETTER?.fileName ?? ''}
                          onPick={(file) => void attachFile('AUTHORIZATION_LETTER', file)}
                          onClear={() => clearFile('AUTHORIZATION_LETTER', setFiles)}
                        />
                        <FileAttach
                          id="ID_DOCUMENT"
                          label="ID document"
                          required
                          fileName={uploading === 'ID_DOCUMENT' ? 'Uploading…' : files.ID_DOCUMENT?.fileName ?? ''}
                          onPick={(file) => void attachFile('ID_DOCUMENT', file)}
                          onClear={() => clearFile('ID_DOCUMENT', setFiles)}
                        />
                      </div>
                    </FormSection>
                  </>
                )}
                {step === 4 && (
                  <>
                    <FormSection title="Settlement account" note="This is the account that will receive school settlements. UPSA verifies it after submission.">
                      <div className="field-row">
                        <Field label="Bank name" htmlFor="bankName">
                          <input id="bankName" value={draft.bankName} onChange={(event) => set('bankName', event.target.value)} placeholder="Bank of Kigali" autoFocus />
                        </Field>
                        <Field label="Branch" htmlFor="branch">
                          <input id="branch" value={draft.branch} onChange={(event) => set('branch', event.target.value)} placeholder="Kicukiro" />
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Account name" htmlFor="accountName">
                          <input id="accountName" value={draft.accountName} onChange={(event) => set('accountName', event.target.value)} placeholder="Name on the account" />
                        </Field>
                        <Field label="Account number" htmlFor="accountNumber">
                          <input id="accountNumber" inputMode="numeric" autoComplete="off" value={draft.accountNumber} onChange={(event) => set('accountNumber', event.target.value)} placeholder="Account number" />
                        </Field>
                      </div>
                      <div className="field-row">
                        <Field label="Currency" htmlFor="currency">
                          <select id="currency" value={draft.currency} onChange={(event) => set('currency', event.target.value)}>
                            {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                          </select>
                        </Field>
                        <Field label="SWIFT code" htmlFor="swiftCode" optional hint="For an international account.">
                          <input id="swiftCode" value={draft.swiftCode} onChange={(event) => set('swiftCode', event.target.value.toUpperCase())} placeholder="BKIGRWRW" />
                        </Field>
                      </div>
                    </FormSection>
                    <FormSection title="Confirmation" note="A letter from the bank confirming this account.">
                      <FileAttach
                        id="BANK_LETTER"
                        label="Bank confirmation letter"
                        required
                        fileName={uploading === 'BANK_LETTER' ? 'Uploading…' : files.BANK_LETTER?.fileName ?? ''}
                        onPick={(file) => void attachFile('BANK_LETTER', file)}
                        onClear={() => clearFile('BANK_LETTER', setFiles)}
                      />
                    </FormSection>
                  </>
                )}
                {step === 5 && (
                  <>
                    <FormSection title="School">
                      <dl className="wizard-summary">
                        <div><dt>Name</dt><dd>{draft.schoolName || '—'}</dd></div>
                        <div><dt>Registration number</dt><dd>{draft.registrationNumber || '—'}</dd></div>
                        <div><dt>Type</dt><dd>{labelOf(SCHOOL_TYPES, draft.schoolType) || '—'}</dd></div>
                        <div><dt>Ownership</dt><dd>{labelOf(OWNERSHIP_TYPES, draft.ownershipType) || '—'}</dd></div>
                        <div><dt>Status</dt><dd>{labelOf(OPERATING_STATUSES, draft.operatingStatus) || '—'}</dd></div>
                        <div><dt>Students / teachers</dt><dd>{draft.studentCount || '—'} / {draft.teacherCount || '—'}</dd></div>
                      </dl>
                    </FormSection>
                    <FormSection title="Location and contact">
                      <dl className="wizard-summary">
                        <div><dt>Address</dt><dd>{[draft.physicalAddress, draft.village, draft.cell, draft.sector, draft.district, draft.province].filter(Boolean).join(', ') || '—'}</dd></div>
                        <div><dt>Email</dt><dd>{draft.email || '—'}</dd></div>
                        <div><dt>Telephone</dt><dd>{draft.phone || '—'}</dd></div>
                      </dl>
                    </FormSection>
                    <FormSection title="Representative and bank">
                      <dl className="wizard-summary">
                        <div><dt>Representative</dt><dd>{draft.representativeName ? `${draft.representativeName}, ${draft.position}` : '—'}</dd></div>
                        <div><dt>Bank</dt><dd>{draft.bankName ? `${draft.bankName}, ${draft.branch}` : '—'}</dd></div>
                        <div><dt>Account</dt><dd>{draft.accountNumber ? `${draft.accountName} · ${draft.accountNumber} · ${draft.currency}` : '—'}</dd></div>
                        <div><dt>Documents</dt><dd>{Object.values(files).filter((item) => item?.uploadId).length} attached</dd></div>
                      </dl>
                    </FormSection>
                    <label className="consent">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                      <span>I confirm these details are accurate and that UPSA may review them for membership and identity verification.</span>
                    </label>
                  </>
                )}
                </>
                )}
              </div>
              {embedded && receipt ? (
                <footer className="wizard-foot">
                  <button className="button secondary" type="button" onClick={closeWizard}>Close</button>
                </footer>
              ) : (
              <footer className="wizard-foot">
                <button className="button secondary" type="button" disabled={step === 0} onClick={() => goTo(step - 1)}>Back</button>
                {step < STEPS.length - 1 ? (
                  <button className="button primary" type="button" onClick={() => goTo(step + 1)}>Continue</button>
                ) : (
                  <button className="button primary" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit application'}</button>
                )}
              </footer>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function clearFile(
  type: string,
  setFiles: (update: (currentFiles: Record<string, { fileName: string; uploadId: string }>) => Record<string, { fileName: string; uploadId: string }>) => void,
) {
  const input = document.getElementById(type) as HTMLInputElement | null
  if (input) input.value = ''
  setFiles((currentFiles) => {
    const next = { ...currentFiles }
    delete next[type]
    return next
  })
}

function FileAttach({
  id,
  label,
  required = false,
  fileName,
  onPick,
  onClear,
}: {
  id: string
  label: string
  required?: boolean
  fileName: string
  onPick: (file: File) => void
  onClear: () => void
}) {
  const attached = Boolean(fileName) && fileName !== 'Uploading…'
  return (
    <div className={`file-attach${attached ? ' has-file' : ''}${fileName === 'Uploading…' ? ' is-uploading' : ''}`}>
      <span className="file-attach-mark" aria-hidden="true">{attached ? '✓' : '↑'}</span>
      <div>
        <strong>
          {label}
          <em>{required ? 'Required' : 'Optional'}</em>
        </strong>
        <span>{fileName || 'PDF, PNG, or JPEG'}</span>
      </div>
      <div className="file-attach-actions">
        <label className="file-attach-btn" htmlFor={id}>{fileName ? 'Replace' : 'Attach'}</label>
        {fileName && <button className="text-action" type="button" onClick={onClear}>Remove</button>}
      </div>
      <input
        id={id}
        className="file-attach-input"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
        }}
      />
    </div>
  )
}

function membershipNote(status: string, reference: string | null) {
  if (status === 'VERIFIED' && reference) return `Confirmed membership ${reference} is linked. UPSA can verify this school.`
  if (reference) return `Membership ${reference} is linked and still in review. This school can be approved after a UPSA reader confirms it.`
  return 'No membership is linked yet. The request stays waiting, and the school can be approved after you add a confirmed membership reference.'
}

function MembershipLink({
  schoolId,
  email,
  onLinked,
}: {
  schoolId: string
  email: string
  onLinked: (next: SchoolApplicationStatus) => void
}) {
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLinked(await api.schoolApplications.linkMembership(schoolId, {
        email,
        membershipReference: reference.trim(),
      }))
      setReference('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That membership could not be linked.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <Field label="Add UPSA membership" htmlFor={`link-${schoolId}`} hint="Enter the membership reference after UPSA confirms it, or while it is still in review.">
        <input id={`link-${schoolId}`} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="RUPSA-MBA-000002" required />
      </Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button secondary" type="submit" disabled={busy}>{busy ? 'Linking…' : 'Add membership'}</button>
    </form>
  )
}

function FormSection({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="form-section">
      <header>
        <h3>{title}</h3>
        {note && <p>{note}</p>}
      </header>
      <div className="form-section-body">{children}</div>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  optional = false,
  locked = false,
  children,
}: {
  label: string
  htmlFor: string
  hint?: ReactNode
  optional?: boolean
  locked?: boolean
  children: ReactNode
}) {
  return (
    <div className={`field${locked ? ' is-locked' : ''}${optional ? ' is-optional' : ''}`}>
      <label htmlFor={htmlFor}>
        <span>{label}</span>
        {locked ? <em>Automatic</em> : optional ? <em>Optional</em> : <i aria-hidden="true">*</i>}
      </label>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  )
}
