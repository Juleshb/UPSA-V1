import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type RegistrationDocumentInput } from '../../platform/api'
import { Banner, Field, FieldGroup, PageHeading, SearchSelect } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'
import {
  DOCUMENT_TYPES,
  PARTY_FIELDS,
  REGISTRATION_KINDS,
  isPartyKind,
  optionLabel,
  sectionsFor,
  type CatalogField,
  type PartyKind,
} from './registrationCatalog'

type DraftDocument = {
  key: string
  documentType: string
  documentNumber: string
  issueDate: string
  expiryDate: string
  issuingAuthority: string
  file: File | null
}

function blankDocument(kind: PartyKind): DraftDocument {
  return {
    key: crypto.randomUUID(),
    documentType: DOCUMENT_TYPES[kind][0][0],
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    file: null,
  }
}

export function RegistrationForm() {
  const { kind: kindParam = '' } = useParams()
  const kind = isPartyKind(kindParam) ? kindParam : null
  const meta = REGISTRATION_KINDS.find((item) => item.id === kind)
  usePageTitle(meta ? `Register ${meta.label} — UPSA Next Payment` : 'Register — UPSA Next Payment')
  const navigate = useNavigate()
  const schools = useLoad(() => kind === 'TEACHER' ? api.schools.list() : Promise.resolve({ items: [] }), [kind])
  const fields = kind ? PARTY_FIELDS[kind] : []
  const initial = useMemo(() => {
    const values: Record<string, string | boolean> = {}
    for (const field of fields) values[field.key] = field.input === 'checkbox' ? false : ''
    return values
  }, [kind])
  const [values, setValues] = useState<Record<string, string | boolean>>(initial)
  const [documents, setDocuments] = useState<DraftDocument[]>([])
  useEffect(() => {
    setValues(initial)
    setDocuments([])
  }, [initial])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  useEffect(() => {
    setStep(0)
  }, [kind])

  if (!kind || !meta) {
    return (
      <div className="app-page">
        <Banner>Choose a registration type from the registry.</Banner>
        <Link to="/app/registration">Back to registration</Link>
      </div>
    )
  }

  const party = kind
  const sections = sectionsFor(party)
  const steps = [...sections, 'Documents', 'Review']
  const current = steps[step] ?? steps[0]

  function setField(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const profile: Record<string, string | boolean> = {}
      const automatic = new Set(fields.filter((field) => field.input === 'automatic').map((field) => field.key))
      for (const [key, value] of Object.entries(values)) {
        if (automatic.has(key)) continue
        if (typeof value === 'boolean' || value.trim()) profile[key] = typeof value === 'string' ? value.trim() : value
      }
      const prepared: RegistrationDocumentInput[] = []
      for (const document of documents) {
        if (!document.file && !document.documentNumber) continue
        let uploadId: string | undefined
        let fileName = document.file?.name ?? document.documentType
        if (document.file) {
          const body = new FormData()
          body.set('file', document.file)
          const uploaded = await api.registrations.upload(body)
          uploadId = uploaded.uploadId
          fileName = uploaded.fileName
        }
        prepared.push({
          documentType: document.documentType,
          documentNumber: document.documentNumber || undefined,
          issueDate: document.issueDate || undefined,
          expiryDate: document.expiryDate || undefined,
          issuingAuthority: document.issuingAuthority || undefined,
          fileName,
          uploadId,
        })
      }
      const created = await api.registrations.create({ kind: party, profile, documents: prepared })
      navigate(`/app/registration/${created.registrationId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The registration could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  function missingIn(section: string) {
    return fields.filter((field) => field.section === section && field.required).filter((field) => {
      const value = values[field.key]
      if (field.input === 'checkbox') return value !== true
      return !String(value ?? '').trim()
    })
  }

  function go(next: number) {
    const target = Math.max(0, Math.min(next, steps.length - 1))
    if (target > step) {
      for (let index = step; index < target && index < sections.length; index += 1) {
        const gaps = missingIn(sections[index])
        if (gaps.length) {
          setError(`Enter ${gaps[0].label.toLowerCase()} before continuing.`)
          setStep(index)
          return
        }
      }
    }
    setError('')
    setStep(target)
  }

  function displayValue(field: CatalogField) {
    const raw = values[field.key]
    if (field.input === 'automatic') return 'Assigned on save'
    if (raw == null || raw === '' || raw === false) return '—'
    if (typeof raw === 'boolean') return 'Yes'
    if (field.input === 'school') {
      return schools.data?.items.find((school) => school.schoolId === raw)?.schoolName ?? String(raw)
    }
    if (field.input === 'select') return optionLabel(field, String(raw))
    return String(raw)
  }

  function renderField(field: CatalogField) {
    if (field.input === 'automatic') {
      return (
        <Field key={field.key} label={field.label} note="automatic" hint={field.hint ?? 'Recorded with this registration.'}>
          <input value="Assigned on save" readOnly />
        </Field>
      )
    }
    if (field.input === 'checkbox') {
      return (
        <label key={field.key} className="app-check full">
          <input type="checkbox" checked={Boolean(values[field.key])} onChange={(event) => setField(field.key, event.target.checked)} />
          {field.label}
        </label>
      )
    }
    if (field.input === 'school') {
      return (
        <Field key={field.key} label={field.label} note={field.required ? 'required' : 'optional'} span="full">
          <SearchSelect
            name={field.key}
            value={String(values[field.key] ?? '')}
            onChange={(value) => setField(field.key, value)}
            placeholder="Search schools…"
            allowEmpty
            options={(schools.data?.items ?? []).map((school) => ({
              value: school.schoolId,
              label: school.schoolName,
              hint: school.address?.district,
            }))}
          />
        </Field>
      )
    }
    const inputType = field.input === 'select' ? undefined : field.input
    return (
      <Field key={field.key} label={field.label} note={field.required ? 'required' : 'optional'} hint={field.hint}>
        {field.input === 'select' ? (
          <select value={String(values[field.key] ?? '')} onChange={(event) => setField(field.key, event.target.value)}>
            <option value="">Select</option>
            {field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        ) : (
          <input type={inputType} value={String(values[field.key] ?? '')} onChange={(event) => setField(field.key, event.target.value)} />
        )}
      </Field>
    )
  }

  return (
    <div className="app-page form-wizard">
      <PageHeading
        kicker="Registration"
        title={`Register ${meta.label.toLowerCase()}`}
        lead={meta.detail}
        icon="user"
        actions={<Link className="button secondary" to="/app/registration">Back to registry</Link>}
      />
      <div className="form-steps" role="tablist">
        {steps.map((title, index) => (
          <button
            key={title}
            type="button"
            className={index === step ? 'current' : index < step ? 'done' : ''}
            aria-current={index === step ? 'step' : undefined}
            onClick={() => go(index)}
          >
            <b>{index < step ? 'Done' : `Step ${index + 1}`}</b>
            <span>{title}</span>
          </button>
        ))}
      </div>
      <div className="form-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="form-step-label">Step {step + 1} of {steps.length} · {current}</p>
      {error && <Banner>{error}</Banner>}
      <form onSubmit={onSubmit}>
        {sections.includes(current) && (
          <FieldGroup title={current}>
            {fields.filter((field) => field.section === current).map(renderField)}
          </FieldGroup>
        )}
        {current === 'Documents' && (
          <section className="document-list">
            {documents.map((document, index) => (
              <article className="document-row" key={document.key}>
                <header>
                  <b>Document {index + 1}</b>
                  <button className="button secondary" type="button" onClick={() => setDocuments((rows) => rows.filter((row) => row.key !== document.key))}>Remove</button>
                </header>
                <div className="app-form">
                  <Field label="Document type">
                    <select value={document.documentType} onChange={(event) => setDocuments((rows) => rows.map((row) => row.key === document.key ? { ...row, documentType: event.target.value } : row))}>
                      {DOCUMENT_TYPES[party].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="Document number">
                    <input value={document.documentNumber} onChange={(event) => setDocuments((rows) => rows.map((row) => row.key === document.key ? { ...row, documentNumber: event.target.value } : row))} />
                  </Field>
                  <Field label="Issue date">
                    <input type="date" value={document.issueDate} onChange={(event) => setDocuments((rows) => rows.map((row) => row.key === document.key ? { ...row, issueDate: event.target.value } : row))} />
                  </Field>
                  <Field label="Expiry date">
                    <input type="date" value={document.expiryDate} onChange={(event) => setDocuments((rows) => rows.map((row) => row.key === document.key ? { ...row, expiryDate: event.target.value } : row))} />
                  </Field>
                  <Field label="Issuing authority">
                    <input value={document.issuingAuthority} onChange={(event) => setDocuments((rows) => rows.map((row) => row.key === document.key ? { ...row, issuingAuthority: event.target.value } : row))} />
                  </Field>
                  <Field label="File" hint="PDF, PNG, or JPEG." span="full">
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setDocuments((rows) => rows.map((row) => row.key === document.key ? { ...row, file: event.target.files?.[0] ?? null } : row))} />
                  </Field>
                </div>
              </article>
            ))}
            <button className="button secondary" type="button" onClick={() => setDocuments((rows) => [...rows, blankDocument(party)])}>Add document</button>
          </section>
        )}
        {current === 'Review' && (
          <FieldGroup title="Confirm the registration">
            {fields.map((field) => (
              <Field key={field.key} label={field.label}>
                <input value={displayValue(field)} readOnly />
              </Field>
            ))}
            <Field label="Documents" span="full">
              <input value={documents.length ? `${documents.length} attached` : 'None attached'} readOnly />
            </Field>
          </FieldGroup>
        )}
        <div className="student-actions">
          <button className="button secondary" type="button" disabled={step === 0 || busy} onClick={() => go(step - 1)}>Back</button>
          {current === 'Review' ? (
            <button className="button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit registration'}</button>
          ) : (
            <button className="button primary" type="button" onClick={() => go(step + 1)}>Continue</button>
          )}
        </div>
      </form>
    </div>
  )
}
