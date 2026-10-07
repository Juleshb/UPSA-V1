import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, openProtectedFile, protectedObjectUrl, type StudentGuardianInput } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, PageHeading, Panel, StatusPill } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

const DOCUMENT_LABELS: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Birth certificate',
  STUDENT_ID: 'Student ID',
  PREVIOUS_SCHOOL_RECORDS: 'Previous school records',
  TRANSFER_CERTIFICATE: 'Transfer certificate',
  MEDICAL: 'Medical or other required school documentation',
  CUSTODY: 'Custody or authorization document',
  OTHER: 'Other supporting documents',
}

function text(value: string | null | undefined) {
  return value && value.trim() ? value : '—'
}

export function StudentFile() {
  const { studentId = '' } = useParams()
  const { can } = useAuth()
  const record = useLoad(() => api.students.file(studentId), [studentId])
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  usePageTitle(record.data ? `${record.data.studentName} — UPSA Next Payment` : 'Student file — UPSA Next Payment')

  useEffect(() => {
    if (!record.data?.hasPhoto) return
    let url = ''
    let active = true
    protectedObjectUrl(`/students/${encodeURIComponent(studentId)}/photo`)
      .then((next) => {
        if (!active) {
          URL.revokeObjectURL(next)
          return
        }
        url = next
        setPhotoUrl(next)
      })
      .catch(() => {
        if (active) setPhotoUrl('')
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [record.data?.hasPhoto, studentId])

  async function review(documentId: string, verificationStatus: 'VERIFIED' | 'REJECTED') {
    setBusy(true)
    setError('')
    try {
      const next = await api.students.reviewDocument(studentId, documentId, verificationStatus)
      record.setData(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  async function addGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body: StudentGuardianInput = {
      fullName: String(form.get('fullName') || ''),
      relationship: String(form.get('relationship') || 'Guardian'),
      phone: String(form.get('phone') || '') || undefined,
      email: String(form.get('email') || '') || undefined,
      nationalId: String(form.get('nationalId') || '') || undefined,
      primary: form.get('primary') === 'on',
      emergencyContact: form.get('emergencyContact') === 'on',
      financialResponsibility: form.get('financialResponsibility') === 'on',
      communicationAuthorization: form.get('communicationAuthorization') === 'on',
      paymentAuthorization: form.get('paymentAuthorization') === 'on',
    }
    setBusy(true)
    setError('')
    try {
      const next = await api.students.addGuardian(studentId, body)
      record.setData(next)
      setAdding(false)
      event.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The guardian could not be linked.')
    } finally {
      setBusy(false)
    }
  }

  const student = record.data

  return (
    <div className="app-page student-register">
      <PageHeading
        kicker="Families"
        title={student?.studentName ?? 'Student file'}
        lead={student ? `${student.studentId} · ${student.schoolName}` : 'Registration file'}
        icon="family"
        actions={<Link className="button secondary" to="/app/students">Back to students</Link>}
      />
      {(record.error || error) && <Banner>{record.error || error}</Banner>}
      {record.loading && <p className="app-empty">Loading the student file…</p>}
      {student && (
        <>
          <Panel icon="family" title="Student information">
            <div className="student-summary">
              {photoUrl
                ? <img className="student-photo" src={photoUrl} alt="" />
                : <div className="student-photo empty">No photo on file</div>}
              <dl className="app-dl">
                <Fact label="Student ID" value={student.studentId} />
                <Fact label="SDMS code" value={student.studentExternalId} />
                <Fact label="Name" value={[student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') || student.studentName} />
                <Fact label="Date of birth" value={text(student.dateOfBirth)} />
                <Fact label="Gender" value={text(student.gender)} />
                <Fact label="Nationality" value={text(student.nationality)} />
                <Fact label="Previous school" value={text(student.previousSchool)} />
                <Fact label="Admission date" value={text(student.admissionDate)} />
                <Fact label="School" value={student.schoolName} />
                <Fact label="Academic year" value={student.academicYear} />
                <Fact label="Class" value={student.classLevel} />
                <Fact label="Stream" value={text(student.stream)} />
                <Fact label="Grade" value={text(student.grade)} />
                <div><dt>Student status</dt><dd><StatusPill value={student.status} /></dd></div>
              </dl>
            </div>
          </Panel>

          <Panel icon="school" title="Contact and address">
            <dl className="app-dl">
              <Fact label="Province" value={text(student.address.province)} />
              <Fact label="District" value={text(student.address.district)} />
              <Fact label="Sector" value={text(student.address.sector)} />
              <Fact label="Cell" value={text(student.address.cell)} />
              <Fact label="Village" value={text(student.address.village)} />
              <Fact label="Physical address" value={text(student.address.physicalAddress)} />
              <Fact label="Telephone" value={text(student.address.telephone)} />
              <Fact label="Emergency contact" value={text(student.address.emergencyContact)} />
            </dl>
          </Panel>

          <Panel
            icon="family"
            title="Parents and guardians"
            action={can('student.write') && <button className="button secondary" type="button" onClick={() => setAdding((open) => !open)}>{adding ? 'Close' : 'Add guardian'}</button>}
          >
            {adding && (
              <form className="app-form" onSubmit={addGuardian}>
                <Field label="Full name" note="required"><input name="fullName" required /></Field>
                <Field label="Relationship" note="required">
                  <select name="relationship" defaultValue="Guardian">
                    {['Mother', 'Father', 'Guardian', 'Sponsor', 'Other authorized relationship'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Telephone" note="optional"><input name="phone" /></Field>
                <Field label="Email" note="optional"><input name="email" type="email" /></Field>
                <Field label="National ID" note="optional"><input name="nationalId" /></Field>
                <div className="guardian-flags">
                  <label className="app-check"><input name="primary" type="checkbox" /> Primary guardian</label>
                  <label className="app-check"><input name="emergencyContact" type="checkbox" /> Emergency contact</label>
                  <label className="app-check"><input name="financialResponsibility" type="checkbox" /> Financially responsible</label>
                  <label className="app-check"><input name="communicationAuthorization" type="checkbox" /> Authorized for school communication</label>
                  <label className="app-check"><input name="paymentAuthorization" type="checkbox" /> Authorized for payment</label>
                </div>
                <button className="button primary" type="submit" disabled={busy}>{busy ? 'Linking…' : 'Link guardian'}</button>
              </form>
            )}
            {student.guardians.length === 0 && <p className="app-empty">No parent or guardian is linked yet.</p>}
            <div className="guardian-list">
              {student.guardians.map((guardian) => (
                <article className="guardian-card" key={guardian.guardianId}>
                  <header>
                    <b>{guardian.fullName}</b>
                    <StatusPill value={guardian.primary ? 'PRIMARY' : guardian.relationship} />
                  </header>
                  <dl className="app-dl">
                    <Fact label="Parent / guardian ID" value={guardian.guardianId} />
                    <Fact label="Relationship" value={guardian.relationship} />
                    <Fact label="Telephone" value={text(guardian.phone)} />
                    <Fact label="Email" value={text(guardian.email)} />
                    <Fact label="Emergency contact" value={guardian.emergencyContact ? 'Yes' : 'No'} />
                    <Fact label="Financially responsible" value={guardian.financialResponsibility ? 'Yes' : 'No'} />
                    <Fact label="Authorized for school communication" value={guardian.communicationAuthorization ? 'Yes' : 'No'} />
                    <Fact label="Authorized for payment" value={guardian.paymentAuthorization ? 'Yes' : 'No'} />
                  </dl>
                </article>
              ))}
            </div>
          </Panel>

          <Panel icon="ledger" title="Documents">
            {student.documents.length === 0 && <p className="app-empty">No documents have been attached.</p>}
            <div className="document-list">
              {student.documents.map((document) => (
                <article className="document-row" key={document.documentId}>
                  <header>
                    <b>{DOCUMENT_LABELS[document.documentType] ?? document.documentType}</b>
                    <StatusPill value={document.verificationStatus} />
                  </header>
                  <dl className="app-dl">
                    <Fact label="Document number" value={text(document.documentNumber)} />
                    <Fact label="Issue date" value={text(document.issueDate)} />
                    <Fact label="Expiry date" value={text(document.expiryDate)} />
                    <Fact label="Attachment" value={document.fileName} />
                  </dl>
                  <div className="student-actions">
                    <button className="button secondary" type="button" onClick={() => openProtectedFile(`/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(document.documentId)}/file`).catch((err) => setError(err instanceof Error ? err.message : 'The file could not be opened.'))}>Open</button>
                    {can('student.write') && document.verificationStatus !== 'VERIFIED' && (
                      <button className="button primary" type="button" disabled={busy} onClick={() => review(document.documentId, 'VERIFIED')}>Mark verified</button>
                    )}
                    {can('student.write') && document.verificationStatus !== 'REJECTED' && (
                      <button className="button secondary" type="button" disabled={busy} onClick={() => review(document.documentId, 'REJECTED')}>Reject</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel icon="ledger" title="Financial profile">
            <dl className="app-dl">
              <Fact label="Student ID" value={student.studentId} />
              <Fact label="School ID" value={student.schoolId} />
              <Fact label="Parent / guardian ID" value={text(student.guardians.find((guardian) => guardian.primary)?.guardianId ?? student.guardians[0]?.guardianId)} />
              <Fact label="Fee category" value={text(student.financial.feeCategory)} />
              <Fact label="Academic year" value={student.financial.academicYear} />
              <Fact label="Fee structure" value={text(student.financial.feeStructure)} />
              <Fact label="Invoice account" value={student.financial.invoiceAccount} />
              <Fact label="Scholarship" value={text(student.financial.scholarship)} />
              <Fact label="Discount" value={student.financial.discount != null ? money(student.financial.discount, student.financial.currency) : '—'} />
              <Fact label="Payment plan" value={text(student.financial.paymentPlan)} />
              <Fact label="Outstanding balance" value={money(student.financial.outstandingBalance, student.financial.currency)} />
            </dl>
            <p className="app-empty">{student.financial.ledger}</p>
          </Panel>
        </>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
