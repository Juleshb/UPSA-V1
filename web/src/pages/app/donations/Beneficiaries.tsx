import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money, shortDate } from '../../../platform/format'
import { Banner, Field, FieldGroup, PageHeading, Panel, SearchField, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { BENEFICIARY_TYPES } from './catalog'
import { Check, DocFields, FormSteps, StepNav, useAction, useFormSteps } from './kit'

const BENEFICIARY_STEPS = ['Identity', 'Location', 'Documents']

export function BeneficiaryList() {
  usePageTitle('Beneficiaries — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const rows = useLoad(() => api.donations.beneficiaries({ q: query || undefined }), [query])

  return (
    <>
      <PageHeading kicker="Beneficiaries" title="People and programmes receiving support" lead="Schools, students, families, and programmes are registered and verified before an allocation can be approved." icon="family" actions={<Link className="button primary" to="/app/donations/beneficiaries/new">Register beneficiary</Link>} />
      {rows.error && <Banner>{rows.error}</Banner>}
      <Panel icon="search" title="Beneficiaries">
        <SearchField value={query} onChange={setQuery} placeholder="Name, ID, district…" />
        {rows.loading ? <p className="app-empty">Loading beneficiaries…</p> : (
          <Table
            columns={['Beneficiary', 'Type', 'District', 'Telephone', 'Status']}
            empty="No beneficiaries yet."
            rows={(rows.data?.items ?? []).map((item) => [
              <Link key={item.id} to={`/app/donations/beneficiaries/${item.id}`}>{item.name}</Link>,
              item.beneficiaryType.replaceAll('_', ' '),
              item.district || '—',
              item.telephone || '—',
              <StatusPill key={`${item.id}-status`} value={item.status} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function BeneficiaryForm() {
  usePageTitle('Register beneficiary — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const [beneficiaryType, setBeneficiaryType] = useState('SCHOOL')
  const [documents, setDocuments] = useState<DonationDoc[]>([{ documentType: 'IDENTIFICATION', fileName: '' }])
  const needsRegistration = beneficiaryType === 'SCHOOL' || beneficiaryType === 'INSTITUTION'
  const needsPayment = !['COMMUNITY', 'OTHER'].includes(beneficiaryType)

  function form() {
    return document.getElementById('beneficiary-form') as HTMLFormElement
  }

  function submit(mode: 'draft' | 'register', data: Record<string, string>) {
    void run(async () => {
      const created = await api.donations.saveBeneficiary({
        ...data,
        beneficiaryType,
        documents: documents.filter((item) => item.fileName.trim()),
        mode,
      })
      navigate(`/app/donations/beneficiaries/${created.id}`)
    })
  }

  return (
    <div className="form-wizard">
      <PageHeading kicker="Beneficiaries" title="Register beneficiary" lead="Schools and institutions need a registration number. Monetary beneficiaries need a bank account or mobile money number." icon="family" actions={<Link className="button secondary" to="/app/donations/beneficiaries">All beneficiaries</Link>} />
      {error && <Banner>{error}</Banner>}
      <FormSteps steps={BENEFICIARY_STEPS} step={steps.step} onPick={(index) => steps.move(form(), index > steps.step ? steps.step + 1 : index, BENEFICIARY_STEPS.length)} />
      <form id="beneficiary-form" key={steps.step} onSubmit={(event) => { event.preventDefault(); submit('register', steps.collect(event.currentTarget)) }}>
        {steps.step === 0 && (
          <FieldGroup title="Beneficiary information">
            <Field label="Beneficiary ID" note="automatic"><input value="Assigned on save" disabled /></Field>
            <Field label="Beneficiary type" note="required">
              <select value={beneficiaryType} onChange={(event) => setBeneficiaryType(event.target.value)}>
                {BENEFICIARY_TYPES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Name" note="required"><input name="name" required defaultValue={saved.name ?? ''} /></Field>
            <Field label="Registration number" note={needsRegistration ? 'required' : 'optional'}><input name="registrationNumber" required={needsRegistration} defaultValue={saved.registrationNumber ?? ''} /></Field>
            <Field label="Contact person" note={beneficiaryType === 'STUDENT' ? 'optional' : 'required'}><input name="contactPerson" required={beneficiaryType !== 'STUDENT'} defaultValue={saved.contactPerson ?? ''} /></Field>
            <Field label="Telephone" note="required"><input name="telephone" required defaultValue={saved.telephone ?? ''} /></Field>
            <Field label="Email" note="optional"><input name="email" type="email" defaultValue={saved.email ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === 1 && (
          <FieldGroup title="Location and payment">
            <Field label="Province" note="optional"><input name="province" defaultValue={saved.province ?? ''} /></Field>
            <Field label="District" note="optional"><input name="district" defaultValue={saved.district ?? ''} /></Field>
            <Field label="Sector" note="optional"><input name="sector" defaultValue={saved.sector ?? ''} /></Field>
            <Field label="Physical address" note="required" span="full"><input name="physicalAddress" required defaultValue={saved.physicalAddress ?? ''} /></Field>
            <Field label="Bank name" note="optional"><input name="bankName" defaultValue={saved.bankName ?? ''} /></Field>
            <Field label="Bank account" note={needsPayment ? 'required' : 'optional'}><input name="bankAccount" defaultValue={saved.bankAccount ?? ''} /></Field>
            <Field label="Mobile money number" note={needsPayment ? 'required' : 'optional'}><input name="mobileMoneyNumber" defaultValue={saved.mobileMoneyNumber ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === 2 && (
          <Panel icon="ledger" title="Supporting documents">
            <DocFields documents={documents} onChange={setDocuments} types={['IDENTIFICATION', 'REGISTRATION_CERTIFICATE', 'AUTHORIZATION', 'PROOF_OF_NEED', 'OTHER']} />
          </Panel>
        )}
        <StepNav
          step={steps.step}
          count={BENEFICIARY_STEPS.length}
          busy={busy}
          onBack={() => steps.move(form(), steps.step - 1, BENEFICIARY_STEPS.length)}
          onNext={() => steps.move(form(), steps.step + 1, BENEFICIARY_STEPS.length)}
          submitLabel={busy ? 'Registering…' : 'Register beneficiary'}
          extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft', steps.collect(form()))}>Save draft</button>}
        />
      </form>
    </div>
  )
}

export function BeneficiaryFile() {
  usePageTitle('Beneficiary — UPSA Next Payment')
  const { beneficiaryId = '' } = useParams()
  const { can } = useAuth()
  const fileLoad = useLoad(() => api.donations.beneficiary(beneficiaryId), [beneficiaryId])
  const { error, busy, run } = useAction()
  const file = fileLoad.data
  const [checks, setChecks] = useState({
    identityVerified: false,
    registrationVerified: false,
    locationVerified: false,
    eligibilityVerified: false,
    documentsVerified: false,
    paymentInfoVerified: false,
  })

  return (
    <>
      <PageHeading kicker="Beneficiary" title={file?.name ?? 'Beneficiary'} lead={file ? `${file.id} · ${file.beneficiaryType.replaceAll('_', ' ')}` : 'Loading the beneficiary.'} icon="family" actions={<Link className="button secondary" to="/app/donations/beneficiaries">All beneficiaries</Link>} />
      {(fileLoad.error || error) && <Banner>{fileLoad.error || error}</Banner>}
      {file && (
        <>
          <Panel icon="family" title="Beneficiary" action={<StatusPill value={file.status} />}>
            <dl className="app-dl">
              <div><dt>Address</dt><dd>{[file.province, file.district, file.sector, file.physicalAddress].filter(Boolean).join(', ') || '—'}</dd></div>
              <div><dt>Contact</dt><dd>{file.contactPerson || '—'} · {file.telephone || '—'}</dd></div>
              <div><dt>Payment</dt><dd>{file.bankAccount || file.mobileMoneyNumber || '—'}</dd></div>
            </dl>
          </Panel>
          {can('donation.write') && file.status !== 'DRAFT' && (
            <Panel icon="shield" title="Verification">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                void run(async () => {
                  fileLoad.setData(await api.donations.verifyBeneficiary(file.id, { ...checks, decision: data.decision, comments: data.comments }))
                })
              }}>
                <Check label="Identity verified" checked={checks.identityVerified} onChange={(identityVerified) => setChecks({ ...checks, identityVerified })} />
                <Check label="Registration verified" checked={checks.registrationVerified} onChange={(registrationVerified) => setChecks({ ...checks, registrationVerified })} />
                <Check label="Location verified" checked={checks.locationVerified} onChange={(locationVerified) => setChecks({ ...checks, locationVerified })} />
                <Check label="Eligibility verified" checked={checks.eligibilityVerified} onChange={(eligibilityVerified) => setChecks({ ...checks, eligibilityVerified })} />
                <Check label="Supporting documents verified" checked={checks.documentsVerified} onChange={(documentsVerified) => setChecks({ ...checks, documentsVerified })} />
                <Check label="Payment information verified" checked={checks.paymentInfoVerified} onChange={(paymentInfoVerified) => setChecks({ ...checks, paymentInfoVerified })} />
                <Field label="Decision" note="required">
                  <select name="decision" defaultValue="VERIFIED">
                    <option value="VERIFIED">Verified</option>
                    <option value="NOT_VERIFIED">Not verified</option>
                    <option value="MORE_INFORMATION_REQUIRED">More information required</option>
                  </select>
                </Field>
                <Field label="Comments" note="optional" span="full"><textarea name="comments" rows={2} /></Field>
                <button className="button primary" type="submit" disabled={busy}>Save verification</button>
              </form>
              {file.verifiedBy && <p className="app-note">Reviewed by {file.verifiedBy}{file.verificationDate ? ` on ${shortDate(file.verificationDate)}` : ''}.</p>}
            </Panel>
          )}
          <Panel icon="ledger" title="Allocation history">
            <Table
              columns={['Allocation', 'Donation', 'Amount', 'Purpose', 'Status']}
              empty="No allocations yet."
              rows={file.allocations.map((item) => [item.id, <Link key={item.donationId} to={`/app/donations/gifts/${item.donationId}`}>{item.donationId}</Link>, money(item.amount, item.currency), item.purpose, <StatusPill key={item.id} value={item.status} />])}
            />
          </Panel>
        </>
      )}
    </>
  )
}
