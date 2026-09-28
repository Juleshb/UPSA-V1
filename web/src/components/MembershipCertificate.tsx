import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { toDataURL } from 'qrcode'

export type CertificateDetails = {
  applicationId: string
  schoolName: string
  contactName?: string | null
  title?: string | null
  location?: string | null
  reviewedAt?: string | null
  reviewerName?: string | null
  reviewerTitle?: string | null
  verifyUrl?: string | null
}

function issuedOn(value?: string | null) {
  if (!value) return 'Date of confirmation'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date of confirmation'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function MembershipCertificate(details: CertificateDetails) {
  const holder = [details.contactName, details.title].filter(Boolean).join(', ')
  const signer = details.reviewerName || 'UPSA reader'
  const signerTitle = details.reviewerTitle || 'UPSA reader'
  const stageRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    if (!details.verifyUrl) {
      setQr('')
      return
    }
    let active = true
    void toDataURL(details.verifyUrl, {
      margin: 1,
      width: 220,
      color: { dark: '#092B3C', light: '#FFFFFF' },
    }).then((url) => {
      if (active) setQr(url)
    })
    return () => {
      active = false
    }
  }, [details.verifyUrl])

  useEffect(() => {
    const stage = stageRef.current
    const sheet = sheetRef.current
    if (!stage || !sheet) return
    const fit = () => {
      const full = sheet.offsetWidth
      if (!full) return
      const scale = Math.min(1, stage.clientWidth / full)
      sheet.style.transform = `scale(${scale})`
      stage.style.height = `${sheet.offsetHeight * scale}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [qr, details.schoolName])

  async function downloadPdf() {
    const sheet = sheetRef.current
    if (!sheet || busy) return
    setBusy(true)
    setPdfError('')
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.position = 'fixed'
    host.style.left = '0'
    host.style.top = '0'
    host.style.zIndex = '-1'
    host.style.pointerEvents = 'none'
    const clone = sheet.cloneNode(true) as HTMLDivElement
    clone.style.transform = 'none'
    host.appendChild(clone)
    document.body.appendChild(host)
    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#f7faf9',
        useCORS: true,
      })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
      pdf.save(`UPSA-membership-${details.applicationId}.pdf`)
    } catch {
      setPdfError('The PDF could not be prepared. Try again.')
    } finally {
      host.remove()
      setBusy(false)
    }
  }

  return (
    <article className="membership-certificate">
      <div className="certificate-stage" ref={stageRef}>
        <div className="certificate-sheet" ref={sheetRef}>
          <div className="certificate-outer">
            <div className="certificate-frame">
              <img className="certificate-logo" src="/rupsa-next-logo.png" alt="UPSA Next Payment" />
              <p className="certificate-org">Rwanda Union of Private Schools Association</p>
              <p className="certificate-verified">Verified membership</p>
              <h2>Certificate of Membership</h2>
              <p className="certificate-intro">This certifies that</p>
              <p className="certificate-school">{details.schoolName}</p>
              <p className="certificate-copy">
                is a verified member of the Rwanda Union of Private Schools Association.
                Scan the code to check that this certificate is genuine.
              </p>
              <dl>
                <div>
                  <dt>Reference</dt>
                  <dd>{details.applicationId}</dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>{issuedOn(details.reviewedAt)}</dd>
                </div>
                {details.location ? (
                  <div>
                    <dt>Location</dt>
                    <dd>{details.location}</dd>
                  </div>
                ) : null}
                {holder ? (
                  <div>
                    <dt>Member contact</dt>
                    <dd>{holder}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="certificate-foot">
                <div className="certificate-sign">
                  <p>{signer}</p>
                  <span />
                  <strong>{signer}</strong>
                  <small>{signerTitle}</small>
                </div>
                {qr ? (
                  <div className="certificate-qr">
                    <img src={qr} alt="QR code to verify this membership certificate" />
                    <small>Scan to verify</small>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="certificate-actions">
        <button className="button secondary" type="button" onClick={() => void downloadPdf()} disabled={busy}>
          {busy ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        {pdfError ? <p className="form-error" role="alert">{pdfError}</p> : null}
      </div>
    </article>
  )
}
