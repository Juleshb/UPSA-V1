import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

export function Guarantee() {
  usePageTitle('Guarantee — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Platform / Guarantee"
        title="Collateral support for qualifying members."
        lead="A structured UPSA guarantee and reserve facility can stand behind eligible loans — with a register of amounts, conditions, claims and recovery status."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Platform', to: '/platform' },
          { label: 'Guarantee' },
        ]}
        image="/images/scene-bridge.png"
        imageAlt="A dusk bridge standing in for structured guarantee support"
      />

      <section className="page-block alt">
        <div className="lp-guarantee-grid">
          <div className="page-prose">
            <p>The proposed system would allow eligible UPSA members to receive guarantee or collateral support for qualifying loans from participating banks and MFIs.</p>
            <p>The platform itself does not present a guarantee as legally enforceable until the underlying structure, funding, authority and contracts are established.</p>
          </div>
          <dl>
            <div><dt>Guarantee ID</dt><dd>RUPSA-GUA-000123</dd></div>
            <div><dt>Loan amount</dt><dd>RWF 50,000,000</dd></div>
            <div><dt>Guaranteed</dt><dd>RWF 20,000,000</dd></div>
            <div><dt>Status</dt><dd>Under review → Issued</dd></div>
          </dl>
        </div>
      </section>
    </main>
  )
}
