import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FeePreview } from '../components/FeePreview'
import { usePageTitle } from '../components/usePageTitle'

const hashRoutes: Record<string, string> = {
  '#platform': '/platform',
  '#how-it-works': '/platform/payments',
  '#partners': '/solutions/partners',
  '#briefing': '/contact',
  '#overview': '/about',
}

const features = [
  { n: '01', title: 'Membership on record', copy: 'A school asks to join. The request stays in review until a UPSA reader confirms it.' },
  { n: '02', title: 'A signed certificate', copy: 'A confirmed school receives a certificate. Anyone can check that the number is genuine.' },
  { n: '03', title: 'School payments', copy: 'Invoices, partial payments, plans and receipts that match the school ledger.' },
  { n: '04', title: 'Financing and guarantee', copy: 'A standard application for school finance, with a guarantee register beside the lender’s own decision.' },
  { n: '05', title: 'Training and reports', copy: 'Public courses, then a certificate. Schools can also see what has been collected.' },
]

const services = [
  {
    label: 'Track school payments',
    title: 'See what the school has collected',
    copy: 'Invoices, balances and receipts stay on one school record, so a bursar can confirm what has actually been received.',
    kicker: 'Term collections',
    period: 'Illustration · this term',
    unit: 'RWF',
    amount: '48,600,000',
    foot: 'Received against issued invoices',
  },
  {
    label: 'Register a school',
    title: 'Open the school file',
    copy: 'A confirmed member registers the school once. Families, invoices and the certificate all point back to that file.',
    kicker: 'School file',
    period: 'Membership confirmed',
    unit: '',
    amount: '1 record',
    foot: 'School, families and certificate together',
  },
  {
    label: 'Verify a certificate',
    title: 'Check that a number is genuine',
    copy: 'Anyone can enter a certificate number, or scan it, and see whether UPSA has confirmed that school.',
    kicker: 'Certificate check',
    period: 'Public verification',
    unit: '',
    amount: 'Genuine',
    foot: 'Matched to a confirmed member school',
  },
  {
    label: 'Financial training',
    title: 'Courses a school can finish',
    copy: 'Public courses sit beside the membership record. A completed course can carry its own certificate.',
    kicker: 'Training',
    period: 'Open courses',
    unit: '',
    amount: 'Certified',
    foot: 'A course record next to the school file',
  },
]

const stories = [
  {
    quote: 'The membership file and the school file finally sit in one place.',
    body: 'The request, the certificate and the invoices no longer live in separate folders.',
    role: 'School bursar',
    detail: 'Member school',
    initials: 'SB',
  },
  {
    quote: 'I can see the balance and the receipt without calling the office.',
    body: 'The bill, what is still due, and the receipt after payment are on the same screen.',
    role: 'Parent',
    detail: 'School fees',
    initials: 'PA',
  },
  {
    quote: 'We start from a school that UPSA has already confirmed.',
    body: 'The finance file opens from a membership that a UPSA reader has already signed.',
    role: 'Finance partner',
    detail: 'Licensed institution',
    initials: 'FP',
  },
]

const faqs = {
  Information: [
    { q: 'How does a school join?', a: 'The school submits a membership request. It stays in review until a UPSA reader confirms it and signs the certificate.' },
    { q: 'Can a school register before membership is confirmed?', a: 'A school request can be sent first. Approval waits until membership is confirmed.' },
    { q: 'What currency does the platform use?', a: 'Amounts are in RWF. Payment and lending activity stays with licensed institutions.' },
  ],
  'School payments': [
    { q: 'What does a family see?', a: 'A clear school bill, the balance, and a digital receipt after payment.' },
    { q: 'Do receipts match the school ledger?', a: 'Invoices, partial payments, plans and receipts are kept against the same school record.' },
  ],
  Membership: [
    { q: 'How is a certificate checked?', a: 'Open Verify a membership and enter the certificate number. A genuine certificate can also be scanned.' },
    { q: 'Who confirms membership?', a: 'A UPSA reader reviews the request and confirms it before the school is treated as a member.' },
  ],
} as const

type FaqTab = keyof typeof faqs

const faces = [
  '/images/scene-schools.png',
  '/images/scene-parents.png',
  '/images/hero-rwanda-campus.png',
  '/images/scene-partners.png',
]

function StartForm({ id }: { id: string }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = email.trim()
    navigate(next ? `/membership?email=${encodeURIComponent(next)}` : '/membership')
  }

  return (
    <form className="portal-start" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={id}>School email</label>
      <input
        id={id}
        type="email"
        name="email"
        autoComplete="email"
        placeholder="School email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit">Get started</button>
    </form>
  )
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {direction === 'left'
        ? <path d="M10 3 5 8l5 5" />
        : <path d="M6 3l5 5-5 5" />}
    </svg>
  )
}

export function Home() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const featureTrack = useRef<HTMLDivElement>(null)
  const storyTrack = useRef<HTMLDivElement>(null)
  const [service, setService] = useState(0)
  const [tab, setTab] = useState<FaqTab>('Information')
  const [open, setOpen] = useState(0)
  usePageTitle('Universor of Private Schools Association — UPSA Next Payment')

  useEffect(() => {
    const next = hashRoutes[hash]
    if (next) navigate(next, { replace: true })
  }, [hash, navigate])

  function slide(track: HTMLDivElement | null, direction: number) {
    if (!track) return
    const card = track.querySelector<HTMLElement>(':scope > *')
    const distance = card ? card.offsetWidth + 16 : track.clientWidth * 0.8
    track.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  const active = services[service]

  return (
    <main className="portal">
      <section className="portal-hero" id="top">
        <div className="portal-hero-copy">
          <h1>Clear school payments, a secure membership</h1>
          <p>
            From a membership request to a receipt in RWF, UPSA Next Payment
            gives private schools, families and licensed partners one record they can trust.
          </p>
          <StartForm id="start-email" />
        </div>
        <div className="portal-faces" aria-hidden="true">
          {faces.map((src) => <img key={src} src={src} alt="" />)}
        </div>
      </section>

      <section className="portal-band">
        <div className="portal-band-head">
          <div>
            <p className="portal-kicker">Core services</p>
            <h2>A clearer way to run a member school</h2>
            <p>
              Membership, payments, finance and training stay on one platform, from the first request to a confirmed certificate.
            </p>
          </div>
          <div className="portal-arrows">
            <button type="button" aria-label="Previous services" onClick={() => slide(featureTrack.current, -1)}>
              <Arrow direction="left" />
            </button>
            <button type="button" aria-label="Next services" onClick={() => slide(featureTrack.current, 1)}>
              <Arrow direction="right" />
            </button>
          </div>
        </div>
        <div className="portal-track" ref={featureTrack}>
          {features.map((item) => (
            <article key={item.n}>
              <small>{item.n}</small>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-tools">
        <h2>Self-service, from the first request</h2>
        <div className="portal-segments" role="tablist" aria-label="Self-service">
          {services.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={service === index}
              onClick={() => setService(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="portal-tool-panel">
          <div>
            <h3>{active.title}</h3>
            <p>{active.copy}</p>
          </div>
          <aside className="portal-mock" aria-hidden="true">
            <div className="portal-mock-card">
              <span className="portal-mock-mark" />
              <div>
                <b>{active.kicker}</b>
                <small>{active.period}</small>
              </div>
              <p className="portal-mock-amount">{active.unit && <span>{active.unit}</span>} {active.amount}</p>
              <small>{active.foot}</small>
            </div>
          </aside>
        </div>
      </section>

      <section className="portal-trust">
        <div className="portal-trust-head">
          <h2>Built for trust, designed for clarity</h2>
          <Link to="/membership">Get started today</Link>
        </div>
        <div className="portal-stage" aria-hidden="true">
          <div className="portal-window">
            <header>
              <i />
              <b>Member school</b>
              <span>Certificate on file</span>
            </header>
            <div className="portal-window-grid">
              <article>
                <small>Collected this term</small>
                <strong>48.6M</strong>
                <span>RWF · illustration</span>
              </article>
              <article>
                <small>Open invoices</small>
                <strong>126</strong>
                <span>Families on the school file</span>
              </article>
              <img src="/images/scene-payments.png" alt="" />
            </div>
          </div>
        </div>
      </section>

      <section className="portal-plan">
        <div className="portal-plan-copy">
          <h2>Estimate collections at school scale</h2>
          <p>
            Set enrolment and a typical term fee. The figure is an illustration in RWF, not a quote or a credit offer.
          </p>
        </div>
        <FeePreview />
      </section>

      <section className="portal-band">
        <div className="portal-band-head">
          <div>
            <h2>How the platform is used</h2>
            <p>Three views of the same record: the school, the family, and the licensed partner.</p>
          </div>
          <div className="portal-arrows">
            <button type="button" aria-label="Previous stories" onClick={() => slide(storyTrack.current, -1)}>
              <Arrow direction="left" />
            </button>
            <button type="button" aria-label="Next stories" onClick={() => slide(storyTrack.current, 1)}>
              <Arrow direction="right" />
            </button>
          </div>
        </div>
        <div className="portal-track portal-stories" ref={storyTrack}>
          {stories.map((item) => (
            <article key={item.role}>
              <h3>“{item.quote}”</h3>
              <p>{item.body}</p>
              <footer>
                <i>{item.initials}</i>
                <span>
                  <b>{item.role}</b>
                  <small>{item.detail}</small>
                </span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-faq-section">
        <div>
          <h2>Frequently asked questions</h2>
          <p>Short answers on membership, school payments and certificates.</p>
        </div>
        <div>
          <div className="portal-faq-tabs" role="tablist" aria-label="Question topics">
            {(Object.keys(faqs) as FaqTab[]).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => {
                  setTab(name)
                  setOpen(0)
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="portal-faq">
            {faqs[tab].map((item, index) => {
              const shown = open === index
              return (
                <article key={item.q}>
                  <button
                    type="button"
                    aria-expanded={shown}
                    onClick={() => setOpen(shown ? -1 : index)}
                  >
                    {item.q}
                    <span aria-hidden="true">{shown ? '–' : '+'}</span>
                  </button>
                  {shown && <p>{item.a}</p>}
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="portal-close">
        <h2>Take a place in the association</h2>
        <p>We’ll open the membership request if the school is new, or the workspace if it already has one.</p>
        <StartForm id="start-email-close" />
      </section>
    </main>
  )
}
