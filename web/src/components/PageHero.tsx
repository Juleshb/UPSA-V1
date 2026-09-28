import { Link } from 'react-router-dom'
import { OrbitScene } from './Graphics'
import { Reveal } from './Reveal'

type Crumb = {
  label: string
  to?: string
}

export function PageHero({
  kicker,
  title,
  lead,
  crumbs,
  image,
  imageAlt,
  orbit = false,
}: {
  kicker: string
  title: string
  lead: string
  crumbs: Crumb[]
  image?: string
  imageAlt?: string
  orbit?: boolean
}) {
  return (
    <section className={`page-hero${image ? ' has-visual' : ''}`}>
      <Reveal className="page-hero-copy">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => (
            <span key={crumb.label}>
              {index > 0 && <i>/</i>}
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <b>{crumb.label}</b>}
            </span>
          ))}
        </nav>
        <div className="eyebrow"><span /> {kicker}</div>
        <h1>{title}</h1>
        <p>{lead}</p>
      </Reveal>
      {image && (
        <Reveal className="page-hero-visual" delay={120}>
          <img src={image} alt={imageAlt ?? ''} />
          {orbit && <OrbitScene />}
        </Reveal>
      )}
    </section>
  )
}
