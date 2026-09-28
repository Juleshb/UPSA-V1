import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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
  const [result, setResult] = useState<MembershipVerification | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    let active = true
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

  return (
    <main>
      <PageHero
        kicker="Certificate check"
        title="Is this membership verified?"
        lead="This page reads the code on a UPSA membership certificate and says whether a reader has confirmed it."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Verify membership' }]}
        image="/images/scene-schools.png"
        imageAlt="A school campus whose membership can be checked"
      />
      <section className="page-block alt">
        {!result && !error && <p className="register-note">Checking the certificate…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && !result.verified && (
          <div className="review-pending" role="status">
            <h3>Not verified.</h3>
            <p>This code does not match a confirmed UPSA membership certificate.</p>
          </div>
        )}
        {result?.verified && (
          <div className="form-success verify-result" role="status">
            <p className="certificate-verified">Verified</p>
            <h3>{result.schoolName}</h3>
            <p>A UPSA reader confirmed this membership. The certificate is genuine.</p>
            <dl>
              <div><dt>Reference</dt><dd>{result.applicationId}</dd></div>
              <div><dt>Issued</dt><dd>{issuedOn(result.reviewedAt)}</dd></div>
              <div><dt>Location</dt><dd>{result.location || '—'}</dd></div>
              <div><dt>Signed by</dt><dd>{result.reviewerName}<br />{result.reviewerTitle}</dd></div>
            </dl>
          </div>
        )}
      </section>
    </main>
  )
}
