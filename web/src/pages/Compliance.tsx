import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

export function Compliance() {
  usePageTitle('Trust and compliance — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Platform / Trust"
        title="Orchestration, not a bank."
        lead="Regulated payment and lending activity is performed by licensed institutions. UPSA Next Payment is designed to sit on Rwanda’s interoperable rails, including the National Digital Payment System and eKash."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Platform', to: '/platform' },
          { label: 'Trust & compliance' },
        ]}
        image="/images/scene-payments.png"
        imageAlt="A secure digital payment still life"
      />

      <section className="page-block alt">
        <div className="lp-trust-grid">
          <div className="page-prose">
            <p>The compliance layer covers KYC and KYB, customer consent, data protection, access control, transaction monitoring, audit trails, complaints and incident management.</p>
            <p>Where UPSA Next Payment acts as a data processor, the relationship should be governed by written data-processing arrangements under Rwanda’s privacy framework.</p>
          </div>
          <ul>
            <li><b>Compliance</b>KYC, KYB, AML support, consent and incident management</li>
            <li><b>Data protection</b>Lawful, purpose-limited processing of personal data</li>
            <li><b>Auditability</b>Transaction monitoring, immutable trails and partner reporting</li>
            <li><b>Institution APIs</b>REST and JSON, OAuth, mTLS options, signed webhooks and sandboxes</li>
          </ul>
        </div>
        <div className="lp-arch" aria-label="Proposed technical architecture">
          <div><small>Channels</small><span>Web portal</span><span>Mobile app</span><span>Admin</span></div>
          <div><small>Services</small><span>Payments</span><span>Loan engine</span><span>Identity</span><span>Notifications</span></div>
          <div><small>Core</small><span>School data</span><span>Finance data</span><span>Audit log</span></div>
          <div><small>Partners</small><span>Banks</span><span>MFIs</span><span>PSPs</span></div>
        </div>
        <div className="actions" style={{ justifyContent: 'flex-start', marginTop: 36 }}>
          <Link className="button primary" to="/developers">Open the API sandbox</Link>
        </div>
      </section>
    </main>
  )
}
