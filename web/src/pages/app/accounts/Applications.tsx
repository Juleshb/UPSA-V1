import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { AccountDoc } from '../../../platform/account'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Check, DocFields, FormSteps, Options, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { ACCOUNT_TYPES, CHANNELS, CONTACT_CHANNELS, DOCUMENTS, EMPLOYMENT, LANGUAGES, OWNERSHIP, PROFILE_KEYS, SCHOOL_TYPES, STEPS, SUPPLIER_CATEGORIES, label } from './catalog'

export function ApplicationList() {
  usePageTitle('Account applications — UPSA Next Payment')
  const [accountType, setAccountType] = useState('')
  const [status, setStatus] = useState('')
  const list = useLoad(() => api.accounts.list({ queue: status ? undefined : 'open', accountType: accountType || undefined, status: status || undefined }), [accountType, status])

  return (
    <>
      <PageHeading kicker="Applications" title="Account applications" lead="A draft stays editable. Submission starts document review, KYC or KYB, contact verification, the duplicate check, and approval." icon="user" actions={<Link className="button primary" to="/app/accounts/applications/new">New application</Link>} />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="search" title="Applications in progress">
        <div className="app-form">
          <Field label="Account type" note="optional">
            <select value={accountType} onChange={(event) => setAccountType(event.target.value)} aria-label="Account type">
              <option value="">All types</option>
              <Options options={ACCOUNT_TYPES} />
            </select>
          </Field>
          <Field label="Status" note="optional">
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Application status">
              <option value="">In progress</option>
              {['DRAFT', 'SUBMITTED', 'DOCUMENT_REVIEW', 'KYC_KYB', 'VERIFICATION', 'PENDING_APPROVAL', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED'].map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </Field>
        </div>
        {list.loading ? <p className="app-empty">Loading applications…</p> : (
          <Table
            columns={['Application', 'Type', 'Applicant', 'Linked record', 'Status']}
            empty="No applications match that filter."
            rows={(list.data?.items ?? []).map((item) => [
              <Link key={item.id} to={`/app/accounts/applications/${item.id}`}>{item.id}</Link>,
              label(item.accountType),
              item.applicantName,
              item.party ?? 'New record on approval',
              <StatusPill key={`${item.id}-status`} value={item.status} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function AccountList() {
  usePageTitle('Accounts — UPSA Next Payment')
  const [accountType, setAccountType] = useState('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const list = useLoad(() => api.accounts.list({ queue: 'live', accountType: accountType || undefined, q: query || undefined }), [accountType, query])

  return (
    <>
      <PageHeading kicker="Accounts" title="Opened accounts" lead="Each active account is the same file, linked to the school, guardian, student, or registration it opened." icon="school" />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="search" title="Search">
        <form className="app-form" onSubmit={onSubmit(() => setQuery(q))}>
          <Field label="Account type" note="optional">
            <select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
              <option value="">All types</option>
              <Options options={ACCOUNT_TYPES} />
            </select>
          </Field>
          <Field label="Name, number, phone, or email" note="optional">
            <input value={q} onChange={(event) => setQ(event.target.value)} />
          </Field>
          <div className="student-actions"><button className="button primary" type="submit">Search</button></div>
        </form>
        {list.loading ? <p className="app-empty">Loading accounts…</p> : (
          <Table
            columns={['Account', 'Type', 'Name', 'Linked record', 'Status']}
            empty="No opened accounts match that search."
            rows={(list.data?.items ?? []).map((item) => [
              <Link key={item.id} to={`/app/accounts/applications/${item.id}`}>{item.id}</Link>,
              label(item.accountType),
              item.applicantName,
              item.partyId ? `${item.party} · ${item.partyId}` : item.party ?? '—',
              <StatusPill key={`${item.id}-status`} value={item.status} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function ApplicationForm() {
  usePageTitle('New account — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run, setError } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const [accountType, setAccountType] = useState('SCHOOL')
  const [partyId, setPartyId] = useState('')
  const [prefill, setPrefill] = useState<Record<string, string>>({})
  const [documents, setDocuments] = useState<AccountDoc[]>([{ documentType: 'OTHER', fileName: '' }])
  const [consent, setConsent] = useState({ termsAccepted: false, privacyAccepted: false, dataConsent: false, digitalAccess: false, mobileAccess: false, webAccess: false, financialResponsibility: false, paymentAuthorization: false })
  const parties = useLoad(() => api.accounts.parties(accountType), [accountType])
  const titles = STEPS[accountType] ?? STEPS.SCHOOL
  const step = Math.min(steps.step, titles.length - 1)
  const docTypes = DOCUMENTS[accountType] ?? DOCUMENTS.SCHOOL

  function form() {
    return document.getElementById('account-form') as HTMLFormElement
  }

  function chooseType(value: string) {
    setAccountType(value)
    setPartyId('')
    setPrefill({})
    setDocuments([{ documentType: DOCUMENTS[value]?.[0] ?? 'OTHER', fileName: '' }])
  }

  function chooseParty(id: string) {
    setPartyId(id)
    const party = (parties.data?.parties ?? []).find((item) => item.id === id)
    if (!party) return
    if (accountType === 'SCHOOL') {
      setPrefill({ schoolName: party.name, registrationNumber: party.number ?? '', schoolType: party.detail ?? 'OTHER' })
    } else if (accountType === 'STUDENT') {
      setPrefill({ firstName: party.name, studentNumber: party.number ?? '' })
    } else if (accountType === 'SUPPLIER') {
      setPrefill({ businessName: party.name, registrationNumber: party.number ?? '' })
    }
  }

  function value(name: string, fallback = '') {
    return kept(saved, name, prefill[name] || fallback)
  }

  function submit(mode: 'draft' | 'submit') {
    const node = form()
    if (mode === 'submit' && !node.reportValidity()) return
    if (mode === 'submit' && (!consent.termsAccepted || !consent.privacyAccepted || !consent.dataConsent)) {
      setError('Accept the terms, privacy notice, and data consent before submitting.')
      return
    }
    if (mode === 'submit' && !documents.some((item) => item.fileName.trim())) {
      setError('Add at least one supporting document before submitting.')
      return
    }
    const data = steps.collect(node)
    const profile: Record<string, string> = {}
    for (const key of PROFILE_KEYS) {
      const entry = data[key] || prefill[key] || ''
      if (entry) profile[key] = entry
    }
    if (consent.financialResponsibility) profile.financialResponsibility = 'true'
    if (consent.paymentAuthorization) profile.paymentAuthorization = 'true'
    void run(async () => {
      const created = await api.accounts.save({
        mode,
        accountType,
        channel: data.channel,
        referral: data.referral || undefined,
        purpose: data.purpose || undefined,
        language: data.language || undefined,
        communicationPreference: data.communicationPreference || undefined,
        applicantName: data.applicantName,
        identityNumber: data.identityNumber || undefined,
        phone: data.phone,
        email: data.email || undefined,
        province: data.province || undefined,
        district: data.district || undefined,
        sector: data.sector || undefined,
        cell: data.cell || undefined,
        village: data.village || undefined,
        address: data.address || undefined,
        partyId: partyId || undefined,
        ...consent,
        consentVersion: 'account-opening-v1',
        documents: documents.filter((item) => item.fileName.trim()),
        profile,
      })
      navigate(`/app/accounts/applications/${created.id}`)
    })
  }

  return (
    <>
      <PageHeading kicker="Applications" title="Open an account" lead="Link an existing school, parent, student, teacher, or supplier when the record is already here. Approval then updates that record instead of creating a second one." icon="user" />
      {(error || parties.error) && <Banner>{error || parties.error}</Banner>}
      <Panel icon="user" title="Application">
        <form id="account-form" className="form-wizard" onSubmit={onSubmit(() => submit('submit'))}>
          <FormSteps steps={titles} step={step} onPick={(index) => steps.move(form(), index > step ? step + 1 : index, titles.length)} />
          {step === 0 && (
            <div className="app-form" key="applicant">
              <Field label="Account type" note="required">
                <select name="accountType" required value={accountType} onChange={(event) => chooseType(event.target.value)}>
                  <Options options={ACCOUNT_TYPES} />
                </select>
              </Field>
              <Field label="Existing record" note="optional" hint="Leave this empty only when the person or organisation is not yet on the platform.">
                <select name="partyId" value={partyId} onChange={(event) => chooseParty(event.target.value)}>
                  <option value="">Create the record on activation</option>
                  {(parties.data?.parties ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
                </select>
              </Field>
              <Field label="Channel" note="required">
                <select name="channel" required defaultValue={value('channel', 'BRANCH')}><Options options={CHANNELS} /></select>
              </Field>
              <Field label="Purpose" note="required"><input name="purpose" required defaultValue={value('purpose', 'School operations')} /></Field>
              <Field label="Applicant name" note="required"><input name="applicantName" required defaultValue={value('applicantName')} /></Field>
              <Field label="Identity or registration number" note={accountType === 'SCHOOL' || accountType === 'SUPPLIER' ? 'optional' : 'required'}>
                <input name="identityNumber" required={accountType !== 'SCHOOL' && accountType !== 'SUPPLIER'} defaultValue={value('identityNumber')} />
              </Field>
              <Field label="Phone" note="required"><input name="phone" required defaultValue={value('phone')} /></Field>
              <Field label="Email" note="required"><input name="email" type="email" required defaultValue={value('email')} /></Field>
              <Field label="Language" note="required">
                <select name="language" required defaultValue={value('language', 'English')}>{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select>
              </Field>
              <Field label="Communication" note="required">
                <select name="communicationPreference" required defaultValue={value('communicationPreference', 'EMAIL')}><Options options={CONTACT_CHANNELS} /></select>
              </Field>
              <Field label="Referral" note="optional"><input name="referral" defaultValue={value('referral')} /></Field>
              <Field label="Province" note="required"><input name="province" required defaultValue={value('province')} /></Field>
              <Field label="District" note="required"><input name="district" required defaultValue={value('district')} /></Field>
              <Field label="Sector" note="optional"><input name="sector" defaultValue={value('sector')} /></Field>
              <Field label="Cell" note="optional"><input name="cell" defaultValue={value('cell')} /></Field>
              <Field label="Village" note="optional"><input name="village" defaultValue={value('village')} /></Field>
              <Field label="Address" span="full" note="required"><input name="address" required defaultValue={value('address')} /></Field>
            </div>
          )}
          {step === 1 && accountType === 'SCHOOL' && (
            <div className="app-form" key="school">
              <Field label="School name" note="required"><input name="schoolName" required defaultValue={value('schoolName')} /></Field>
              <Field label="Registration number" note="required"><input name="registrationNumber" required defaultValue={value('registrationNumber')} /></Field>
              <Field label="School type" note="required">
                <select name="schoolType" required defaultValue={value('schoolType', 'PRIMARY')}><Options options={SCHOOL_TYPES} /></select>
              </Field>
              <Field label="Ownership" note="required">
                <select name="ownershipType" required defaultValue={value('ownershipType', 'PRIVATE')}><Options options={OWNERSHIP} /></select>
              </Field>
            </div>
          )}
          {step === 2 && accountType === 'SCHOOL' && (
            <div className="app-form" key="representative">
              <Field label="Representative name" note="required"><input name="representativeName" required defaultValue={value('representativeName')} /></Field>
              <Field label="Title" note="required"><input name="representativeTitle" required defaultValue={value('representativeTitle', 'Head teacher')} /></Field>
              <Field label="Representative phone" note="optional"><input name="representativePhone" defaultValue={value('representativePhone')} /></Field>
              <Field label="Representative identity number" note="optional"><input name="representativeId" defaultValue={value('representativeId')} /></Field>
              <Field label="Bank" note="required"><input name="bankName" required defaultValue={value('bankName')} /></Field>
              <Field label="Branch" note="optional"><input name="branch" defaultValue={value('branch')} /></Field>
              <Field label="Account name" note="required"><input name="accountName" required defaultValue={value('accountName')} /></Field>
              <Field label="Account number" note="required"><input name="accountNumber" required defaultValue={value('accountNumber')} /></Field>
            </div>
          )}
          {step === 1 && accountType === 'PARENT' && (
            <div className="app-form" key="parent">
              <Field label="Relationship to the student" note="required"><input name="relationship" required defaultValue={value('relationship', 'Parent')} /></Field>
              <Field label="Occupation" note="optional"><input name="occupation" defaultValue={value('occupation')} /></Field>
              <Field label="Student" span="full" note="optional">
                <select name="studentPublicId" defaultValue={value('studentPublicId')}>
                  <option value="">Link a student later</option>
                  {(parties.data?.students ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Check label="This parent is financially responsible" checked={consent.financialResponsibility} onChange={(checked) => setConsent((current) => ({ ...current, financialResponsibility: checked }))} />
              <Check label="This parent may authorise payments" checked={consent.paymentAuthorization} onChange={(checked) => setConsent((current) => ({ ...current, paymentAuthorization: checked }))} />
            </div>
          )}
          {step === 1 && accountType === 'STUDENT' && (
            <div className="app-form" key="enrollment">
              <Field label="School" span="full" note="required">
                <select name="schoolPublicId" required defaultValue={value('schoolPublicId')}>
                  <option value="">Select a school</option>
                  {(parties.data?.schools ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}
                </select>
              </Field>
              <Field label="First name" note="required"><input name="firstName" required defaultValue={value('firstName')} /></Field>
              <Field label="Middle name" note="optional"><input name="middleName" defaultValue={value('middleName')} /></Field>
              <Field label="Last name" note="required"><input name="lastName" required defaultValue={value('lastName')} /></Field>
              <Field label="Date of birth" note="required"><input name="dateOfBirth" type="date" required defaultValue={value('dateOfBirth')} /></Field>
              <Field label="Gender" note="required">
                <select name="gender" required defaultValue={value('gender', 'FEMALE')}><Options options={['FEMALE', 'MALE']} /></select>
              </Field>
              <Field label="Academic year" note="required"><input name="academicYear" required defaultValue={value('academicYear', '2026')} /></Field>
              <Field label="Class" note="required"><input name="classLevel" required defaultValue={value('classLevel')} /></Field>
              <Field label="Stream" note="optional"><input name="stream" defaultValue={value('stream')} /></Field>
              <Field label="Student number" note="optional"><input name="studentNumber" defaultValue={value('studentNumber')} /></Field>
            </div>
          )}
          {step === 2 && accountType === 'STUDENT' && (
            <div className="app-form" key="guardian">
              <Field label="Guardian name" note="required"><input name="guardianName" required defaultValue={value('guardianName')} /></Field>
              <Field label="Guardian phone" note="required"><input name="guardianPhone" required defaultValue={value('guardianPhone')} /></Field>
              <Field label="Relationship" note="required"><input name="relationship" required defaultValue={value('relationship', 'Parent')} /></Field>
            </div>
          )}
          {step === 1 && accountType === 'TEACHER' && (
            <div className="app-form" key="teacher">
              <Field label="Qualification" note="required"><input name="qualification" required defaultValue={value('qualification')} /></Field>
              <Field label="Subject" note="required"><input name="subject" required defaultValue={value('subject')} /></Field>
              <Field label="Employment" note="required">
                <select name="employmentType" required defaultValue={value('employmentType', 'PERMANENT')}><Options options={EMPLOYMENT} /></select>
              </Field>
              <Field label="School" note="optional">
                <select name="schoolPublicId" defaultValue={value('schoolPublicId')}>
                  <option value="">No school link yet</option>
                  {(parties.data?.schools ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Start date" note="optional"><input name="startDate" type="date" defaultValue={value('startDate')} /></Field>
            </div>
          )}
          {step === 1 && accountType === 'SUPPLIER' && (
            <div className="app-form" key="supplier">
              <Field label="Business name" note="required"><input name="businessName" required defaultValue={value('businessName')} /></Field>
              <Field label="Registration number" note="required"><input name="registrationNumber" required defaultValue={value('registrationNumber')} /></Field>
              <Field label="Tax number" note="optional"><input name="tin" defaultValue={value('tin')} /></Field>
              <Field label="Category" note="required">
                <select name="category" required defaultValue={value('category', 'BOOKS')}><Options options={SUPPLIER_CATEGORIES} /></select>
              </Field>
              <Field label="Bank" note="required"><input name="bankName" required defaultValue={value('bankName')} /></Field>
              <Field label="Branch" note="optional"><input name="branch" defaultValue={value('branch')} /></Field>
              <Field label="Account name" note="required"><input name="accountName" required defaultValue={value('accountName')} /></Field>
              <Field label="Account number" note="required"><input name="accountNumber" required defaultValue={value('accountNumber')} /></Field>
            </div>
          )}
          {titles[step] === 'Consent' && (
            <div className="app-form" key="consent">
              <Check label="Digital access" checked={consent.digitalAccess} onChange={(checked) => setConsent((current) => ({ ...current, digitalAccess: checked }))} />
              <Check label="Mobile access" checked={consent.mobileAccess} onChange={(checked) => setConsent((current) => ({ ...current, mobileAccess: checked }))} />
              <Check label="Web access" checked={consent.webAccess} onChange={(checked) => setConsent((current) => ({ ...current, webAccess: checked }))} />
              <Check label="The applicant accepts the account terms" checked={consent.termsAccepted} onChange={(checked) => setConsent((current) => ({ ...current, termsAccepted: checked }))} />
              <Check label="The applicant accepts the privacy notice" checked={consent.privacyAccepted} onChange={(checked) => setConsent((current) => ({ ...current, privacyAccepted: checked }))} />
              <Check label="The applicant consents to use of this data for the account" checked={consent.dataConsent} onChange={(checked) => setConsent((current) => ({ ...current, dataConsent: checked }))} />
            </div>
          )}
          {titles[step] === 'Documents' && (
            <div key="documents">
              <DocFields documents={documents} types={docTypes} onChange={setDocuments} />
            </div>
          )}
          <StepNav
            step={step}
            count={titles.length}
            busy={busy}
            onBack={() => steps.move(form(), step - 1, titles.length)}
            onNext={() => steps.move(form(), step + 1, titles.length)}
            submitLabel="Submit application"
            extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft')}>Save draft</button>}
          />
        </form>
      </Panel>
    </>
  )
}
