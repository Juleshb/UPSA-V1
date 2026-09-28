import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FeePreview } from '../components/FeePreview'
import { GraphicIcon, OrbitScene, type GraphicName } from '../components/Graphics'
import { Reveal } from '../components/Reveal'
import { usePageTitle } from '../components/usePageTitle'

const hashRoutes: Record<string, string> = {
  '#platform': '/platform',
  '#how-it-works': '/platform/payments',
  '#partners': '/solutions/partners',
  '#briefing': '/contact',
  '#overview': '/about',
}

const capabilities: { to: string; index: string; title: string; copy: string; icon: GraphicName }[] = [
  { to: '/platform', index: '01', title: 'School onboarding', copy: 'Verified digital identities for UPSA member schools, with KYB, documents and approval workflows.', icon: 'school' },
  { to: '/solutions/parents', index: '02', title: 'Families and students', copy: 'Parent and guardian accounts linked to students, with privacy safeguards for children’s data.', icon: 'family' },
  { to: '/platform/payments', index: '03', title: 'Fees and payments', copy: 'Invoices, partial payments, plans, scholarships and automatic digital receipts.', icon: 'pay' },
  { to: '/platform/payments', index: '04', title: 'Reconciliation', copy: 'Unique references that match invoices, school ledgers and bank or PSP settlements.', icon: 'ledger' },
  { to: '/solutions/schools', index: '05', title: 'School dashboards', copy: 'Live visibility of billed, collected and outstanding fees and settlement status.', icon: 'dash' },
  { to: '/platform/financing', index: '06', title: 'Financing marketplace', copy: 'One standardised application for working capital, expansion, equipment and energy products.', icon: 'loan' },
  { to: '/platform/guarantee', index: '07', title: 'Credit and guarantee', copy: 'Preliminary assessment for lenders, plus a structured UPSA guarantee register.', icon: 'shield' },
  { to: '/platform/compliance', index: '08', title: 'Compliance and APIs', copy: 'Consent, audit trails and institution-neutral APIs for banks, MFIs and payment providers.', icon: 'api' },
]

const audiences = [
  { to: '/solutions/schools', image: '/images/scene-schools.png', alt: 'School administrator reviewing fee collections', label: 'For schools', title: 'Collect with confidence.', copy: 'Registration, invoicing, receipts and live collection dashboards in one place.' },
  { to: '/solutions/parents', image: '/images/scene-parents.png', alt: 'Parent paying school fees on a phone', label: 'For parents', title: 'Pay the simple way.', copy: 'Clear balances, approved payment rails and an instant digital receipt.' },
  { to: '/solutions/partners', image: '/images/scene-partners.png', alt: 'Financial partners meeting in Kigali', label: 'For financial partners', title: 'Lend with better signal.', copy: 'Verified, consent-based school data — you keep the final credit decision.' },
]

const steps = [
  { n: '01', title: 'Onboard the school', copy: 'Verify the member school, its documents and the people who can collect or request finance.' },
  { n: '02', title: 'Invoice the family', copy: 'Issue a clear term bill with a unique reference, plans, scholarships and partial payments.' },
  { n: '03', title: 'Collect on approved rails', copy: 'Parents pay in RWF on eKash-ready channels. The school ledger and receipt update together.' },
  { n: '04', title: 'Finance when ready', copy: 'Share consent-based performance with licensed institutions. They keep the credit decision.' },
]

export function Home() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  usePageTitle('UPSA Next Payment — Official school payments and financial services')

  useEffect(() => {
    const next = hashRoutes[hash]
    if (next) navigate(next, { replace: true })
  }, [hash, navigate])

  return (
    <main className="landing">
      <section className="hero-split" id="top">
        <div className="hero-copy-col">
          <div className="eyebrow"><span /> Official platform · Rwanda</div>
          <h1>The digital bridge between schools and finance.</h1>
          <p className="hero-copy">
            UPSA Next Payment is the official platform concept of the Rwanda Union of
            Private Schools Association — connecting member schools, parents
            and licensed financial institutions.
          </p>
          <div className="actions">
            <Link className="button primary" to="/platform">
              Explore the platform
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10m0 0 4-4m-4 4L6 9M4 16h12" /></svg>
            </Link>
            <Link className="button secondary" to="/login">Sign in to workspace</Link>
          </div>
        </div>
        <div className="hero-visual">
          <img src="/images/hero-rwanda-campus.png" alt="A private school campus in the hills of Rwanda" />
          <OrbitScene />
          <div className="hero-chip chip-a">
            <span>Collections</span>
            <b>Live school ledgers</b>
          </div>
          <div className="hero-chip chip-b">
            <span>Rwanda · RWF</span>
            <b>eKash-ready rails</b>
          </div>
        </div>
      </section>

      <section className="lp-strip" aria-label="Official snapshot">
        <div><b>Proposed by</b><span>Rwanda Union of Private Schools Association</span></div>
        <div><b>Platform</b><span>Payments, credit, guarantee and reporting</span></div>
        <div><b>Market</b><span>Schools, families, banks, MFIs and PSPs</span></div>
        <div><b>Country</b><span>Rwanda · RWF · eKash-ready rails</span></div>
      </section>

      <section className="story section">
        <Reveal>
          <div className="section-label">01 / Opportunity</div>
        </Reveal>
        <div className="story-grid lp-story">
          <Reveal><h2>One path.<br />Three partners.</h2></Reveal>
          <Reveal className="story-copy" delay={80}>
            <p>
              Private schools still chase fees across fragmented channels.
              Lenders still lack a consistent view of school performance.
              UPSA Next Payment is the common digital infrastructure in between —
              a trusted bridge, not a bank.
            </p>
            <div className="traits">
              <span>Connected</span><span>Trusted</span><span>Official</span>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <div className="photo-panel">
              <img src="/images/scene-bridge.png" alt="A modern bridge at dusk, a visual for the digital connection UPSA Next Payment creates" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section lp-platform">
        <Reveal>
          <div className="section-label">02 / Platform</div>
          <div className="lp-platform-head">
            <h2>A complete operating system for school finance.</h2>
            <p>Open a dedicated page for each part of the system, or start with the platform overview.</p>
          </div>
        </Reveal>
        <div className="lp-cards">
          {capabilities.map((item, index) => (
            <Reveal key={item.title + item.index} delay={index * 40}>
              <Link className="page-card" to={item.to}>
                <span className="icon-badge"><GraphicIcon name={item.icon} /></span>
                <span>{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section how-steps">
        <Reveal>
          <div className="section-label">03 / How it works</div>
          <div className="lp-platform-head">
            <h2>From registration to settlement.</h2>
            <p>A structured path for member schools — invoice, collect, reconcile, then open financing when it is useful.</p>
          </div>
        </Reveal>
        <ol className="step-grid">
          {steps.map((step, index) => (
            <Reveal key={step.n} delay={index * 70} as="li">
              <small>{step.n}</small>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="section fee-section">
        <FeePreview />
      </section>

      <section className="section lp-audiences">
        <Reveal>
          <div className="section-label light">04 / Who it serves</div>
          <div className="lp-audience-head">
            <h2>Built for every side of the table.</h2>
          </div>
        </Reveal>
        <div className="page-grid three">
          {audiences.map((item, index) => (
            <Reveal key={item.label} delay={index * 80}>
              <Link className="media-card" to={item.to}>
                <img src={item.image} alt={item.alt} />
                <div>
                  <span>{item.label}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="closing lp-briefing">
        <Reveal>
          <img src="/rupsa-next-logo-reversed.svg" alt="UPSA Next Payment" />
          <p>Payments. Access. Progress.</p>
          <h2>Ready for an official briefing.</h2>
          <p className="lp-briefing-copy">
            This site presents the proposed architecture for UPSA boards,
            member schools and regulated financial institutions.
          </p>
          <div className="actions">
            <Link className="button primary inverse" to="/register">Register a school</Link>
            <Link className="button secondary ghost" to="/contact">Request a briefing</Link>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
