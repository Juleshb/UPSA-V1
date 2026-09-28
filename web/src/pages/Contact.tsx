import { useState, type FormEvent } from 'react'
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

export function Contact() {
  usePageTitle('Request a briefing — UPSA Next Payment')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.messages.submit({
        name: String(form.get('name')).trim(),
        organisation: String(form.get('organisation')).trim(),
        role: String(form.get('role')),
        interest: String(form.get('interest')),
        email: String(form.get('email')).trim(),
        message: String(form.get('message')).trim(),
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
            <p>Briefings are coordinated through the Rwanda Union of Private Schools Association in Kigali.</p>
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
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="field-row">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" required autoComplete="name" />
                </div>
                <div className="field">
                  <label htmlFor="organisation">Organisation</label>
                  <input id="organisation" name="organisation" required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="role">Role</label>
                  <select id="role" name="role" required defaultValue="">
                    <option value="" disabled>Select your role</option>
                    {roles.map((role) => <option key={role}>{role}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="interest">Interest</label>
                  <select id="interest" name="interest" required defaultValue="">
                    <option value="" disabled>Select a topic</option>
                    {interests.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="email">Work email</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="message">Message</label>
                <textarea id="message" name="message" required placeholder="Tell us how you would like to engage with UPSA Next Payment." />
              </div>
              <label className="consent">
                <input type="checkbox" name="consent" required />
                I confirm this request is made on behalf of a school, UPSA or a regulated financial institution, and I consent to being contacted about this briefing.
              </label>
              <button className="button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit briefing request'}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
