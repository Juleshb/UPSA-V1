import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

const points = [
  'Standardised, verified, consent-based school data',
  'Preliminary credit assessment — you keep the final decision',
  'Portfolio monitoring, repayment and recovery workflows',
  'REST APIs, OAuth, webhooks and sandbox environments',
  'Guarantee register visibility for qualifying facilities',
  'Institution-neutral design for banks, MFIs and PSPs',
]

export function Partners() {
  usePageTitle('For financial partners — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Solutions / Partners"
        title="Lend with better signal."
        lead="Participating financial institutions receive standardised information about UPSA member schools — only under a valid legal basis, contract and required consent — and keep their own credit policy and final decision."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Solutions', to: '/solutions/schools' },
          { label: 'Banks & MFIs' },
        ]}
        image="/images/scene-partners.png"
        imageAlt="Licensed financial partners in a Kigali office"
      />
      <section className="page-block alt">
        <ul className="page-list">
          {points.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <Link className="button primary" to="/contact">Request a partner briefing</Link>
          <Link className="button secondary" to="/platform/compliance">Review compliance</Link>
        </div>
      </section>
    </main>
  )
}
