import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

const steps = ['Application', 'Document check', 'KYC / KYB', 'Preliminary assessment', 'Institution review', 'Offer, contract and disbursement']
const products = ['Working-capital loans', 'School expansion', 'Construction finance', 'Equipment finance', 'School bus and vehicle finance', 'ICT financing', 'Solar and energy financing', 'Salary and liquidity facilities', 'Invoice and receivables finance']

export function Financing() {
  usePageTitle('Financing — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Platform / Financing"
        title="One application. The lender keeps the decision."
        lead="Eligible UPSA members can submit a standardised financing request. The platform can run a preliminary assessment. The licensed financial institution makes the final credit decision and holds the funds."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Platform', to: '/platform' },
          { label: 'Financing' },
        ]}
        image="/images/scene-partners.png"
        imageAlt="Financial professionals in a modern Kigali office"
      />

      <section className="page-block alt">
        <div className="lp-flow-grid">
          <article>
            <div className="lp-flow-meta"><span>Workflow</span><b>Credit pathway</b></div>
            <ol>
              {steps.map((step, index) => (
                <li key={step}><i>{String(index + 1).padStart(2, '0')}</i>{step}</li>
              ))}
            </ol>
          </article>
          <article>
            <div className="lp-flow-meta"><span>Products</span><b>Approved facilities</b></div>
            <ul className="page-list light">
              {products.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </div>
      </section>
    </main>
  )
}
