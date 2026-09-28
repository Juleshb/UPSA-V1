import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

const points = [
  'One place for registration, invoicing and collections',
  'Automatic receipts and reconciled ledgers',
  'Financial profiles that can support financing, with consent',
  'Real-time KPIs instead of scattered spreadsheets',
  'Student accounts with outstanding balances and payment history',
  'A pathway to working capital and asset finance',
]

export function Schools() {
  usePageTitle('For schools — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Solutions / Schools"
        title="Collect with confidence."
        lead="UPSA member schools can establish a verified digital profile, collect fees through approved channels, and build standardised financial records that, with consent, can support financing assessments."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Solutions', to: '/solutions/schools' },
          { label: 'Schools' },
        ]}
        image="/images/scene-schools.png"
        imageAlt="A school administrator reviewing collections in a Rwanda school office"
      />
      <section className="page-block alt">
        <div className="contact-shell">
          <div>
            <ul className="page-list">
              {points.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="actions" style={{ justifyContent: 'flex-start' }}>
              <Link className="button primary" to="/register">Register your school</Link>
              <Link className="button secondary" to="/membership">Become a UPSA member</Link>
              <Link className="button secondary" to="/contact">Request a briefing</Link>
            </div>
          </div>
          <div className="photo-panel">
            <img src="/images/hero-rwanda-campus.png" alt="Private school campus in the Rwandan hills" />
          </div>
        </div>
      </section>
    </main>
  )
}
