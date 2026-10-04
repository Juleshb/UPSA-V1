import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getCells, getDistricts, getProvinces, getSectors } from 'rwanda-locations'
import { MembershipCertificate } from '../components/MembershipCertificate'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { api, type MembershipStatus } from '../platform/api'
import { money } from '../platform/format'
import { DOCUMENT_LABELS, ELECTRONIC_PAYMENTS, INSTITUTION_LABELS, INSTITUTION_TYPES, PAYMENT_LABELS, PAYMENT_METHODS, documentLabel } from './app/membership/catalog'

const STEPS = [
  { label: 'Institution', title: 'Institution', lead: 'The school that is asking to join, and the membership it is requesting.' },
  { label: 'Location', title: 'Location', lead: 'Where the school operates in Rwanda.' },
  { label: 'Contact', title: 'Contact and legal', lead: 'How UPSA reaches the school, and the registration on file.' },
  { label: 'Bank', title: 'Bank account', lead: 'The account that belongs to the institution. Leave this blank if it is not ready.' },
  { label: 'Representative', title: 'Representative', lead: 'The person authorized to speak for the school.' },
  { label: 'Documents', title: 'Documents', lead: 'Upload the documents required for this membership. PDF, PNG, or JPEG.' },
  { label: 'Payment', title: 'Membership fee', lead: 'The fee for this category is collected before the request can be submitted.' },
  { label: 'Confirm', title: 'Confirm', lead: 'Check the details, then submit the membership request.' },
] as const

type Category = {
  code: string
  name: string
  eligibility: string | null
  membershipFee: number
  currency: string
  requirements: { documentType: string; mandatory: boolean }[]
}

type Draft = {
  categoryCode: string
  schoolName: string
  registrationNumber: string
  institutionType: string
  dateEstablished: string
  studentCount: string
  staffCount: string
  province: string
  district: string
  sector: string
  cell: string
  village: string
  physicalAddress: string
  phone: string
  email: string
  website: string
  postalAddress: string
  alternativePhone: string
  registrationCertificateNumber: string
  registrationDate: string
  taxIdentificationNumber: string
  issuingAuthority: string
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
  bankBranch: string
  currency: string
  representativeName: string
  representativePosition: string
  representativeNationalId: string
  representativePhone: string
  representativeEmail: string
  message: string
  paymentMethod: string
  payerName: string
  payerPhone: string
  paymentReference: string
  externalTransactionId: string
}

const EMPTY: Draft = {
  categoryCode: '',
  schoolName: '',
  registrationNumber: '',
  institutionType: 'SECONDARY',
  dateEstablished: '',
  studentCount: '',
  staffCount: '',
  province: '',
  district: '',
  sector: '',
  cell: '',
  village: '',
  physicalAddress: '',
  phone: '',
  email: '',
  website: '',
  postalAddress: '',
  alternativePhone: '',
  registrationCertificateNumber: '',
  registrationDate: '',
  taxIdentificationNumber: '',
  issuingAuthority: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankBranch: '',
  currency: 'RWF',
  representativeName: '',
  representativePosition: '',
  representativeNationalId: '',
  representativePhone: '',
  representativeEmail: '',
  message: '',
  paymentMethod: 'BANK_TRANSFER',
  payerName: '',
  payerPhone: '',
  paymentReference: '',
  externalTransactionId: '',
}

type Receipt = {
  applicationId: string
  schoolName: string
  email: string
  status: string
  emailSent: boolean
  feeAmount?: number
  currency?: string
  paymentStatus?: string | null
  contactName?: string | null
  title?: string | null
  location?: string | null
  reviewedAt?: string | null
  reviewerName?: string | null
  reviewerTitle?: string | null
  verifyUrl?: string | null
}
type Lookup = MembershipStatus

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function BecomeMember({ embedded = false, onDismiss }: { embedded?: boolean; onDismiss?: () => void } = {}) {
  usePageTitle(embedded ? 'Online services — UPSA Next Payment' : 'Become a UPSA member — UPSA Next Payment')
  const params = new URLSearchParams(window.location.search)
  const linkedReference = params.get('reference') ?? ''
  const linkedEmail = params.get('email') ?? ''
  const provinces = getProvinces()
  const [open, setOpen] = useState(embedded || params.get('apply') === '1')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [categories, setCategories] = useState<Category[]>([])
  const [files, setFiles] = useState<Record<string, { fileName: string; uploadId: string }>>({})
  const [uploading, setUploading] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [statusError, setStatusError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)

  const districts = draft.province ? getDistricts(draft.province) ?? [] : []
  const sectors = draft.province && draft.district ? getSectors(draft.province, draft.district) ?? [] : []
  const cells = draft.province && draft.district && draft.sector ? getCells(draft.province, draft.district, draft.sector) ?? [] : []
  const current = STEPS[step]
  const category = categories.find((item) => item.code === draft.categoryCode)
  const requirements = category?.requirements ?? []
  const tracked = lookup && receipt && lookup.applicationId === receipt.applicationId
    ? { ...receipt, ...lookup, emailSent: receipt.emailSent }
    : receipt
  const certificate = lookup?.status === 'CONFIRMED'
    ? lookup
    : tracked?.status === 'CONFIRMED'
      ? tracked
      : null

  useEffect(() => {
    let active = true
    void api.membershipApplications.categories()
      .then((next) => {
        if (active) setCategories(next.items)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!linkedReference || !linkedEmail) return
    let active = true
    setStatusBusy(true)
    void api.membershipApplications.status(linkedReference, linkedEmail)
      .then((next) => {
        if (active) setLookup(next)
      })
      .catch((err) => {
        if (active) setStatusError(err instanceof Error ? err.message : 'That membership request could not be found.')
      })
      .finally(() => {
        if (active) setStatusBusy(false)
      })
    return () => {
      active = false
    }
  }, [linkedEmail, linkedReference])

  useEffect(() => {
    if (!tracked || tracked.status !== 'SUBMITTED') return
    const timer = window.setInterval(() => {
      void api.membershipApplications.status(tracked.applicationId, tracked.email)
        .then((next) => {
          setReceipt((currentReceipt) => currentReceipt && currentReceipt.applicationId === next.applicationId
            ? { ...currentReceipt, ...next }
            : currentReceipt)
          setLookup((currentLookup) => (
            currentLookup && currentLookup.applicationId !== next.applicationId ? currentLookup : next
          ))
        })
        .catch(() => undefined)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [tracked?.applicationId, tracked?.email, tracked?.status])

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

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }))
  }

  function problemAt(index: number) {
    if (index === 0) {
      if (!draft.categoryCode) return 'Choose a membership category.'
      if (draft.schoolName.trim().length < 2) return 'Enter the official school name.'
      if (draft.registrationNumber.trim().length < 2) return 'Enter the registration number.'
    }
    if (index === 1 && (!draft.province || !draft.district || !draft.sector || !draft.cell || draft.physicalAddress.trim().length < 2)) {
      return 'Choose the province, district, sector, and cell, and enter the physical address.'
    }
    if (index === 2) {
      if (draft.phone.trim().length < 8) return 'Enter the official telephone.'
      if (!EMAIL.test(draft.email.trim())) return 'Enter a valid email address.'
      if (draft.registrationCertificateNumber.trim().length < 2) return 'Enter the registration certificate number.'
    }
    if (index === 4) {
      if (draft.representativeName.trim().length < 2) return 'Enter the representative’s name.'
      if (draft.representativePosition.trim().length < 2) return 'Enter the representative’s position.'
      if (draft.representativePhone.trim().length < 8) return 'Enter the representative’s telephone.'
      if (!EMAIL.test(draft.representativeEmail.trim())) return 'Enter the representative’s email address.'
    }
    if (index === 5) {
      const missing = requirements.filter((item) => item.mandatory && !files[item.documentType]?.uploadId)
      if (missing.length > 0) return `Attach ${missing.map((item) => documentLabel(item.documentType).toLowerCase()).join(', ')}.`
      if (requirements.length === 0 && !Object.values(files).some((item) => item.uploadId)) return 'Attach the registration certificate.'
    }
    if (index === 6 && (category?.membershipFee ?? 0) > 0) {
      if (!draft.paymentMethod) return 'Choose how the membership fee is paid.'
      if (draft.payerName.trim().length < 2) return 'Enter the name of the person or school paying the fee.'
      if (ELECTRONIC_PAYMENTS.has(draft.paymentMethod) && draft.externalTransactionId.trim().length < 3) {
        return 'Enter the external transaction ID for this payment.'
      }
    }
    if (index === 7 && !consent) return 'Confirm that the details are accurate before submitting.'
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
    if (next === 6) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        payerName: currentDraft.payerName || currentDraft.schoolName,
        payerPhone: currentDraft.payerPhone || currentDraft.phone,
      }))
    }
    setStep(next)
  }

  async function attachFile(documentType: string, file: File) {
    setUploading(documentType)
    setError('')
    const body = new FormData()
    body.set('file', file)
    try {
      const saved = await api.membershipApplications.upload(body)
      setFiles((currentFiles) => ({ ...currentFiles, [documentType]: saved }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be attached.')
    } finally {
      setUploading('')
    }
  }

  function clearFile(documentType: string) {
    const input = document.getElementById(`member-file-${documentType}`) as HTMLInputElement | null
    if (input) input.value = ''
    setFiles((currentFiles) => {
      const next = { ...currentFiles }
      delete next[documentType]
      return next
    })
  }

  async function submit() {
    const problem = problemAt(7)
    if (problem) {
      setError(problem)
      return
    }
    const documents = (requirements.length > 0 ? requirements.map((item) => item.documentType) : Object.keys(files))
      .filter((documentType) => files[documentType]?.uploadId)
      .map((documentType) => ({ documentType, fileName: files[documentType].fileName, uploadId: files[documentType].uploadId }))
    setBusy(true)
    setError('')
    try {
      const created = await api.membershipApplications.submit({
        schoolName: draft.schoolName.trim(),
        registrationNumber: draft.registrationNumber.trim(),
        categoryCode: draft.categoryCode,
        institutionType: draft.institutionType,
        dateEstablished: draft.dateEstablished || undefined,
        studentCount: draft.studentCount ? Number(draft.studentCount) : undefined,
        staffCount: draft.staffCount ? Number(draft.staffCount) : undefined,
        contactName: draft.representativeName.trim(),
        title: draft.representativePosition.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        website: draft.website.trim() || undefined,
        postalAddress: draft.postalAddress.trim() || undefined,
        alternativePhone: draft.alternativePhone.trim() || undefined,
        registrationCertificateNumber: draft.registrationCertificateNumber.trim(),
        registrationDate: draft.registrationDate || undefined,
        taxIdentificationNumber: draft.taxIdentificationNumber.trim() || undefined,
        issuingAuthority: draft.issuingAuthority.trim() || undefined,
        bankName: draft.bankName.trim() || undefined,
        bankAccountName: draft.bankAccountName.trim() || undefined,
        bankAccountNumber: draft.bankAccountNumber.trim() || undefined,
        bankBranch: draft.bankBranch.trim() || undefined,
        currency: draft.currency.trim() || 'RWF',
        representativeNationalId: draft.representativeNationalId.trim() || undefined,
        representativePhone: draft.representativePhone.trim(),
        representativeEmail: draft.representativeEmail.trim(),
        address: {
          province: draft.province,
          district: draft.district,
          sector: draft.sector,
          cell: draft.cell,
          village: draft.village.trim() || undefined,
          physicalAddress: draft.physicalAddress.trim(),
        },
        documents,
        message: draft.message.trim() || undefined,
        payment: (category?.membershipFee ?? 0) > 0 ? {
          paymentMethod: draft.paymentMethod,
          payerName: draft.payerName.trim(),
          payerPhone: draft.payerPhone.trim() || undefined,
          paymentReference: draft.paymentReference.trim() || undefined,
          externalTransactionId: draft.externalTransactionId.trim() || undefined,
        } : undefined,
      })
      setReceipt({ ...created, contactName: draft.representativeName.trim(), title: draft.representativePosition.trim() })
      setLookup(null)
      if (!embedded) setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The membership request could not be submitted.')
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
      const next = await api.membershipApplications.status(
        String(form.get('applicationId')).trim(),
        String(form.get('statusEmail')).trim(),
      )
      setLookup(next)
      setReceipt((currentReceipt) => currentReceipt && currentReceipt.applicationId === next.applicationId
        ? { ...currentReceipt, ...next }
        : currentReceipt)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'That membership request could not be found.')
    } finally {
      setStatusBusy(false)
    }
  }

  const shownDocuments = requirements.length > 0
    ? requirements
    : Object.keys(DOCUMENT_LABELS).map((documentType) => ({ documentType, mandatory: documentType === 'REGISTRATION_CERTIFICATE' }))

  return (
    <>
    {!embedded && <main>
      <PageHero
        kicker="UPSA membership"
        title="Become a UPSA member."
        lead="Submit the same registration an officer records, including the required documents and the membership fee. It stays in review until a UPSA administrator confirms it."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Become a UPSA member' }]}
        image="/images/scene-schools.png"
        imageAlt="A school campus preparing to join the association"
      />
      <section className="page-block alt">
        <div className="register-landing">
          <article className="register-card">
            <p className="eyebrow"><span /> Membership</p>
            <h2>The full registration.</h2>
            <ol className="register-preview">
              {STEPS.map((item) => <li key={item.label}>{item.label}</li>)}
            </ol>
            {tracked ? (
              <RequestState item={tracked} emailSent={tracked.emailSent} />
            ) : (
              <button className="button primary" type="button" onClick={() => { setError(''); setOpen(true) }}>
                Start membership request
              </button>
            )}
          </article>
          <form className="contact-form" onSubmit={(event) => void onStatus(event)}>
            <p className="eyebrow"><span /> Track a request</p>
            <h2>Reference code</h2>
            <p className="register-note">Use the reference from your email and the address on the request. A UPSA administrator confirms it. Submission does not accept the school.</p>
            {statusError && <p className="form-error" role="alert">{statusError}</p>}
            <div className="field">
              <label htmlFor="applicationId">Reference code</label>
              <input id="applicationId" name="applicationId" required placeholder="RUPSA-MBA-000002" defaultValue={tracked?.applicationId || linkedReference} key={tracked?.applicationId || linkedReference || 'blank'} />
            </div>
            <div className="field">
              <label htmlFor="statusEmail">Email</label>
              <input id="statusEmail" name="statusEmail" type="email" required placeholder="office@school.rw" defaultValue={tracked?.email || linkedEmail} key={tracked?.email || linkedEmail || 'blank-email'} />
            </div>
            <button className="button primary" type="submit" disabled={statusBusy}>{statusBusy ? 'Checking…' : 'Track request'}</button>
            {lookup && lookup.applicationId !== receipt?.applicationId && (
              <RequestState item={{ ...lookup, emailSent: false }} />
            )}
          </form>
        </div>
        {certificate && (
          <MembershipCertificate
            applicationId={certificate.applicationId}
            schoolName={certificate.schoolName}
            contactName={certificate.contactName}
            title={certificate.title}
            location={certificate.location}
            reviewedAt={certificate.reviewedAt}
            reviewerName={certificate.reviewerName}
            reviewerTitle={certificate.reviewerTitle}
            verifyUrl={certificate.verifyUrl}
          />
        )}
      </section>
    </main>}

      {open && createPortal(
        <div className="wizard-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWizard() }}>
          <div className="wizard" role="dialog" aria-modal="true" aria-labelledby="member-wizard-title">
            <aside className="wizard-rail">
              <div>
                <p>UPSA</p>
                <strong>Membership</strong>
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
                <h2 id="member-wizard-title">{current.title}</h2>
                <p>{current.lead}</p>
              </header>
              <div className="wizard-body">
                {embedded && receipt ? (
                  <RequestState item={receipt} emailSent={receipt.emailSent} />
                ) : (
                <>
                {error && <p className="form-error" role="alert">{error}</p>}
                {step === 0 && (
                  <>
                    <Field label="Membership category" htmlFor="member-category">
                      <select id="member-category" value={draft.categoryCode} onChange={(event) => set('categoryCode', event.target.value)}>
                        <option value="">Select a category</option>
                        {categories.map((item) => <option key={item.code} value={item.code}>{item.name} · {money(item.membershipFee, item.currency)}</option>)}
                      </select>
                    </Field>
                    {category?.eligibility && <p className="register-note">{category.eligibility}</p>}
                    <Field label="Institution name" htmlFor="member-school">
                      <input id="member-school" value={draft.schoolName} onChange={(event) => set('schoolName', event.target.value)} placeholder="Green Hills Academy" />
                    </Field>
                    <div className="field-row">
                      <Field label="Registration number" htmlFor="member-registration">
                        <input id="member-registration" value={draft.registrationNumber} onChange={(event) => set('registrationNumber', event.target.value)} placeholder="SCH-20126" />
                      </Field>
                      <Field label="Institution type" htmlFor="member-type">
                        <select id="member-type" value={draft.institutionType} onChange={(event) => set('institutionType', event.target.value)}>
                          {INSTITUTION_TYPES.map((item) => <option key={item} value={item}>{INSTITUTION_LABELS[item] ?? item}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div className="field-row">
                      <Field label="Date established" htmlFor="member-established" hint="Optional.">
                        <input id="member-established" type="date" value={draft.dateEstablished} onChange={(event) => set('dateEstablished', event.target.value)} />
                      </Field>
                      <Field label="Number of students" htmlFor="member-students" hint="Optional.">
                        <input id="member-students" type="number" min="0" value={draft.studentCount} onChange={(event) => set('studentCount', event.target.value)} />
                      </Field>
                    </div>
                    <Field label="Number of staff" htmlFor="member-staff" hint="Optional.">
                      <input id="member-staff" type="number" min="0" value={draft.staffCount} onChange={(event) => set('staffCount', event.target.value)} />
                    </Field>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="field-row">
                      <Field label="Province" htmlFor="member-province">
                        <select id="member-province" value={draft.province} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, province: event.target.value, district: '', sector: '', cell: '' }))}>
                          <option value="">Select province</option>
                          {provinces.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                      <Field label="District" htmlFor="member-district">
                        <select id="member-district" value={draft.district} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, district: event.target.value, sector: '', cell: '' }))}>
                          <option value="">Select district</option>
                          {districts.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div className="field-row">
                      <Field label="Sector" htmlFor="member-sector">
                        <select id="member-sector" value={draft.sector} onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, sector: event.target.value, cell: '' }))}>
                          <option value="">Select sector</option>
                          {sectors.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                      <Field label="Cell" htmlFor="member-cell">
                        <select id="member-cell" value={draft.cell} onChange={(event) => set('cell', event.target.value)}>
                          <option value="">Select cell</option>
                          {cells.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Village" htmlFor="member-village" hint="Optional.">
                      <input id="member-village" value={draft.village} onChange={(event) => set('village', event.target.value)} />
                    </Field>
                    <Field label="Physical address" htmlFor="member-address">
                      <input id="member-address" value={draft.physicalAddress} onChange={(event) => set('physicalAddress', event.target.value)} placeholder="KG 278 St" />
                    </Field>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="field-row">
                      <Field label="Official telephone" htmlFor="member-phone">
                        <input id="member-phone" value={draft.phone} onChange={(event) => set('phone', event.target.value)} placeholder="+250 788 000 000" />
                      </Field>
                      <Field label="Email" htmlFor="member-email">
                        <input id="member-email" type="email" value={draft.email} onChange={(event) => set('email', event.target.value)} placeholder="office@school.rw" />
                      </Field>
                    </div>
                    <div className="field-row">
                      <Field label="Website" htmlFor="member-website" hint="Optional.">
                        <input id="member-website" value={draft.website} onChange={(event) => set('website', event.target.value)} placeholder="https://" />
                      </Field>
                      <Field label="P.O. Box" htmlFor="member-postal" hint="Optional.">
                        <input id="member-postal" value={draft.postalAddress} onChange={(event) => set('postalAddress', event.target.value)} />
                      </Field>
                    </div>
                    <Field label="Alternative telephone" htmlFor="member-alt-phone" hint="Optional.">
                      <input id="member-alt-phone" value={draft.alternativePhone} onChange={(event) => set('alternativePhone', event.target.value)} />
                    </Field>
                    <div className="field-row">
                      <Field label="Registration certificate number" htmlFor="member-certificate">
                        <input id="member-certificate" value={draft.registrationCertificateNumber} onChange={(event) => set('registrationCertificateNumber', event.target.value)} />
                      </Field>
                      <Field label="Registration date" htmlFor="member-registered" hint="Optional.">
                        <input id="member-registered" type="date" value={draft.registrationDate} onChange={(event) => set('registrationDate', event.target.value)} />
                      </Field>
                    </div>
                    <div className="field-row">
                      <Field label="Tax identification number" htmlFor="member-tin" hint="Optional.">
                        <input id="member-tin" value={draft.taxIdentificationNumber} onChange={(event) => set('taxIdentificationNumber', event.target.value)} />
                      </Field>
                      <Field label="Issuing authority" htmlFor="member-authority" hint="Optional.">
                        <input id="member-authority" value={draft.issuingAuthority} onChange={(event) => set('issuingAuthority', event.target.value)} placeholder="Rwanda Development Board" />
                      </Field>
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <div className="field-row">
                      <Field label="Bank name" htmlFor="member-bank" hint="Optional.">
                        <input id="member-bank" value={draft.bankName} onChange={(event) => set('bankName', event.target.value)} placeholder="Bank of Kigali" />
                      </Field>
                      <Field label="Account name" htmlFor="member-account-name" hint="Optional.">
                        <input id="member-account-name" value={draft.bankAccountName} onChange={(event) => set('bankAccountName', event.target.value)} />
                      </Field>
                    </div>
                    <div className="field-row">
                      <Field label="Account number" htmlFor="member-account" hint="Optional.">
                        <input id="member-account" value={draft.bankAccountNumber} onChange={(event) => set('bankAccountNumber', event.target.value)} />
                      </Field>
                      <Field label="Branch" htmlFor="member-branch" hint="Optional.">
                        <input id="member-branch" value={draft.bankBranch} onChange={(event) => set('bankBranch', event.target.value)} />
                      </Field>
                    </div>
                    <Field label="Currency" htmlFor="member-currency">
                      <input id="member-currency" value={draft.currency} onChange={(event) => set('currency', event.target.value)} />
                    </Field>
                  </>
                )}
                {step === 4 && (
                  <>
                    <div className="field-row">
                      <Field label="Full name" htmlFor="member-rep">
                        <input id="member-rep" value={draft.representativeName} onChange={(event) => set('representativeName', event.target.value)} />
                      </Field>
                      <Field label="Position" htmlFor="member-position">
                        <input id="member-position" value={draft.representativePosition} onChange={(event) => set('representativePosition', event.target.value)} placeholder="Head teacher" />
                      </Field>
                    </div>
                    <Field label="National ID or passport" htmlFor="member-nid" hint="Optional.">
                      <input id="member-nid" value={draft.representativeNationalId} onChange={(event) => set('representativeNationalId', event.target.value)} />
                    </Field>
                    <div className="field-row">
                      <Field label="Telephone" htmlFor="member-rep-phone">
                        <input id="member-rep-phone" value={draft.representativePhone} onChange={(event) => set('representativePhone', event.target.value)} placeholder="+250 788 000 000" />
                      </Field>
                      <Field label="Email" htmlFor="member-rep-email">
                        <input id="member-rep-email" type="email" value={draft.representativeEmail} onChange={(event) => set('representativeEmail', event.target.value)} />
                      </Field>
                    </div>
                  </>
                )}
                {step === 5 && (
                  <div className="file-list">
                    {shownDocuments.map((document) => (
                      <FileAttach
                        key={document.documentType}
                        id={`member-file-${document.documentType}`}
                        label={documentLabel(document.documentType)}
                        required={document.mandatory}
                        fileName={uploading === document.documentType ? 'Uploading…' : files[document.documentType]?.fileName ?? ''}
                        onPick={(file) => void attachFile(document.documentType, file)}
                        onClear={() => clearFile(document.documentType)}
                      />
                    ))}
                  </div>
                )}
                {step === 6 && (
                  <>
                    <p className="register-note">
                      {(category?.membershipFee ?? 0) > 0
                        ? `${category?.name ?? 'This category'} requires ${money(category?.membershipFee ?? 0, category?.currency ?? 'RWF')} before the request is accepted.`
                        : 'This category has no membership fee.'}
                    </p>
                    {(category?.membershipFee ?? 0) > 0 && (
                      <>
                        <Field label="Payment method" htmlFor="member-pay-method">
                          <select id="member-pay-method" value={draft.paymentMethod} onChange={(event) => set('paymentMethod', event.target.value)}>
                            {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{PAYMENT_LABELS[item] ?? item}</option>)}
                          </select>
                        </Field>
                        <div className="field-row">
                          <Field label="Payer" htmlFor="member-payer">
                            <input id="member-payer" value={draft.payerName} onChange={(event) => set('payerName', event.target.value)} />
                          </Field>
                          <Field label="Payer telephone" htmlFor="member-payer-phone" hint="Optional.">
                            <input id="member-payer-phone" value={draft.payerPhone} onChange={(event) => set('payerPhone', event.target.value)} />
                          </Field>
                        </div>
                        <Field label="External transaction ID" htmlFor="member-txn" hint={ELECTRONIC_PAYMENTS.has(draft.paymentMethod) ? 'Required for a bank, mobile money, card, or payment-service transfer.' : 'Optional for cash.'}>
                          <input id="member-txn" value={draft.externalTransactionId} onChange={(event) => set('externalTransactionId', event.target.value)} placeholder="TX-MEM-1005" />
                        </Field>
                        <Field label="Payment reference" htmlFor="member-pay-ref" hint="Optional.">
                          <input id="member-pay-ref" value={draft.paymentReference} onChange={(event) => set('paymentReference', event.target.value)} />
                        </Field>
                      </>
                    )}
                  </>
                )}
                {step === 7 && (
                  <>
                    <dl className="wizard-summary">
                      <div><dt>School</dt><dd>{draft.schoolName || '—'}</dd></div>
                      <div><dt>Category</dt><dd>{category?.name ?? '—'}</dd></div>
                      <div><dt>Registration</dt><dd>{draft.registrationNumber || '—'}</dd></div>
                      <div><dt>Representative</dt><dd>{draft.representativeName || '—'}</dd></div>
                      <div><dt>Email</dt><dd>{draft.email || '—'}</dd></div>
                      <div><dt>Location</dt><dd>{[draft.cell, draft.sector, draft.district, draft.province].filter(Boolean).join(', ') || '—'}</dd></div>
                      <div><dt>Documents</dt><dd>{Object.values(files).filter((item) => item.uploadId).length} attached</dd></div>
                      <div><dt>Fee</dt><dd>{(category?.membershipFee ?? 0) > 0 ? `${money(category?.membershipFee ?? 0, category?.currency ?? 'RWF')} · ${PAYMENT_LABELS[draft.paymentMethod] ?? draft.paymentMethod}` : 'No fee'}</dd></div>
                    </dl>
                    <Field label="Message" htmlFor="member-message" hint="Optional.">
                      <textarea id="member-message" value={draft.message} onChange={(event) => set('message', event.target.value)} placeholder="Anything UPSA should know about this membership request." />
                    </Field>
                    <label className="consent">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                      <span>I confirm these details are accurate, the documents belong to this institution, and UPSA may contact this school about membership.</span>
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
                <button className="button secondary" type="button" disabled={step === 0 || busy} onClick={() => goTo(step - 1)}>Back</button>
                {step < STEPS.length - 1 ? (
                  <button className="button primary" type="button" onClick={() => goTo(step + 1)}>Continue</button>
                ) : (
                  <button className="button primary" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit membership request'}</button>
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

function RequestState({
  item,
  emailSent = false,
}: {
  item: { applicationId: string; schoolName: string; email: string; status: string; emailSent?: boolean; feeAmount?: number; currency?: string }
  emailSent?: boolean
}) {
  if (item.status === 'CONFIRMED') {
    return (
      <div className="form-success" role="status">
        <h3>Membership confirmed.</h3>
        <p>A UPSA administrator confirmed {item.schoolName}. The certificate is below.</p>
        <p>Reference <strong>{item.applicationId}</strong>.</p>
      </div>
    )
  }
  if (item.status === 'REJECTED') {
    return (
      <div className="review-pending" role="status">
        <h3>Not confirmed.</h3>
        <p>A UPSA administrator did not confirm {item.schoolName}.</p>
        <p>Reference <strong>{item.applicationId}</strong>.</p>
      </div>
    )
  }
  return (
    <div className="review-pending" role="status">
      <span className="review-spinner" aria-hidden="true" />
      <h3>Request submitted.</h3>
      <p>{item.schoolName} is in review. An administrator has not confirmed this membership yet.</p>
      <p>Reference <strong>{item.applicationId}</strong>. Keep this code to track the request.</p>
      {item.feeAmount ? <p>The membership fee of <strong>{money(item.feeAmount, item.currency ?? 'RWF')}</strong> was received with this request.</p> : null}
      <p>
        {(emailSent || item.emailSent)
          ? `A notice was sent to ${item.email}. It is not an acceptance.`
          : `Use ${item.email} with the reference code to track this request.`}
      </p>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  )
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
