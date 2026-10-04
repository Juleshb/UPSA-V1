import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Assistant } from './SiteAssistant'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function SiteLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const developers = pathname.startsWith('/developers')

  return (
    <div className={`site site-public${developers ? ' site-dev' : ''}`}>
      <div className="site-chrome">
        <div className="official-bar">
          <span>Proposed by the Universor of Private Schools Association</span>
          <span className="official-dot" aria-hidden="true" />
          <span>{developers ? 'Developer sandbox' : 'Official platform concept'}</span>
          <span className="official-dot" aria-hidden="true" />
          <span>Rwanda</span>
        </div>
        <SiteHeader key={pathname} />
      </div>
      <div className="page-stage" key={pathname}>
        <Outlet />
      </div>
      {!developers && <SiteFooter />}
      <Assistant />
    </div>
  )
}
