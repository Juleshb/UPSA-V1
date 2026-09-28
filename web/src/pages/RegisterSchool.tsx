import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getDistricts, getProvinces, getSectors } from 'rwanda-locations'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { api, type SchoolApplicationStatus } from '../platform/api'
import { StatusPill } from '../platform/ui'

const DOCUMENTS = [
  { type: 'REGISTRATION_CERTIFICATE', label: 'Registration certificate' },
  { type: 'LICENSE', label: 'Operating licence' },
  { type: 'TIN_CERTIFICATE', label: 'TIN certificate' },
  { type: 'RUPSA_MEMBERSHIP', label: 'UPSA membership letter' },
  { type: 'OWNER_IDENTITY', label: 'Owner identity' },
  { type: 'BANK_LETTER', label: 'Bank confirmation letter' },
] as const

const STEPS = [
  { label: 'School', title: 'School profile', lead: 'Use the name and number printed on the school’s official registration papers.' },
  { label: 'Contact', title: 'Contact', lead: 'The office phone and email UPSA should use for this application.' },
  { label: 'Location', title: 'School location', lead: 'Where the school operates in Rwanda.' },
  { label: 'Ownership', title: 'Ownership', lead: 'Each owner and their share. The total cannot exceed 100 percent.' },
  { label: 'Leadership', title: 'Management and signatories', lead: 'Who runs the school, and who is authorized to sign for it.' },
  { label: 'Bank', title: 'Bank account', lead: 'The account that will receive school settlements.' },
  { label: 'Documents', title: 'Documents', lead: 'Attach at least one licensing or registration file, then confirm the application.' },
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

type PersonDraft = { key: string; fullName: string; title: string; phone: string; email: string }
type OwnerDraft = { key: string; ownerName: string; ownershipPct: string; nationalId: string }
type Lookup = SchoolApplicationStatus

function person(): PersonDraft {
  return { key: crypto.randomUUID(), fullName: '', title: '', phone: '', email: '' }
}

function owner(): OwnerDraft {
  return { key: crypto.randomUUID(), ownerName: '', ownershipPct: '', nationalId: '' }
}

function filledPerson(row: PersonDraft) {
  return row.fullName.trim().length >= 2 && row.title.trim().length >= 2
}

function emailOk(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function RegisterSchool() {
  usePageTitle('Register a school — UPSA Next Payment')
  const provinces = getProvinces()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [taxIdentificationNumber, setTaxIdentificationNumber] = useState('')
  const [rupsaMemberId, setRupsaMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [sector, setSector] = useState('')
  const [owners, setOwners] = useState<OwnerDraft[]>([owner()])
  const [managers, setManagers] = useState<PersonDraft[]>([person()])
  const [signatories, setSignatories] = useState<PersonDraft[]>([person()])
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
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

  const districts = province ? getDistricts(province) : []
  const sectors = province && district ? getSectors(province, district) : []
  const current = STEPS[step]

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function problemAt(index: number) {
    if (index === 0) {
      if (schoolName.trim().length < 2) return 'Enter the official school name.'
      if (registrationNumber.trim().length < 2) return 'Enter the registration number.'
    }
    if (index === 1) {
      if (phone.trim().length < 8) return 'Enter a school phone number.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid school email.'
    }
    if (index === 2 && (!province || !district)) return 'Choose the province and district.'
    if (index === 3) {
      const ready = owners.filter((row) => row.ownerName.trim() && row.ownershipPct.trim())
      if (ready.length < 1) return 'Add at least one owner.'
      const shares = ready.map((row) => Number(row.ownershipPct))
      if (shares.some((share) => !Number.isFinite(share) || share <= 0 || share > 100)) {
        return 'Each ownership share must be between 1 and 100 percent.'
      }
      if (shares.reduce((sum, share) => sum + share, 0) > 100) return 'Ownership shares cannot add up to more than 100 percent.'
    }
    if (index === 4) {
      const readyManagers = managers.filter(filledPerson)
      const readySignatories = signatories.filter(filledPerson)
      if (readyManagers.length < 1) return 'Add at least one manager.'
      if (readySignatories.length < 1) return 'Add at least one authorized signatory.'
      if ([...readyManagers, ...readySignatories].some((row) => !emailOk(row.email))) return 'Check the email addresses for leadership.'
    }
    if (index === 5) {
      if (bankName.trim().length < 2 || accountName.trim().length < 2) return 'Enter the bank and the account name.'
      if (accountNumber.trim().length < 4) return 'Enter the account number.'
    }
    if (index === 6) {
      if (!Object.values(files).some((item) => item?.uploadId)) return 'Attach at least one licensing or registration document.'
      if (!consent) return 'Confirm that the details are accurate before submitting.'
    }
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
    const problem = problemAt(6)
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
        schoolName: schoolName.trim(),
        registrationNumber: registrationNumber.trim(),
        taxIdentificationNumber: taxIdentificationNumber.trim() || undefined,
        rupsaMemberId: rupsaMemberId.trim() || undefined,
        phone: phone.trim(),
        email: email.trim(),
        address: { province, district, sector: sector || undefined },
        owners: owners.filter((row) => row.ownerName.trim() && row.ownershipPct.trim()).map((row) => ({
          ownerName: row.ownerName.trim(),
          ownershipPct: Number(row.ownershipPct),
          nationalId: row.nationalId.trim() || undefined,
        })),
        management: managers.filter(filledPerson).map((row) => ({
          fullName: row.fullName.trim(),
          title: row.title.trim(),
          phone: row.phone.trim() || undefined,
          email: row.email.trim() || undefined,
        })),
        signatories: signatories.filter(filledPerson).map((row) => ({
          fullName: row.fullName.trim(),
          title: row.title.trim(),
          phone: row.phone.trim() || undefined,
          email: row.email.trim() || undefined,
        })),
        bankAccount: {
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          currency: 'RWF',
        },
        documents,
      })
      setReceipt(created)
      setOpen(false)
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
    <main>
      <PageHero
        kicker="Member schools"
        title="Register your school."
        lead="Apply in a few short steps. UPSA reviews membership and identity before the school becomes active."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Register a school' }]}
        image="/images/scene-schools.png"
        imageAlt="A school administrator preparing a member registration"
      />
      <section className="page-block alt">
        <div className="register-landing">
          <article className="register-card">
            <p className="eyebrow"><span /> Application</p>
            <h2>Seven short steps.</h2>
            <ol className="register-preview">
              {STEPS.map((item) => <li key={item.label}>{item.label}</li>)}
            </ol>
            {receipt ? (
              <div className="form-success" role="status">
                <h3>Application received.</h3>
                <p>{receipt.schoolName} was sent to UPSA. Reference <strong>{receipt.schoolId}</strong>.</p>
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
                    onLinked={(next) => setReceipt((current) => current ? { ...current, ...next } : current)}
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
            <p className="register-note">Use the reference from your confirmation and the school email on the application.</p>
            {statusError && <p className="form-error" role="alert">{statusError}</p>}
            <div className="field">
              <label htmlFor="schoolId">Application reference</label>
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
                <p>{membershipNote(lookup.membershipStatus, lookup.membershipReference)}</p>
                <p className="register-pills">
                  <StatusPill value={lookup.status} />
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

      {open && createPortal(
        <div className="wizard-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
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
              <button className="wizard-dismiss" type="button" onClick={() => setOpen(false)}>Close</button>
            </aside>
            <div className="wizard-main">
              <header>
                <div className="wizard-kicker">
                  <p>Step {step + 1} of {STEPS.length}</p>
                  <button className="text-action" type="button" onClick={() => setOpen(false)}>Close</button>
                </div>
                <h2 id="wizard-title">{current.title}</h2>
                <p>{current.lead}</p>
              </header>
              <div className="wizard-body">
                {error && <p className="form-error" role="alert">{error}</p>}
                {step === 0 && (
                  <>
                    <Field label="School name" htmlFor="schoolName">
                      <input id="schoolName" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Green Hills Academy" autoFocus />
                    </Field>
                    <Field
                      label="Registration number"
                      htmlFor="registrationNumber"
                      hint="Copy it from the school’s operating licence issued by the Ministry of Education, or from the Rwanda Development Board (RDB) certificate of registration. It is also printed on the registration certificate you will attach later. This is not the TIN and not the UPSA member ID."
                    >
                      <input id="registrationNumber" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="Number printed on the licence" />
                    </Field>
                    <Field label="Tax identification number" htmlFor="taxIdentificationNumber" hint="From the Rwanda Revenue Authority. Optional at this step.">
                      <input id="taxIdentificationNumber" value={taxIdentificationNumber} onChange={(event) => setTaxIdentificationNumber(event.target.value)} placeholder="TIN from RRA" />
                    </Field>
                    <Field
                      label="UPSA membership reference"
                      htmlFor="rupsaMemberId"
                      hint={<>If this school already has a confirmed membership, enter that reference, such as RUPSA-MBA-000002. Leave it blank to send the request now and add membership later. The school can be approved only after membership is confirmed. <Link to="/membership" target="_blank" rel="noreferrer">Become a UPSA member</Link></>}
                    >
                      <input id="rupsaMemberId" value={rupsaMemberId} onChange={(event) => setRupsaMemberId(event.target.value)} placeholder="RUPSA-MBA-000002" />
                    </Field>
                  </>
                )}
                {step === 1 && (
                  <div className="field-row">
                    <Field label="Phone" htmlFor="phone">
                      <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 788 000 000" autoFocus />
                    </Field>
                    <Field label="Email" htmlFor="email">
                      <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="office@school.rw" />
                    </Field>
                  </div>
                )}
                {step === 2 && (
                  <>
                    <div className="field-row">
                      <Field label="Province" htmlFor="province">
                        <select id="province" value={province} onChange={(event) => { setProvince(event.target.value); setDistrict(''); setSector('') }}>
                          <option value="">Select province</option>
                          {provinces.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                      <Field label="District" htmlFor="district">
                        <select id="district" value={district} onChange={(event) => { setDistrict(event.target.value); setSector('') }}>
                          <option value="">Select district</option>
                          {districts.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Sector" htmlFor="sector">
                      <select id="sector" value={sector} onChange={(event) => setSector(event.target.value)}>
                        <option value="">Select sector</option>
                        {sectors.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Field>
                  </>
                )}
                {step === 3 && (
                  <>
                    {owners.map((row) => (
                      <div className="repeat-card" key={row.key}>
                        <div className="field-row">
                          <Field label="Owner name" htmlFor={`${row.key}-name`}>
                            <input id={`${row.key}-name`} value={row.ownerName} onChange={(event) => setOwners((items) => items.map((item) => item.key === row.key ? { ...item, ownerName: event.target.value } : item))} />
                          </Field>
                          <Field label="Ownership %" htmlFor={`${row.key}-pct`}>
                            <input id={`${row.key}-pct`} inputMode="decimal" value={row.ownershipPct} onChange={(event) => setOwners((items) => items.map((item) => item.key === row.key ? { ...item, ownershipPct: event.target.value } : item))} />
                          </Field>
                        </div>
                        <Field label="National ID" htmlFor={`${row.key}-id`}>
                          <input id={`${row.key}-id`} value={row.nationalId} onChange={(event) => setOwners((items) => items.map((item) => item.key === row.key ? { ...item, nationalId: event.target.value } : item))} />
                        </Field>
                        {owners.length > 1 && (
                          <button className="text-action" type="button" onClick={() => setOwners((items) => items.filter((item) => item.key !== row.key))}>Remove owner</button>
                        )}
                      </div>
                    ))}
                    <button className="text-action" type="button" onClick={() => setOwners((items) => [...items, owner()])}>Add another owner</button>
                  </>
                )}
                {step === 4 && (
                  <>
                    <PersonList title="Management" hint="Head teacher, director or bursar." people={managers} onChange={setManagers} />
                    <PersonList title="Authorized signatories" hint="People allowed to sign for the school." people={signatories} onChange={setSignatories} />
                  </>
                )}
                {step === 5 && (
                  <>
                    <Field label="Bank" htmlFor="bankName">
                      <input id="bankName" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Bank of Kigali" autoFocus />
                    </Field>
                    <div className="field-row">
                      <Field label="Account name" htmlFor="accountName">
                        <input id="accountName" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
                      </Field>
                      <Field label="Account number" htmlFor="accountNumber">
                        <input id="accountNumber" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
                      </Field>
                    </div>
                  </>
                )}
                {step === 6 && (
                  <>
                    <dl className="wizard-summary">
                      <div><dt>School</dt><dd>{schoolName || '—'}</dd></div>
                      <div><dt>Registration</dt><dd>{registrationNumber || '—'}</dd></div>
                      <div><dt>Location</dt><dd>{[sector, district, province].filter(Boolean).join(', ') || '—'}</dd></div>
                      <div><dt>Contact</dt><dd>{email || '—'}</dd></div>
                      <div><dt>Bank</dt><dd>{bankName || '—'}</dd></div>
                    </dl>
                    <div className="file-list">
                      {DOCUMENTS.map((document) => (
                        <FileAttach
                          key={document.type}
                          id={document.type}
                          label={document.label}
                          fileName={uploading === document.type ? 'Uploading…' : files[document.type]?.fileName ?? ''}
                          onPick={(file) => void attachFile(document.type, file)}
                          onClear={() => setFiles((currentFiles) => {
                            const next = { ...currentFiles }
                            delete next[document.type]
                            return next
                          })}
                        />
                      ))}
                    </div>
                    <label className="consent">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                      <span>I confirm these details are accurate and that UPSA may review them for membership and identity verification.</span>
                    </label>
                  </>
                )}
              </div>
              <footer className="wizard-foot">
                <button className="button secondary" type="button" disabled={step === 0} onClick={() => goTo(step - 1)}>Back</button>
                {step < STEPS.length - 1 ? (
                  <button className="button primary" type="button" onClick={() => goTo(step + 1)}>Continue</button>
                ) : (
                  <button className="button primary" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit application'}</button>
                )}
              </footer>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </main>
  )
}

function FileAttach({
  id,
  label,
  fileName,
  onPick,
  onClear,
}: {
  id: string
  label: string
  fileName: string
  onPick: (file: File) => void
  onClear: () => void
}) {
  return (
    <div className={`file-attach${fileName ? ' has-file' : ''}`}>
      <span className="file-attach-mark" aria-hidden="true">{fileName ? '✓' : '↑'}</span>
      <div>
        <strong>{label}</strong>
        <span>{fileName || 'No file attached'}</span>
      </div>
      <div className="file-attach-actions">
        <label className="file-attach-btn" htmlFor={id}>{fileName ? 'Replace' : 'Attach'}</label>
        {fileName && (
          <button
            className="text-action"
            type="button"
            onClick={() => {
              const input = document.getElementById(id) as HTMLInputElement | null
              if (input) input.value = ''
              onClear()
            }}
          >
            Remove
          </button>
        )}
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

function PersonList({
  title,
  hint,
  people,
  onChange,
}: {
  title: string
  hint: string
  people: PersonDraft[]
  onChange: (next: PersonDraft[]) => void
}) {
  return (
    <div className="wizard-group">
      <div className="register-section">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>
      {people.map((row) => (
        <div className="repeat-card" key={row.key}>
          <div className="field-row">
            <Field label="Full name" htmlFor={`${row.key}-name`}>
              <input id={`${row.key}-name`} value={row.fullName} onChange={(event) => onChange(people.map((item) => item.key === row.key ? { ...item, fullName: event.target.value } : item))} />
            </Field>
            <Field label="Title" htmlFor={`${row.key}-title`}>
              <input id={`${row.key}-title`} value={row.title} onChange={(event) => onChange(people.map((item) => item.key === row.key ? { ...item, title: event.target.value } : item))} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Phone" htmlFor={`${row.key}-phone`}>
              <input id={`${row.key}-phone`} value={row.phone} onChange={(event) => onChange(people.map((item) => item.key === row.key ? { ...item, phone: event.target.value } : item))} />
            </Field>
            <Field label="Email" htmlFor={`${row.key}-email`}>
              <input id={`${row.key}-email`} type="email" value={row.email} onChange={(event) => onChange(people.map((item) => item.key === row.key ? { ...item, email: event.target.value } : item))} />
            </Field>
          </div>
          {people.length > 1 && (
            <button className="text-action" type="button" onClick={() => onChange(people.filter((item) => item.key !== row.key))}>Remove</button>
          )}
        </div>
      ))}
      <button className="text-action" type="button" onClick={() => onChange([...people, person()])}>Add another</button>
    </div>
  )
}
