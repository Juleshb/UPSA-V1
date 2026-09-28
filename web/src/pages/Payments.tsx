import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

const steps = [
  ['PAY-01', 'Payment request'],
  ['PAY-02', 'Instruction to an approved rail'],
  ['PAY-03', 'Confirmation'],
  ['PAY-04', 'Receipt'],
  ['PAY-05', 'Reconciliation'],
  ['PAY-06', 'Refund'],
  ['PAY-07', 'Reversal'],
  ['PAY-08', 'Settlement'],
  ['PAY-16', 'EAC cross-border payment'],
]
const channels = ['Bank', 'PSP', 'Mobile money', 'Card']
const corridors = [
  'Rwanda (RSwitch) ↔ Tanzania (TIPS) — pilot',
  'Uganda, Kenya, Burundi, South Sudan and DRC — expandable, not yet live',
]

export function Payments() {
  usePageTitle('Payments — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Platform / Payments"
        title="From a parent’s payment to a school ledger."
        lead="UPSA Next Payment orchestrates school-fee collection. Licensed payment service providers and banks move the money. Schools receive a reconciled ledger and a digital receipt."
        crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Platform', to: '/platform' },
          { label: 'Payments' },
        ]}
        image="/images/scene-payments.png"
        imageAlt="A navy desk still life suggesting a digital school-fee payment"
      />

      <section className="page-block alt">
        <div className="lp-flow-grid">
          <article>
            <div className="lp-flow-meta"><span>Lifecycle</span><b>Fee collection</b></div>
            <p>Every payment carries a unique reference so invoices, student accounts and settlements can be matched without manual work.</p>
            <ol>
              {steps.map(([code, label]) => (
                <li key={code}><i className="flow-code">{code}</i>{label}</li>
              ))}
            </ol>
            <div className="lp-receipt">
              <span>Example</span>
              <strong>RNP-20260921-000001</strong>
              <p>RWF 100,000 received · Term 3 fees · Balance RWF 200,000</p>
            </div>
          </article>
          <article>
            <div className="lp-flow-meta"><span>Reconciliation</span><b>Statuses</b></div>
            <p>The engine compares invoice amount, payment amount, bank or PSP transaction, and school, student and settlement accounts.</p>
            <ul className="page-list light">
              {['Matched', 'Partially matched', 'Unmatched', 'Duplicate', 'Failed', 'Refunded', 'Under review'].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="page-block">
        <div className="section-label">Approved payment rails</div>
        <ul className="page-list">
          {channels.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="page-block alt">
        <div className="section-label">EAC cross-border extension</div>
        <p className="page-prose">UPSA Next Payment orchestrates the instruction. Funds still move on licensed national infrastructure. The live corridor is Rwanda’s RSwitch and Tanzania’s TIPS.</p>
        <ul className="page-list">
          {corridors.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  )
}
