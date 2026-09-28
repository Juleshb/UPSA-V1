import { Link } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { usePageTitle } from '../components/usePageTitle'

const modules = [
  ['01', 'School onboarding', 'Verified digital identities, KYB, licensing documents and approval workflows for UPSA members.'],
  ['02', 'Families and students', 'Guardian accounts linked to students, with privacy safeguards for children’s data.'],
  ['03', 'Fees and payments', 'Invoices, partial payments, plans, scholarships and automatic digital receipts.'],
  ['04', 'Reconciliation', 'Unique references that match invoices, school ledgers and bank or PSP settlements.'],
  ['05', 'School dashboards', 'Billed, collected and outstanding fees, collection rates and settlement status.'],
  ['06', 'Financing marketplace', 'One application for working capital, expansion, equipment, ICT and energy products.'],
  ['07', 'Credit and guarantee', 'Preliminary assessment for lenders, plus a structured UPSA guarantee register.'],
  ['08', 'Compliance and APIs', 'Consent, audit trails and institution-neutral APIs for banks, MFIs and PSPs.'],
]

export function Platform() {
  usePageTitle('Platform — UPSA Next Payment')

  return (
    <main>
      <PageHero
        kicker="Platform"
        title="A complete operating system for school finance."
        lead="UPSA Next Payment brings registration, payments, reconciliation, financing and guarantee support into one interoperable environment for member schools in Rwanda."
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Platform' }]}
        image="/images/scene-bridge.png"
        imageAlt="A modern bridge at dusk, representing the digital connection between schools and finance"
        orbit
      />

      <section className="page-block alt">
        <div className="page-grid three">
          <Link className="page-card" to="/platform/payments">
            <span>01</span>
            <h3>Payments</h3>
            <p>Fee collection, receipts and automated reconciliation across approved rails.</p>
          </Link>
          <Link className="page-card" to="/platform/financing">
            <span>02</span>
            <h3>Financing</h3>
            <p>A standardised loan marketplace. Licensed institutions keep the final credit decision.</p>
          </Link>
          <Link className="page-card" to="/platform/guarantee">
            <span>03</span>
            <h3>Guarantee</h3>
            <p>Structured collateral support for qualifying members, with a full guarantee register.</p>
          </Link>
        </div>
      </section>

      <section className="page-block">
        <div className="section-label">Modules</div>
        <div className="lp-cards">
          {modules.map(([index, title, copy]) => (
            <article key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-block dark">
        <div className="section-label light">Ecosystem</div>
        <ol className="lp-path">
          <li><small>01</small><b>Parents</b><span>Pay fees, track balances, receive receipts</span></li>
          <li><small>02</small><b>Schools</b><span>Invoice, collect, reconcile and report</span></li>
          <li className="lp-path-core"><small>03</small><img src="/rupsa-next-icon.svg" alt="" /><b>UPSA Next Payment</b><span>Identity, payments, credit and guarantee</span></li>
          <li><small>04</small><b>Banks &amp; PSPs</b><span>Move money on approved rails</span></li>
          <li><small>05</small><b>Credit</b><span>Assess, lend, monitor and recover</span></li>
        </ol>
      </section>
    </main>
  )
}
