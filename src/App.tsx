import './App.css'

function App() {
  const year = new Date().getFullYear()

  return (
    <main>
      <header className="topbar">
        <a className="mini-brand" href="#top" aria-label="RUPSA NEXT home">
          <img src="/rupsa-next-icon.svg" alt="" />
          <span>RUPSA NEXT</span>
        </a>
        <span className="edition">Brand concept · {year}</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Brand identity</div>
        <div className="hero-logo">
          <img src="/rupsa-next-logo.svg" alt="RUPSA NEXT" />
        </div>
        <h1>Move education forward.</h1>
        <p className="hero-copy">
          A confident identity for the digital bridge between schools,
          families and financial partners.
        </p>
        <div className="actions">
          <a className="button primary" href="/rupsa-next-logo.svg" download>
            Download primary logo
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10m0 0 4-4m-4 4L6 9M4 16h12" /></svg>
          </a>
          <a className="button secondary" href="/rupsa-next-icon.svg" download>
            Download icon
          </a>
        </div>
        <div className="scroll-note"><span /> Explore the system</div>
      </section>

      <section className="story section">
        <div className="section-label">01 / The mark</div>
        <div className="story-grid">
          <div>
            <h2>One path.<br />Three partners.</h2>
          </div>
          <div className="story-copy">
            <p>
              The open <strong>R</strong> creates a clear route forward. Its three
              rising bands represent schools, families and regulated financial
              institutions moving together.
            </p>
            <div className="traits">
              <span>Connected</span><span>Trusted</span><span>Progressive</span>
            </div>
          </div>
          <div className="mark-stage">
            <img src="/rupsa-next-icon.svg" alt="RUPSA NEXT symbol" />
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
          </div>
        </div>
      </section>

      <section className="applications section">
        <div className="section-label light">02 / Logo suite</div>
        <div className="logo-grid">
          <article className="logo-card light-card">
            <span>Primary</span>
            <img src="/rupsa-next-logo.svg" alt="RUPSA NEXT primary logo" />
          </article>
          <article className="logo-card dark-card">
            <span>Reversed</span>
            <img src="/rupsa-next-logo-reversed.svg" alt="RUPSA NEXT reversed logo" />
          </article>
          <article className="logo-card icon-card">
            <span>App icon</span>
            <img src="/rupsa-next-icon.svg" alt="RUPSA NEXT app icon" />
          </article>
        </div>
      </section>

      <section className="palette section">
        <div className="section-label">03 / Colour</div>
        <div className="palette-heading">
          <h2>Built for clarity<br />and confidence.</h2>
          <p>Deep navy establishes trust. Electric aqua signals access, movement and a digital-first future.</p>
        </div>
        <div className="swatches">
          <div className="swatch midnight"><b>RUPSA Midnight</b><span>#092B3C</span></div>
          <div className="swatch current"><b>Forward Aqua</b><span>#18D6B4</span></div>
          <div className="swatch sky"><b>Open Sky</b><span>#C7F7ED</span></div>
          <div className="swatch white"><b>Clear White</b><span>#F7FAF9</span></div>
        </div>
      </section>

      <section className="closing">
        <img src="/rupsa-next-logo-reversed.svg" alt="RUPSA NEXT" />
        <p>Payments. Access. Progress.</p>
        <a href="/rupsa-next-logo-mono.svg" download>Download monochrome logo <span>↗</span></a>
      </section>
    </main>
  )
}

export default App
