import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApplySteps } from '../components/ApplySteps'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { api } from '../platform/api'

const roles = [
  'School administrator',
  'Parent or guardian',
  'Bank or MFI',
  'Payment service provider',
  'UPSA official',
  'Other',
]

const interests = [
  'Platform briefing',
  'School onboarding',
  'Financing partnership',
  'Guarantee facility',
  'API integration',
  'Brand and communications',
]

const STEPS = ['Who is applying', 'The request', 'Confirm']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Contact() {
  usePageTitle('Request a briefing — UPSA Next Payment')
  const [params] = useSearchParams()
  const preset = params.get('interest') ?? ''
  const [step, setStep] = useState(0)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    organisation: '',
    role: '',
    interest: interests.includes(preset) ? preset : '',
    email: '',
    message: '',
    consent: false,
  })

  function problem() {
    if (step === 0 && (!draft.name.trim() || !draft.organisation.trim() || !draft.role)) {
      return 'Enter your name, organisation, and role.'
    }
    if (step === 1) {
      if (!draft.interest || !draft.email.trim() || !draft.message.trim()) return 'Choose a topic, then add your email and message.'
      if (!EMAIL.test(draft.email.trim())) return 'Enter a work email.'
    }
    if (step === 2 && !draft.consent) return 'Confirm that this request is made on behalf of a school, UPSA, or a regulated institution.'
    return ''
  }

  function continueStep() {
    const issue = problem()
    if (issue) {
      setError(issue)
      return
    }
    setError('')
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < STEPS.length - 1) {
      continueStep()
      return
    }
    const issue = problem()
    if (issue) {
      setError(issue)
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.messages.submit({
        name: draft.name.trim(),
        organisation: draft.organisation.trim(),
        role: draft.role,
        interest: draft.interest,
        email: draft.email.trim(),
        message: draft.message.trim(),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The briefing request could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <PageHero
        kicker="Contact"
        title="Request an official briefing."
        lead="This desk is for UPSA boards, member schools and licensed financial institutions that want to review the proposed platform."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
        image="/images/hero-rwanda-campus.png"
        imageAlt="A Rwandan school campus, the setting for UPSA member institutions"
      />

      <section className="page-block alt">
        <div className="contact-shell">
          <div className="page-prose">
            <p>Briefings are coordinated through the Universor of Private Schools Association in Kigali.</p>
            <ul className="page-list">
              <li>Organisation: UPSA</li>
              <li>Platform: UPSA Next Payment</li>
              <li>Country: Rwanda · Currency: RWF</li>
              <li>Status: Concept and proposed architecture</li>
            </ul>
          </div>

          {sent ? (
            <div className="form-success" role="status">
              <h3>Briefing request received.</h3>
              <p>Thank you. A confirmation was sent to your email, and the briefing desk has the request.</p>
            </div>
          ) : (
            <form className="contact-form" onSubmit={(event) => void onSubmit(event)}>
              <ApplySteps steps={STEPS} step={step} />
              {error && <p className="form-error" role="alert">{error}</p>}
              {step === 0 && (
                <>
                  <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input id="name" value={draft.name} autoComplete="name" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="organisation">Organisation</label>
                    <input id="organisation" value={draft.organisation} onChange={(event) => setDraft((current) => ({ ...current, organisation: event.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="role">Role</label>
                    <select id="role" value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}>
                      <option value="">Select your role</option>
                      {roles.map((role) => <option key={role}>{role}</option>)}
                    </select>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="field">
                    <label htmlFor="interest">Interest</label>
                    <select id="interest" value={draft.interest} onChange={(event) => setDraft((current) => ({ ...current, interest: event.target.value }))}>
                      <option value="">Select a topic</option>
                      {interests.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="email">Work email</label>
                    <input id="email" type="email" value={draft.email} autoComplete="email" onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="message">Message</label>
                    <textarea id="message" value={draft.message} placeholder="Tell us how you would like to engage with UPSA Next Payment." onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} />
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <dl className="apply-summary">
                    <div><dt>Name</dt><dd>{draft.name}</dd></div>
                    <div><dt>Organisation</dt><dd>{draft.organisation}</dd></div>
                    <div><dt>Role</dt><dd>{draft.role}</dd></div>
                    <div><dt>Interest</dt><dd>{draft.interest}</dd></div>
                    <div><dt>Email</dt><dd>{draft.email}</dd></div>
                    <div><dt>Message</dt><dd>{draft.message}</dd></div>
                  </dl>
                  <label className="consent">
                    <input type="checkbox" checked={draft.consent} onChange={(event) => setDraft((current) => ({ ...current, consent: event.target.checked }))} />
                    I confirm this request is made on behalf of a school, UPSA or a regulated financial institution, and I consent to being contacted about this briefing.
                  </label>
                </>
              )}
              <div className="apply-actions">
                {step > 0 && <button className="button secondary" type="button" onClick={() => { setError(''); setStep((current) => current - 1) }}>Back</button>}
                {step < STEPS.length - 1
                  ? <button className="button primary" type="submit">Continue</button>
                  : <button className="button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit briefing request'}</button>}
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
