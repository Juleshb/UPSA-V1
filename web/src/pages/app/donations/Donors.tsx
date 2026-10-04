import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { shortDate } from '../../../platform/format'
import { Banner, Field, FieldGroup, PageHeading, Panel, SearchField, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { getDistricts, getProvinces } from 'rwanda-locations'
import { COUNTRIES, DONOR_TYPES, ORG_DONOR_TYPES } from './catalog'
import { Check, DocFields, FormSteps, StepNav, useAction, useFormSteps } from './kit'

const DONOR_STEPS = ['Donor', 'Address', 'Contact', 'Documents']

const RWANDA_DISTRICTS = getProvinces().flatMap((province) => getDistricts(province) ?? [])

export function DonorList() {
  usePageTitle('Donors — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [donorType, setDonorType] = useState('')
  const donors = useLoad(() => api.donations.donors({ q: query || undefined, status: status || undefined, donorType: donorType || undefined }), [query, status, donorType])

  return (
    <>
      <PageHeading kicker="Donors" title="Donor register" lead="Individuals, companies, foundations, and anonymous donors are registered, then verified before they can pledge or give." icon="user" actions={<Link className="button primary" to="/app/donations/donors/new">Register donor</Link>} />
      {donors.error && <Banner>{donors.error}</Banner>}
      <Panel icon="search" title="All donors" action={<Link to="/app/donations/donors?status=PENDING_VERIFICATION">Verification queue</Link>}>
        <div className="app-inline-actions">
          <SearchField value={query} onChange={setQuery} placeholder="Name, ID, telephone, email…" />
          <select value={donorType} onChange={(event) => setDonorType(event.target.value)} aria-label="Donor type">
            <option value="">All types</option>
            {DONOR_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {['DRAFT', 'REGISTERED', 'PENDING_VERIFICATION', 'VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        {donors.loading ? <p className="app-empty">Loading donors…</p> : (
          <Table
            columns={['Donor', 'Type', 'Country', 'Telephone', 'Status', 'Opened']}
            empty="No donors match that search."
            rows={(donors.data?.items ?? []).map((item) => [
              <Link key={item.id} to={`/app/donations/donors/${item.id}`}>{item.name}</Link>,
              item.donorType.replaceAll('_', ' '),
              item.country,
              item.telephone || '—',
              <StatusPill key={`${item.id}-status`} value={item.status} />,
              shortDate(item.createdAt),
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function DonorForm() {
  usePageTitle('Register donor — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const [donorType, setDonorType] = useState('INDIVIDUAL')
  const [country, setCountry] = useState('Rwanda')
  const [documents, setDocuments] = useState<DonationDoc[]>([{ documentType: 'IDENTIFICATION', fileName: '' }])
  const organization = ORG_DONOR_TYPES.includes(donorType)
  const saved = steps.values

  function submit(mode: 'draft' | 'register', data: Record<string, string>) {
    void run(async () => {
      const savedDonor = await api.donations.saveDonor({
        ...data,
        donorType,
        country,
        documents: documents.filter((item) => item.fileName.trim()),
        mode,
      })
      navigate(`/app/donations/donors/${savedDonor.id}`)
    })
  }

  return (
    <div className="form-wizard">
      <PageHeading kicker="Donors" title="Register donor" lead="The donor ID is assigned when the file is saved. Organisation fields are required for companies, foundations, institutions, and partners." icon="user" actions={<Link className="button secondary" to="/app/donations/donors">All donors</Link>} />
      {error && <Banner>{error}</Banner>}
      <FormSteps steps={DONOR_STEPS} step={steps.step} onPick={(index) => {
        const form = document.getElementById('donor-form') as HTMLFormElement
        steps.move(form, index > steps.step ? steps.step + 1 : index, DONOR_STEPS.length)
      }} />
      <form id="donor-form" key={steps.step} onSubmit={(event) => { event.preventDefault(); submit('register', steps.collect(event.currentTarget)) }}>
        {steps.step === 0 && (
          <FieldGroup title="Donor information">
            <Field label="Donor ID" note="automatic"><input value="Assigned on save" disabled /></Field>
            <Field label="Donor type" note="required">
              <select value={donorType} onChange={(event) => setDonorType(event.target.value)}>
                {DONOR_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Donor name" note="required"><input name="name" required={donorType !== 'ANONYMOUS'} defaultValue={saved.name ?? ''} placeholder={donorType === 'ANONYMOUS' ? 'Anonymous donor' : ''} /></Field>
            {organization && (
              <>
                <Field label="Organisation name" note="required"><input name="organizationName" required defaultValue={saved.organizationName ?? ''} /></Field>
                <Field label="Registration number" note="required"><input name="registrationNumber" required defaultValue={saved.registrationNumber ?? ''} /></Field>
                <Field label="Tax ID" note="required"><input name="taxId" required defaultValue={saved.taxId ?? ''} /></Field>
              </>
            )}
          </FieldGroup>
        )}
        {steps.step === 1 && (
          <FieldGroup title="Address">
            <Field label="Country" note="required">
              <select name="country" value={country} onChange={(event) => setCountry(event.target.value)}>{COUNTRIES.map((item) => <option key={item}>{item}</option>)}</select>
            </Field>
            <Field label="District" note="optional">
              {country === 'Rwanda' ? (
                <select name="district" defaultValue={saved.district ?? ''}>
                  <option value="">Select a district</option>
                  {RWANDA_DISTRICTS.map((district) => <option key={district}>{district}</option>)}
                </select>
              ) : <input name="district" defaultValue={saved.district ?? ''} />}
            </Field>
            <Field label="Address" note="required" span="full"><input name="address" required defaultValue={saved.address ?? ''} /></Field>
            <Field label="Telephone" note="required"><input name="telephone" required defaultValue={saved.telephone ?? ''} /></Field>
            <Field label="Email" note="optional"><input name="email" type="email" defaultValue={saved.email ?? ''} /></Field>
            <Field label="Website" note="optional"><input name="website" defaultValue={saved.website ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === 2 && (
          <FieldGroup title="Contact person">
            <Field label="Full name" note={organization ? 'required' : 'optional'}><input name="contactName" required={organization} defaultValue={saved.contactName ?? ''} /></Field>
            <Field label="Position" note="optional"><input name="contactPosition" defaultValue={saved.contactPosition ?? ''} /></Field>
            <Field label="Telephone" note={organization ? 'required' : 'optional'}><input name="contactTelephone" required={organization} defaultValue={saved.contactTelephone ?? ''} /></Field>
            <Field label="Email" note="optional"><input name="contactEmail" type="email" defaultValue={saved.contactEmail ?? ''} /></Field>
            <Field label="Identification document" note="optional"><input name="contactIdentification" defaultValue={saved.contactIdentification ?? ''} /></Field>
            <Field label="Authorization letter" note="optional"><input name="authorizationLetter" defaultValue={saved.authorizationLetter ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === 3 && (
          <Panel icon="ledger" title="Supporting documents">
            <DocFields documents={documents} onChange={setDocuments} types={['IDENTIFICATION', 'REGISTRATION', 'AUTHORIZATION', 'OTHER']} />
          </Panel>
        )}
        <StepNav
          step={steps.step}
          count={DONOR_STEPS.length}
          busy={busy}
          onBack={() => steps.move(document.getElementById('donor-form') as HTMLFormElement, steps.step - 1, DONOR_STEPS.length)}
          onNext={() => steps.move(document.getElementById('donor-form') as HTMLFormElement, steps.step + 1, DONOR_STEPS.length)}
          submitLabel={busy ? 'Registering…' : 'Register donor'}
          extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft', steps.collect(document.getElementById('donor-form') as HTMLFormElement))}>Save draft</button>}
        />
      </form>
    </div>
  )
}

export function DonorFile() {
  usePageTitle('Donor file — UPSA Next Payment')
  const { donorId = '' } = useParams()
  const { can } = useAuth()
  const donor = useLoad(() => api.donations.donor(donorId), [donorId])
  const { error, busy, run } = useAction()
  const file = donor.data
  const [checks, setChecks] = useState({
    identityVerified: false,
    organizationVerified: false,
    registrationVerified: false,
    contactVerified: false,
    documentsVerified: false,
    complianceVerified: false,
  })

  return (
    <>
      <PageHeading kicker="Donor file" title={file?.name ?? 'Donor'} lead={file ? `${file.id} · ${file.donorType.replaceAll('_', ' ')}` : 'Loading the donor file.'} icon="user" actions={<Link className="button secondary" to="/app/donations/donors">All donors</Link>} />
      {(donor.error || error) && <Banner>{donor.error || error}</Banner>}
      {file && (
        <>
          <Panel icon="user" title="Donor information" action={<StatusPill value={file.status} />}>
            <dl className="app-dl">
              <div><dt>Country</dt><dd>{file.country}{file.district ? ` · ${file.district}` : ''}</dd></div>
              <div><dt>Address</dt><dd>{file.address || '—'}</dd></div>
              <div><dt>Telephone</dt><dd>{file.telephone || '—'}</dd></div>
              <div><dt>Email</dt><dd>{file.email || '—'}</dd></div>
              {file.organizationName && <div><dt>Organisation</dt><dd>{file.organizationName}</dd></div>}
              {file.registrationNumber && <div><dt>Registration</dt><dd>{file.registrationNumber}</dd></div>}
              {file.taxId && <div><dt>Tax ID</dt><dd>{file.taxId}</dd></div>}
              {file.contactName && <div><dt>Contact</dt><dd>{file.contactName}{file.contactPosition ? `, ${file.contactPosition}` : ''}</dd></div>}
            </dl>
          </Panel>
          {can('donation.write') && file.status !== 'DRAFT' && (
            <Panel icon="shield" title="Verification">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const result = String(new FormData(event.currentTarget).get('result'))
                const comments = String(new FormData(event.currentTarget).get('comments') || '')
                void run(async () => {
                  const saved = await api.donations.verifyDonor(file.id, { ...checks, result, comments })
                  donor.setData(saved)
                })
              }}>
                <Check label="Donor identity verified" checked={checks.identityVerified} onChange={(identityVerified) => setChecks({ ...checks, identityVerified })} />
                <Check label="Organisation verified" checked={checks.organizationVerified} onChange={(organizationVerified) => setChecks({ ...checks, organizationVerified })} />
                <Check label="Registration information verified" checked={checks.registrationVerified} onChange={(registrationVerified) => setChecks({ ...checks, registrationVerified })} />
                <Check label="Contact information verified" checked={checks.contactVerified} onChange={(contactVerified) => setChecks({ ...checks, contactVerified })} />
                <Check label="Supporting documents verified" checked={checks.documentsVerified} onChange={(documentsVerified) => setChecks({ ...checks, documentsVerified })} />
                <Check label="Required compliance checks completed" checked={checks.complianceVerified} onChange={(complianceVerified) => setChecks({ ...checks, complianceVerified })} />
                <Field label="Verification result" note="required">
                  <select name="result" defaultValue="VERIFIED">
                    {['PENDING', 'VERIFIED', 'MORE_INFORMATION_REQUIRED', 'REJECTED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Comments" note="optional" span="full"><textarea name="comments" rows={3} /></Field>
                <button className="button primary" type="submit" disabled={busy}>Save verification</button>
              </form>
              {file.verifiedBy && <p className="app-note">Last reviewed by {file.verifiedBy}{file.verificationDate ? ` on ${shortDate(file.verificationDate)}` : ''}.</p>}
            </Panel>
          )}
          <Panel icon="ledger" title="Donor history">
            <Table
              columns={['When', 'Action', 'From', 'To', 'Officer']}
              empty="No history yet."
              rows={file.history.map((item) => [shortDate(item.createdAt), item.action, item.previousStatus ?? '—', item.newStatus ?? '—', item.userId ?? '—'])}
            />
          </Panel>
        </>
      )}
    </>
  )
}
