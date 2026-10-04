import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApplySteps } from '../components/ApplySteps'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'
import { api, type MembershipVerification } from '../platform/api'

function issuedOn(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function VerifyMembership() {
  usePageTitle('Verify membership — UPSA Next Payment')
  const { code } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<MembershipVerification | null>(null)
  const [error, setError] = useState('')
  const [lookup, setLookup] = useState(code ?? '')

  useEffect(() => {
    if (!code) {
      setResult(null)
      setError('')
      return
    }
    let active = true
    setResult(null)
    setError('')
    void api.membershipApplications.verify(code)
      .then((next) => {
        if (active) setResult(next)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'This certificate could not be checked.')
      })
    return () => {
      active = false
    }
  }, [code])

  function onLookup(event: FormEvent) {
    event.preventDefault()
    const next = lookup.trim()
    if (!next) return
    navigate(`/membership/verify/${encodeURIComponent(next)}`)
  }

  return (
    <main>
      <PageHero
        kicker="Certificate check"
        title="Is this membership verified?"
        lead="Enter the certificate number or membership number printed on a UPSA certificate. A confirmed membership shows the school, the issue date, and who signed it."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Verify membership' }]}
        image="/images/scene-schools.png"
        imageAlt="A school campus whose membership can be checked"
      />
      <section className="page-block alt">
        <ApplySteps steps={['Certificate number', 'Result']} step={code ? 1 : 0} />
        {!code && (
          <form className="contact-form" onSubmit={onLookup}>
            <label>
              Certificate or membership number
              <input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="RUPSA-MCF-000002 or RUPSA-MBR-000001" required />
            </label>
            <button className="button primary" type="submit">Continue</button>
          </form>
        )}
        {code && !result && !error && <p className="register-note">Checking the certificate…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && !result.verified && !result.schoolName && (
          <div className="review-pending" role="status">
            <h3>Not verified.</h3>
            <p>This number does not match a confirmed UPSA membership certificate.</p>
          </div>
        )}
        {result && !result.verified && result.schoolName && (
          <div className="review-pending" role="status">
            <h3>{result.schoolName}</h3>
            <p>This certificate is on file, and the membership is not currently active{result.status ? ` (${result.status.toLowerCase().replaceAll('_', ' ')})` : ''}.</p>
          </div>
        )}
        {result?.verified && (
          <div className="form-success verify-result" role="status">
            <p className="certificate-verified">Verified</p>
            <h3>{result.schoolName}</h3>
            <p>This membership certificate is genuine and the membership is active.</p>
            <dl>
              <div><dt>Certificate</dt><dd>{result.applicationId}</dd></div>
              {result.membershipNumber && <div><dt>Membership number</dt><dd>{result.membershipNumber}</dd></div>}
              <div><dt>Issued</dt><dd>{issuedOn(result.reviewedAt)}</dd></div>
              <div><dt>Location</dt><dd>{result.location || '—'}</dd></div>
              <div><dt>Signed by</dt><dd>{result.reviewerName}<br />{result.reviewerTitle}</dd></div>
            </dl>
          </div>
        )}
        {code && (result || error) && (
          <div className="apply-actions">
            <button className="button secondary" type="button" onClick={() => navigate('/membership/verify')}>Back</button>
          </div>
        )}
      </section>
    </main>
  )
}
