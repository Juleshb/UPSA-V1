import { usePageTitle } from '../components/usePageTitle'

export function Brand() {
  usePageTitle('Brand identity — UPSA & RUPSA')

  return (
    <main>
      <section className="hero brand-hero" id="top">
        <div className="eyebrow"><span /> Dual brand system</div>
        <div className="hero-duo">
          <figure className="hero-duo-item product">
            <img src="/rupsa-next-icon.svg" alt="" />
            <figcaption>
              <b>UPSA</b>
              <small>Next Payment</small>
              <em>Product</em>
            </figcaption>
          </figure>
          <span className="hero-duo-and" aria-hidden="true">×</span>
          <figure className="hero-duo-item company">
            <img src="/rupsa-plc-icon.svg" alt="" />
            <figcaption>
              <b>RUPSA</b>
              <small>Next Payment PLC</small>
              <em>Company</em>
            </figcaption>
          </figure>
        </div>
        <h1>Two names.<br />One promise.</h1>
        <p className="hero-copy">
          UPSA is the product families and schools use every day.
          RUPSA Next Payment PLC is the company that stands behind
          the Collateral Guarantee Support Facility.
        </p>
        <div className="actions">
          <a className="button primary" href="#upsa">
            UPSA product identity
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10m0 0 4-4m-4 4L6 9M4 16h12" /></svg>
          </a>
          <a className="button secondary" href="#rupsa">
            RUPSA company identity
          </a>
        </div>
        <div className="scroll-note"><span /> Explore the system</div>
      </section>

      <section className="relation section">
        <div className="section-label">01 / How they relate</div>
        <div className="relation-grid">
          <div>
            <h2>Same shield.<br />Different role.</h2>
          </div>
          <div className="relation-copy">
            <p>
              Both marks share the shield silhouette so the family stays
              recognisable. Inside, the symbols diverge: UPSA protects and
              verifies school payments; RUPSA underwrites the guarantee that
              makes those payments bankable.
            </p>
            <div className="relation-cards">
              <article>
                <img src="/rupsa-next-icon.svg" alt="" />
                <div>
                  <b>UPSA Next Payment</b>
                  <span>Product · lock + check</span>
                  <p>Digital bridge for school fees, financing and member services.</p>
                </div>
              </article>
              <article>
                <img src="/rupsa-plc-icon.svg" alt="" />
                <div>
                  <b>RUPSA Next Payment PLC</b>
                  <span>Company · columns + seal</span>
                  <p>Corporate entity and Collateral Guarantee Support Facility.</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="story section" id="upsa">
        <div className="section-label">02 / UPSA — the product</div>
        <div className="story-grid">
          <div>
            <h2>Protected.<br />Then verified.</h2>
          </div>
          <div className="story-copy">
            <p>
              The <strong>shield</strong> is the promise around a school’s records
              and funds. The lock keeps that promise, and the check marks a
              school that has been verified.
            </p>
            <div className="traits">
              <span>Protected</span><span>Trusted</span><span>Verified</span>
            </div>
          </div>
          <div className="mark-stage">
            <img src="/rupsa-next-icon.svg" alt="UPSA Next Payment symbol" />
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
          </div>
        </div>
      </section>

      <section className="applications section">
        <div className="section-label light">03 / UPSA logo suite</div>
        <div className="logo-grid">
          <article className="logo-card light-card">
            <span>Primary</span>
            <img src="/rupsa-next-logo.svg" alt="UPSA Next Payment primary logo" />
            <a className="logo-download" href="/rupsa-next-logo.svg" download="upsa-next-logo.svg">Download SVG</a>
          </article>
          <article className="logo-card dark-card">
            <span>Reversed</span>
            <img src="/rupsa-next-logo-reversed.svg" alt="UPSA Next Payment reversed logo" />
            <a className="logo-download" href="/rupsa-next-logo-reversed.svg" download="upsa-next-logo-reversed.svg">Download SVG</a>
          </article>
          <article className="logo-card icon-card">
            <span>App icon</span>
            <img src="/rupsa-next-icon.svg" alt="UPSA Next Payment app icon" />
            <a className="logo-download" href="/rupsa-next-icon.svg" download="upsa-next-icon.svg">Download SVG</a>
          </article>
        </div>
        <p className="asset-formats suite-formats">
          Also available
          <a href="/rupsa-next-logo.png" download="upsa-next-logo.png">Primary PNG</a>
          <a href="/rupsa-next-icon.png" download="upsa-next-icon.png">Icon PNG</a>
          <a href="/rupsa-next-logo-mono.png" download="upsa-next-logo-mono.png">Monochrome PNG</a>
          <a href="/upsa-next-logo-lockup.svg" download="upsa-next-logo-lockup.svg">Vector lockup</a>
        </p>
      </section>

      <section className="palette section">
        <div className="section-label">04 / UPSA colour</div>
        <div className="palette-heading">
          <h2>Clarity and<br />forward motion.</h2>
          <p>Deep navy establishes trust. Electric aqua signals access, movement and a digital-first product.</p>
        </div>
        <div className="swatches">
          <div className="swatch midnight"><b>UPSA Midnight</b><span>#092B3C</span></div>
          <div className="swatch current"><b>Forward Aqua</b><span>#18D6B4</span></div>
          <div className="swatch sky"><b>Open Sky</b><span>#C7F7ED</span></div>
          <div className="swatch white"><b>Clear White</b><span>#F7FAF9</span></div>
        </div>
      </section>

      <section className="story section company-story" id="rupsa">
        <div className="section-label">05 / RUPSA — the company</div>
        <div className="story-grid">
          <div>
            <h2>Collateral.<br />Then guaranteed.</h2>
          </div>
          <div className="story-copy">
            <p>
              The same <strong>shield</strong> frames the Collateral Guarantee
              Support Facility. Twin columns carry the structure; the seal
              confirms a guarantee has been issued.
            </p>
            <div className="traits company-traits">
              <span>Collateral</span><span>Guarantee</span><span>Facility</span>
            </div>
          </div>
          <div className="mark-stage company-mark">
            <img src="/rupsa-plc-icon.svg" alt="RUPSA Next Payment PLC symbol" />
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
          </div>
        </div>
      </section>

      <section className="applications section company-apps">
        <div className="section-label light">06 / RUPSA logo suite</div>
        <div className="logo-grid">
          <article className="logo-card light-card">
            <span>Primary</span>
            <img src="/rupsa-plc-logo.svg" alt="RUPSA Next Payment PLC primary logo" />
            <a className="logo-download" href="/rupsa-plc-logo.svg" download="rupsa-plc-logo.svg">Download SVG</a>
          </article>
          <article className="logo-card dark-card">
            <span>Reversed</span>
            <img src="/rupsa-plc-logo-reversed.svg" alt="RUPSA Next Payment PLC reversed logo" />
            <a className="logo-download" href="/rupsa-plc-logo-reversed.svg" download="rupsa-plc-logo-reversed.svg">Download SVG</a>
          </article>
          <article className="logo-card icon-card company-icon-card">
            <span>Facility mark</span>
            <img src="/rupsa-plc-icon.svg" alt="RUPSA Next Payment PLC mark" />
            <a className="logo-download" href="/rupsa-plc-icon.svg" download="rupsa-plc-icon.svg">Download SVG</a>
          </article>
        </div>
      </section>

      <section className="palette section company-palette">
        <div className="section-label">07 / RUPSA colour</div>
        <div className="palette-heading">
          <h2>Institutional<br />and assured.</h2>
          <p>Shared navy keeps the family together. Guarantee gold marks the company and the facility that underwrites trust.</p>
        </div>
        <div className="swatches">
          <div className="swatch midnight"><b>RUPSA Midnight</b><span>#092B3C</span></div>
          <div className="swatch gold"><b>Guarantee Gold</b><span>#D4A84B</span></div>
          <div className="swatch reserve"><b>Reserve Bronze</b><span>#C4963A</span></div>
          <div className="swatch white"><b>Clear White</b><span>#F7FAF9</span></div>
        </div>
      </section>

      <section className="practice section">
        <div className="section-label light">08 / UPSA in practice</div>
        <div className="practice-heading">
          <h2>A product brand<br />made to be useful.</h2>
          <p>From a parent’s first tap to a member’s community event, the UPSA identity stays clear, warm and recognisable.</p>
        </div>

        <div className="practice-grid">
          <article className="practice-card app-showcase">
            <div className="practice-meta">
              <span>Member app</span>
              <b>Home</b>
            </div>
            <div className="phone" aria-label="UPSA Next Payment member app home screen mockup">
              <div className="phone-screen">
                <div className="phone-top"><span>9:41</span><span>● ᯤ</span></div>
                <div className="app-header">
                  <img src="/rupsa-next-icon.svg" alt="" />
                  <span>Good morning,<b>Sarah</b></span>
                  <button type="button" aria-label="Notifications">•</button>
                </div>
                <div className="balance-card">
                  <span>School fees balance</span>
                  <strong>UGX 1,240,000</strong>
                  <small>Greenhill Academy · Term III</small>
                  <button type="button">Pay school fees <span>→</span></button>
                </div>
                <div className="quick-title"><b>Quick access</b><span>View all</span></div>
                <div className="quick-grid">
                  <div><i>↗</i><span>Payments</span></div>
                  <div><i>▤</i><span>Statements</span></div>
                  <div><i>◇</i><span>Financing</span></div>
                </div>
                <div className="activity">
                  <b>Recent activity</b>
                  <div><span className="activity-icon">✓</span><p><strong>School fee payment</strong><small>Today · Greenhill Academy</small></p><b>−450k</b></div>
                </div>
                <nav className="phone-nav"><b>⌂<small>Home</small></b><span>◫<small>Payments</small></span><span>○<small>Community</small></span><span>♙<small>Profile</small></span></nav>
              </div>
            </div>
          </article>

          <article className="practice-card poster-showcase">
            <div className="practice-meta">
              <span>Community event</span>
              <b>Poster</b>
            </div>
            <div className="poster" aria-label="UPSA Next Payment community event poster mockup">
              <div className="poster-top">
                <img src="/rupsa-next-logo-reversed.svg" alt="UPSA Next Payment" />
                <span>Community<br />Series 01</span>
              </div>
              <div className="poster-orbit"><i /><i /><i /></div>
              <div className="poster-copy">
                <span>Parents × Schools × Partners</span>
                <h3>Building<br />bright futures,<br /><em>together.</em></h3>
              </div>
              <div className="poster-footer">
                <div><b>17 OCT</b><span>Saturday · 10:00 AM</span></div>
                <div><b>UPSA HOUSE</b><span>Kampala, Uganda</span></div>
                <strong>→</strong>
              </div>
            </div>
          </article>

          <article className="practice-card web-showcase">
            <div className="practice-meta">
              <span>School portal</span>
              <b>Web app</b>
            </div>
            <div className="browser-mockup" aria-label="UPSA Next Payment school portal web app mockup">
              <div className="browser-bar">
                <div><i /><i /><i /></div>
                <span>app.rupsanext.org</span>
                <b>⌁</b>
              </div>
              <div className="product-shell">
                <aside>
                  <img src="/rupsa-next-icon.svg" alt="" />
                  <nav>
                    <b><i>⌂</i> Overview</b>
                    <span><i>▤</i> Collections</span>
                    <span><i>♙</i> Students</span>
                    <span><i>◇</i> Financing</span>
                    <span><i>◎</i> Reports</span>
                  </nav>
                  <div className="portal-user"><i>GK</i><span><b>Grace K.</b><small>Administrator</small></span></div>
                </aside>
                <div className="web-content">
                  <div className="web-welcome"><div><span>Thursday, 24 September</span><h3>Welcome back, Grace</h3></div><button type="button">+ New payment</button></div>
                  <div className="stat-row">
                    <div><span>Total collected</span><strong>UGX 184.6M</strong><small>↑ 12.4% this term</small></div>
                    <div><span>Collection rate</span><strong>78.4%</strong><small>1,204 of 1,536 students</small></div>
                    <div><span>Outstanding</span><strong>UGX 50.8M</strong><small>332 student accounts</small></div>
                  </div>
                  <div className="chart-panel">
                    <div><b>Fee collections</b><span>Last 6 months ▾</span></div>
                    <div className="chart">
                      <i style={{height: '32%'}} /><i style={{height: '47%'}} /><i style={{height: '41%'}} />
                      <i style={{height: '65%'}} /><i style={{height: '58%'}} /><i style={{height: '82%'}} />
                    </div>
                    <div className="chart-labels"><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span><span>AUG</span><span>SEP</span></div>
                  </div>
                  <div className="web-side-panel"><b>Payment activity</b><span><i>✓</i><small>Tuition · S. Nakato<b>UGX 450,000</b></small></span><span><i>✓</i><small>Registration · J. Ouma<b>UGX 125,000</b></small></span><span><i>↗</i><small>Transport · M. Ayaa<b>UGX 80,000</b></small></span></div>
                </div>
              </div>
            </div>
          </article>

          <article className="practice-card desktop-showcase">
            <div className="practice-meta">
              <span>Finance workspace</span>
              <b>Desktop app</b>
            </div>
            <div className="desktop-scene">
              <div className="desktop-window" aria-label="UPSA Next Payment finance desktop app mockup">
                <div className="desktop-titlebar">
                  <div><i /><i /><i /></div>
                  <img src="/rupsa-next-icon.svg" alt="" />
                  <span>UPSA Next Payment Finance</span>
                  <b>— □ ×</b>
                </div>
                <div className="desktop-body">
                  <aside>
                    <b>WORKSPACE</b>
                    <span className="active">▦ &nbsp; Reconciliation</span>
                    <span>⇄ &nbsp; Transactions</span>
                    <span>▤ &nbsp; Settlements</span>
                    <span>◇ &nbsp; Finance requests</span>
                    <b>MANAGE</b>
                    <span>♙ &nbsp; Institutions</span>
                    <span>⚙ &nbsp; Preferences</span>
                  </aside>
                  <div className="desktop-content">
                    <div className="desktop-heading"><div><small>OPERATIONS / RECONCILIATION</small><h3>Today’s settlement</h3></div><button type="button">Export report</button></div>
                    <div className="settlement-summary"><div><span>Ready to settle</span><strong>UGX 24,850,000</strong></div><div><span>287 transactions</span><b>All records matched</b></div><button type="button">Review &amp; settle →</button></div>
                    <div className="table-head"><b>Recent transactions</b><span>Filter &nbsp; ⋮</span></div>
                    <div className="data-table">
                      <div className="data-labels"><span>REFERENCE</span><span>INSTITUTION</span><span>AMOUNT</span><span>STATUS</span></div>
                      <div><span>RP-94281</span><b>Greenhill Academy</b><span>UGX 450,000</span><i>Matched</i></div>
                      <div><span>RP-94280</span><b>St. Kizito School</b><span>UGX 1,240,000</span><i>Matched</i></div>
                      <div><span>RP-94279</span><b>Bright Future College</b><span>UGX 785,000</span><i>Matched</i></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="desktop-stand"><i /></div>
            </div>
          </article>

          <article className="practice-card identity-showcase">
            <div className="practice-meta">
              <span>Member experience</span>
              <b>Identity cards</b>
            </div>
            <div className="id-stage" aria-label="UPSA Next Payment member identity card mockups">
              <div className="id-card id-back">
                <img src="/rupsa-next-logo-reversed.svg" alt="UPSA Next Payment" />
                <p>CONNECTED FOR<br />EDUCATION</p>
                <div className="id-wave" />
              </div>
              <div className="id-card id-front">
                <div className="id-brand"><img src="/rupsa-next-logo.svg" alt="UPSA Next Payment" /><span>MEMBER</span></div>
                <div className="avatar">AN</div>
                <div className="id-details"><strong>Amina Nakato</strong><span>School Administrator</span><small>RN-2048-0176</small></div>
                <div className="id-code" aria-hidden="true"><i /><i /><i /><i /></div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="closing dual-closing">
        <div className="closing-marks">
          <img src="/rupsa-next-logo-reversed.svg" alt="UPSA Next Payment" />
          <img src="/rupsa-plc-logo-reversed.svg" alt="RUPSA Next Payment PLC" />
        </div>
        <p>Product · Company · Guarantee</p>
        <div className="closing-links">
          <a href="/rupsa-next-logo.svg" download="upsa-next-logo.svg">UPSA primary <span>SVG</span></a>
          <a href="/rupsa-plc-logo.svg" download="rupsa-plc-logo.svg">RUPSA primary <span>SVG</span></a>
        </div>
      </section>
    </main>
  )
}
