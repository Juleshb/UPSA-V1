import { Link } from 'react-router-dom'
import { navMenus } from '../nav'

const year = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <img src="/rupsa-next-logo-reversed.svg" alt="UPSA Next Payment" />
          <p>
            Official digital platform concept of the Rwanda Union of Private
            Schools Association — connecting schools, families and licensed
            financial institutions.
          </p>
        </div>
        {navMenus.map((menu) => (
          <div key={menu.id}>
            <b>{menu.label}</b>
            {menu.items.map((item) => (
              <Link key={item.to} to={item.to}>{item.label}</Link>
            ))}
          </div>
        ))}
        <div>
          <b>Contact</b>
          <Link to="/developers">API sandbox</Link>
          <Link to="/register">Register a school</Link>
          <Link to="/membership">Become a UPSA member</Link>
          <Link to="/contact">Request a briefing</Link>
          <span>Kigali, Rwanda</span>
          <span>Currency: RWF</span>
        </div>
      </div>
      <div className="footer-base">
        <small>© {year} UPSA Next Payment. Concept and proposed architecture.</small>
        <small>Regulated payment and lending activity remains with licensed institutions.</small>
        <a href="https://jules-hb-250.netlify.app/" target="_blank" rel="noreferrer">
          Designed by HABARUREMA Jules
        </a>
      </div>
    </footer>
  )
}
