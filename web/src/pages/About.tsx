import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

export function About() {
  usePageTitle('About — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="About"
        title="A trusted digital bridge for private education."
        lead="UPSA Next Payment is proposed by the Rwanda Union of Private Schools Association as the common digital infrastructure for member schools, parents and licensed financial partners."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]}
        image="/images/scene-bridge.png"
        imageAlt="A dusk bridge standing for the trusted link UPSA Next Payment proposes"
        orbit
      />

      <section className="page-block alt">
        <div className="page-prose">
          <p>
            Private schools need reliable ways to collect fees, manage student
            accounts and obtain working-capital or asset finance. Financial
            institutions need reliable, standardised information when they
            assess those schools.
          </p>
          <p>
            The platform is a concept and proposed technical architecture. It
            should not itself perform regulated banking or payment activities
            unless the operator has obtained the relevant authorisation.
            Licensed institutions perform those activities through contract
            and API integrations.
          </p>
          <p>
            Status: concept for UPSA boards, member schools and partner
            financial institutions. Country of operation: Rwanda.
          </p>
        </div>
        <div className="actions" style={{ justifyContent: 'flex-start', marginTop: 28 }}>
          <Link className="button primary" to="/contact">Request a briefing</Link>
          <Link className="button secondary" to="/brand">View brand identity</Link>
        </div>
      </section>
    </main>
  )
}
