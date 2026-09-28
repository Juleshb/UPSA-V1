import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getDistricts, getProvinces, getSectors } from 'rwanda-locations'
import { MembershipCertificate } from '../components/MembershipCertificate'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { api, type MembershipStatus } from '../platform/api'

const STEPS = [
  { label: 'School', title: 'School', lead: 'The school that is asking to join UPSA.' },
  { label: 'Contact', title: 'Contact', lead: 'Who UPSA should write to about this request.' },
  { label: 'Location', title: 'School location', lead: 'Where the school operates in Rwanda.' },
  { label: 'Confirm', title: 'Confirm', lead: 'Check the details, then submit the membership request.' },
] as const

type Receipt = {
  applicationId: string
  schoolName: string
  email: string
  status: string
  emailSent: boolean
  contactName?: string | null
  title?: string | null
  location?: string | null
  reviewedAt?: string | null
  reviewerName?: string | null
  reviewerTitle?: string | null
  verifyUrl?: string | null
}
type Lookup = MembershipStatus

export function BecomeMember() {
  usePageTitle('Become a UPSA member — UPSA Next Payment')
  const params = new URLSearchParams(window.location.search)
  const linkedReference = params.get('reference') ?? ''
  const linkedEmail = params.get('email') ?? ''
  const provinces = getProvinces()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [schoolName, setSchoolName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [contactName, setContactName] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [sector, setSector] = useState('')
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [statusError, setStatusError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)

  const districts = province ? getDistricts(province) : []
  const sectors = province && district ? getSectors(province, district) : []
  const current = STEPS[step]
  const tracked = lookup && receipt && lookup.applicationId === receipt.applicationId
    ? { ...receipt, ...lookup, emailSent: receipt.emailSent }
    : receipt
  const certificate = lookup?.status === 'CONFIRMED'
    ? lookup
    : tracked?.status === 'CONFIRMED'
      ? tracked
      : null

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
    if (index === 0 && schoolName.trim().length < 2) return 'Enter the official school name.'
    if (index === 1) {
      if (contactName.trim().length < 2) return 'Enter the contact name.'
      if (title.trim().length < 2) return 'Enter the contact’s title.'
      if (phone.trim().length < 8) return 'Enter a phone number.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.'
    }
    if (index === 2 && (!province || !district)) return 'Choose the province and district.'
    if (index === 3 && !consent) return 'Confirm that the details are accurate before submitting.'
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

  async function submit() {
    const problem = problemAt(3)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await api.membershipApplications.submit({
        schoolName: schoolName.trim(),
        registrationNumber: registrationNumber.trim() || undefined,
        contactName: contactName.trim(),
        title: title.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: { province, district, sector: sector || undefined },
        message: message.trim() || undefined,
      })
      setReceipt(created)
      setLookup(null)
      setOpen(false)
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

  return (
    <main>
      <PageHero
        kicker="UPSA membership"
        title="Become a UPSA member."
        lead="Submit a membership request. It stays in review until a UPSA administrator confirms it. Track it with the reference code."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Become a UPSA member' }]}
        image="/images/scene-schools.png"
        imageAlt="A school campus preparing to join the association"
      />
      <section className="page-block alt">
        <div className="register-landing">
          <article className="register-card">
            <p className="eyebrow"><span /> Membership</p>
            <h2>Four short steps.</h2>
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

      {open && createPortal(
        <div className="wizard-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
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
              <button className="wizard-dismiss" type="button" onClick={() => setOpen(false)}>Close</button>
            </aside>
            <div className="wizard-main">
              <header>
                <div className="wizard-kicker">
                  <p>Step {step + 1} of {STEPS.length}</p>
                  <button className="text-action" type="button" onClick={() => setOpen(false)}>Close</button>
                </div>
                <h2 id="member-wizard-title">{current.title}</h2>
                <p>{current.lead}</p>
              </header>
              <div className="wizard-body">
                {error && <p className="form-error" role="alert">{error}</p>}
                {step === 0 && (
                  <>
                    <Field label="School name" htmlFor="member-school">
                      <input id="member-school" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Green Hills Academy" autoFocus />
                    </Field>
                    <Field label="Registration number" htmlFor="member-registration" hint="Optional. Copy it from the school licence or the RDB certificate.">
                      <input id="member-registration" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} />
                    </Field>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="field-row">
                      <Field label="Contact name" htmlFor="member-contact">
                        <input id="member-contact" value={contactName} onChange={(event) => setContactName(event.target.value)} autoFocus />
                      </Field>
                      <Field label="Title" htmlFor="member-title">
                        <input id="member-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Head teacher" />
                      </Field>
                    </div>
                    <div className="field-row">
                      <Field label="Phone" htmlFor="member-phone">
                        <input id="member-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+250 788 000 000" />
                      </Field>
                      <Field label="Email" htmlFor="member-email">
                        <input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="office@school.rw" />
                      </Field>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="field-row">
                      <Field label="Province" htmlFor="member-province">
                        <select id="member-province" value={province} onChange={(event) => { setProvince(event.target.value); setDistrict(''); setSector('') }}>
                          <option value="">Select province</option>
                          {provinces.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                      <Field label="District" htmlFor="member-district">
                        <select id="member-district" value={district} onChange={(event) => { setDistrict(event.target.value); setSector('') }}>
                          <option value="">Select district</option>
                          {districts.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Sector" htmlFor="member-sector">
                      <select id="member-sector" value={sector} onChange={(event) => setSector(event.target.value)}>
                        <option value="">Select sector</option>
                        {sectors.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </Field>
                  </>
                )}
                {step === 3 && (
                  <>
                    <dl className="wizard-summary">
                      <div><dt>School</dt><dd>{schoolName || '—'}</dd></div>
                      <div><dt>Contact</dt><dd>{contactName || '—'}</dd></div>
                      <div><dt>Email</dt><dd>{email || '—'}</dd></div>
                      <div><dt>Location</dt><dd>{[sector, district, province].filter(Boolean).join(', ') || '—'}</dd></div>
                    </dl>
                    <Field label="Message" htmlFor="member-message" hint="Optional.">
                      <textarea id="member-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Anything UPSA should know about this membership request." />
                    </Field>
                    <label className="consent">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                      <span>I confirm these details are accurate and that UPSA may contact this school about membership.</span>
                    </label>
                  </>
                )}
              </div>
              <footer className="wizard-foot">
                <button className="button secondary" type="button" disabled={step === 0} onClick={() => goTo(step - 1)}>Back</button>
                {step < STEPS.length - 1 ? (
                  <button className="button primary" type="button" onClick={() => goTo(step + 1)}>Continue</button>
                ) : (
                  <button className="button primary" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit membership request'}</button>
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

function RequestState({
  item,
  emailSent = false,
}: {
  item: { applicationId: string; schoolName: string; email: string; status: string; emailSent?: boolean }
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
