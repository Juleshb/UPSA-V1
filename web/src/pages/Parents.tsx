import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

const points = [
  'Clear balances and payment plans for each student',
  'Bank transfer, mobile money, cards and approved rails',
  'Instant confirmation by SMS, email or in-app notice',
  'A trusted link to the school, not a maze of channels',
  'Digital receipts for every successful payment',
  'Privacy safeguards where children’s data is processed',
]

export function Parents() {
  usePageTitle('For parents — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Solutions / Parents"
        title="Pay the simple way."
        lead="Parents and guardians create digital accounts linked to their students, see what is owed, and pay through approved channels — with a receipt the school can reconcile automatically."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Solutions', to: '/solutions/schools' },
          { label: 'Parents & guardians' },
        ]}
        image="/images/scene-parents.png"
        imageAlt="A parent using a phone to pay school fees"
      />
      <section className="page-block alt">
        <ul className="page-list">
          {points.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <Link className="button primary" to="/contact">Talk to UPSA</Link>
          <Link className="button secondary" to="/platform/payments">How payment works</Link>
        </div>
      </section>
    </main>
  )
}
