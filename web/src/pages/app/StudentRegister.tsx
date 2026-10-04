import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCells, getDistricts, getProvinces, getSectors, getVillages } from 'rwanda-locations'
import { api, type StudentGuardianInput } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { Banner, Field, FieldGroup, PageHeading, SearchSelect } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

const STEPS = [
  ['Student', 'Identity and class'],
  ['Address', 'Home location'],
  ['Guardians', 'Parents and contacts'],
  ['Documents', 'Photo and records'],
  ['Financial', 'Fees and ledger'],
] as const

const STATUSES = [
  ['APPLICANT', 'Applicant'],
  ['ACTIVE', 'Active'],
  ['TRANSFERRED', 'Transferred'],
  ['GRADUATED', 'Graduated'],
  ['SUSPENDED', 'Suspended'],
  ['WITHDRAWN', 'Withdrawn'],
  ['INACTIVE', 'Inactive'],
] as const

const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Sponsor', 'Other authorized relationship']
const PLANS = ['Termly', 'Annual', 'Monthly']
const DOCUMENT_TYPES = [
  ['BIRTH_CERTIFICATE', 'Birth certificate'],
  ['STUDENT_ID', 'Student ID'],
  ['PREVIOUS_SCHOOL_RECORDS', 'Previous school records'],
  ['TRANSFER_CERTIFICATE', 'Transfer certificate'],
  ['MEDICAL', 'Medical or other required school documentation'],
  ['CUSTODY', 'Custody or authorization document'],
  ['OTHER', 'Other supporting documents'],
] as const

type GuardianDraft = StudentGuardianInput & { key: string; fullName: string }
type DocumentDraft = {
  key: string
  documentType: string
  documentNumber: string
  issueDate: string
  expiryDate: string
  file: File | null
}

function blankGuardian(primary = false): GuardianDraft {
  return {
    key: crypto.randomUUID(),
    fullName: '',
    phone: '',
    email: '',
    nationalId: '',
    relationship: 'Mother',
    primary,
    emergencyContact: primary,
    financialResponsibility: primary,
    communicationAuthorization: primary,
    paymentAuthorization: primary,
  }
}

function blankDocument(documentType = 'OTHER'): DocumentDraft {
  return { key: crypto.randomUUID(), documentType, documentNumber: '', issueDate: '', expiryDate: '', file: null }
}

export function StudentRegister() {
  usePageTitle('Register student — UPSA Next Payment')
  const navigate = useNavigate()
  const { can } = useAuth()
  const schools = useLoad(() => can('school.read') ? api.schools.list() : Promise.resolve({ items: [] }))
  const provinces = useMemo(() => getProvinces(), [])
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [schoolId, setSchoolId] = useState('')
  const [studentExternalId, setStudentExternalId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'' | 'FEMALE' | 'MALE'>('')
  const [nationality, setNationality] = useState('Rwandan')
  const [previousSchool, setPreviousSchool] = useState('')
  const [admissionDate, setAdmissionDate] = useState('')
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()))
  const [classLevel, setClassLevel] = useState('')
  const [stream, setStream] = useState('')
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState('APPLICANT')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [sector, setSector] = useState('')
  const [cell, setCell] = useState('')
  const [village, setVillage] = useState('')
  const [physicalAddress, setPhysicalAddress] = useState('')
  const [telephone, setTelephone] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [guardians, setGuardians] = useState<GuardianDraft[]>([blankGuardian(true)])
  const [photo, setPhoto] = useState<File | null>(null)
  const [documents, setDocuments] = useState<DocumentDraft[]>(DOCUMENT_TYPES.map(([type]) => blankDocument(type)))
  const [feeCategory, setFeeCategory] = useState('')
  const [feeStructure, setFeeStructure] = useState('')
  const [scholarship, setScholarship] = useState('')
  const [discount, setDiscount] = useState('')
  const [paymentPlan, setPaymentPlan] = useState('Termly')

  const districts = province ? getDistricts(province) : []
  const sectors = province && district ? getSectors(province, district) : []
  const cells = province && district && sector ? getCells(province, district, sector) : []
  const villages = province && district && sector && cell ? getVillages(province, district, sector, cell) : []

  function issue(message: string | null) {
    setError(message ?? '')
    return !message
  }

  function validate(index: number) {
    if (index === 0) {
      if (!schoolId) return issue('Choose the school.')
      if (!studentExternalId.trim()) return issue('Enter the admission number.')
      if (firstName.trim().length < 1 || lastName.trim().length < 1) return issue('Enter the first and last name.')
      if (!dateOfBirth) return issue('Enter the date of birth.')
      if (!gender) return issue('Choose the gender.')
      if (!nationality.trim()) return issue('Enter the nationality.')
      if (!admissionDate) return issue('Enter the admission date.')
      if (academicYear.trim().length < 4) return issue('Enter the academic year.')
      if (!classLevel.trim()) return issue('Enter the class.')
    }
    if (index === 1) {
      if (!province || !district || !sector || !cell || !village) return issue('Choose the province, district, sector, cell, and village.')
      if (!physicalAddress.trim()) return issue('Enter the physical address.')
    }
    if (index === 2) {
      if (guardians.length < 1) return issue('Link at least one parent or guardian.')
      if (guardians.some((guardian) => guardian.fullName.trim().length < 2)) return issue('Enter each guardian’s name.')
    }
    if (index === 4 && !feeCategory.trim()) return issue('Enter the fee category.')
    return issue(null)
  }

  function go(next: number) {
    if (next > step && !validate(step)) return
    setError('')
    setStep(next)
  }

  function updateGuardian(key: string, patch: Partial<GuardianDraft>) {
    setGuardians((current) => current.map((guardian) => {
      if (patch.primary && guardian.key !== key) return { ...guardian, primary: false }
      return guardian.key === key ? { ...guardian, ...patch } : guardian
    }))
  }

  async function upload(file: File) {
    const body = new FormData()
    body.set('file', file)
    return api.students.upload(body)
  }

  async function submit() {
    if (!validate(4) || !gender) return
    setBusy(true)
    setError('')
    try {
      const photoUpload = photo ? await upload(photo) : null
      const attached = []
      for (const document of documents) {
        if (!document.file) continue
        const uploaded = await upload(document.file)
        attached.push({
          documentType: document.documentType,
          documentNumber: document.documentNumber.trim() || undefined,
          issueDate: document.issueDate || undefined,
          expiryDate: document.expiryDate || undefined,
          fileName: uploaded.fileName,
          uploadId: uploaded.uploadId,
        })
      }
      const created = await api.students.create({
        schoolId,
        studentExternalId: studentExternalId.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        dateOfBirth,
        gender,
        nationality: nationality.trim(),
        photoUploadId: photoUpload?.uploadId,
        previousSchool: previousSchool.trim() || undefined,
        admissionDate,
        academicYear: academicYear.trim(),
        classLevel: classLevel.trim(),
        stream: stream.trim() || undefined,
        grade: grade.trim() || undefined,
        status,
        feeCategory: feeCategory.trim(),
        address: {
          province,
          district,
          sector,
          cell,
          village,
          physicalAddress: physicalAddress.trim(),
          telephone: telephone.trim() || undefined,
          emergencyContact: emergencyContact.trim() || undefined,
        },
        guardians: guardians.map((guardian) => ({
          fullName: guardian.fullName.trim(),
          phone: guardian.phone?.trim() || undefined,
          email: guardian.email?.trim() || undefined,
          nationalId: guardian.nationalId?.trim() || undefined,
          relationship: guardian.relationship,
          primary: guardian.primary,
          emergencyContact: guardian.emergencyContact,
          financialResponsibility: guardian.financialResponsibility,
          communicationAuthorization: guardian.communicationAuthorization,
          paymentAuthorization: guardian.paymentAuthorization,
        })),
        documents: attached,
        financial: {
          feeStructure: feeStructure.trim() || undefined,
          scholarship: scholarship.trim() || undefined,
          discount: discount.trim() ? Number(discount) : undefined,
          paymentPlan,
        },
      })
      navigate(`/app/students/${created.studentId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The student could not be registered.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page student-register">
      <PageHeading
        kicker="Families"
        title="Register a student"
        lead="Identity, address, guardians, documents, and the fee profile that the school ledger will bill."
        icon="family"
        actions={<Link className="button secondary" to="/app/students">Back to students</Link>}
      />
      <div className="student-steps" role="tablist">
        {STEPS.map(([title, detail], index) => (
          <button key={title} type="button" className={index === step ? 'current' : ''} onClick={() => go(index)}>
            <b>{index + 1}. {title}</b>
            <small>{detail}</small>
          </button>
        ))}
      </div>
      {error && <Banner>{error}</Banner>}
      {schools.error && <Banner>{schools.error}</Banner>}

      {step === 0 && (
        <>
          <FieldGroup title="Student information">
            <Field label="Student ID" note="automatic" hint="Assigned when the student is saved">
              <input value="RUPSA-STD-····" readOnly />
            </Field>
            <Field label="Admission number" note="required">
              <input value={studentExternalId} onChange={(event) => setStudentExternalId(event.target.value)} placeholder="ADM-2026-014" />
            </Field>
            <Field label="First name" note="required">
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </Field>
            <Field label="Middle name" note="optional">
              <input value={middleName} onChange={(event) => setMiddleName(event.target.value)} />
            </Field>
            <Field label="Last name" note="required">
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </Field>
            <Field label="Date of birth" note="required">
              <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
            </Field>
            <Field label="Gender" note="required">
              <select value={gender} onChange={(event) => setGender(event.target.value as '' | 'FEMALE' | 'MALE')}>
                <option value="">Choose</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
              </select>
            </Field>
            <Field label="Nationality" note="required">
              <input value={nationality} onChange={(event) => setNationality(event.target.value)} />
            </Field>
            <Field label="Previous school" note="optional" span="full">
              <input value={previousSchool} onChange={(event) => setPreviousSchool(event.target.value)} />
            </Field>
            <Field label="Admission date" note="required">
              <input type="date" value={admissionDate} onChange={(event) => setAdmissionDate(event.target.value)} />
            </Field>
          </FieldGroup>
          <FieldGroup title="Academic information">
            <Field label="School" note="required" span="full">
              <SearchSelect
                name="schoolId"
                required
                allowEmpty
                value={schoolId}
                placeholder="Search schools…"
                options={(schools.data?.items ?? []).map((school) => ({
                  value: school.schoolId,
                  label: school.schoolName,
                  hint: school.schoolId,
                }))}
                onChange={setSchoolId}
              />
            </Field>
            <Field label="Academic year" note="required">
              <input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026" />
            </Field>
            <Field label="Class" note="required">
              <input value={classLevel} onChange={(event) => setClassLevel(event.target.value)} placeholder="S3" />
            </Field>
            <Field label="Stream" note="optional">
              <input value={stream} onChange={(event) => setStream(event.target.value)} placeholder="Sciences" />
            </Field>
            <Field label="Grade" note="optional">
              <input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Senior 3" />
            </Field>
            <Field label="Student status" note="required">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </FieldGroup>
        </>
      )}

      {step === 1 && (
        <FieldGroup title="Contact and address">
          <Field label="Province" note="required">
            <SearchSelect name="province" allowEmpty value={province} placeholder="Search province…" options={provinces.map((item) => ({ value: item, label: item }))} onChange={(next) => { setProvince(next); setDistrict(''); setSector(''); setCell(''); setVillage('') }} />
          </Field>
          <Field label="District" note="required">
            <SearchSelect name="district" allowEmpty value={district} placeholder={province ? 'Search district…' : 'Choose a province first'} options={districts.map((item) => ({ value: item, label: item }))} onChange={(next) => { setDistrict(next); setSector(''); setCell(''); setVillage('') }} />
          </Field>
          <Field label="Sector" note="required">
            <SearchSelect name="sector" allowEmpty value={sector} placeholder={district ? 'Search sector…' : 'Choose a district first'} options={sectors.map((item) => ({ value: item, label: item }))} onChange={(next) => { setSector(next); setCell(''); setVillage('') }} />
          </Field>
          <Field label="Cell" note="required">
            <SearchSelect name="cell" allowEmpty value={cell} placeholder={sector ? 'Search cell…' : 'Choose a sector first'} options={cells.map((item) => ({ value: item, label: item }))} onChange={(next) => { setCell(next); setVillage('') }} />
          </Field>
          <Field label="Village" note="required">
            <SearchSelect name="village" allowEmpty value={village} placeholder={cell ? 'Search village…' : 'Choose a cell first'} options={villages.map((item) => ({ value: item, label: item }))} onChange={setVillage} />
          </Field>
          <Field label="Physical address" note="required" span="full">
            <input value={physicalAddress} onChange={(event) => setPhysicalAddress(event.target.value)} placeholder="House number, street, or landmark" />
          </Field>
          <Field label="Telephone" note="optional" hint="Where the student can be reached">
            <input value={telephone} onChange={(event) => setTelephone(event.target.value)} placeholder="+250…" />
          </Field>
          <Field label="Emergency contact" note="optional" hint="Name and telephone, if different from the guardians">
            <input value={emergencyContact} onChange={(event) => setEmergencyContact(event.target.value)} />
          </Field>
        </FieldGroup>
      )}

      {step === 2 && (
        <section className="guardian-list">
          {guardians.map((guardian, index) => (
            <article className="guardian-card" key={guardian.key}>
              <header>
                <b>Parent / guardian {index + 1}</b>
                {guardians.length > 1 && (
                  <button className="button secondary" type="button" onClick={() => setGuardians((current) => current.filter((item) => item.key !== guardian.key))}>Remove</button>
                )}
              </header>
              <div className="app-form">
                <Field label="Parent / guardian ID" note="automatic" hint="Assigned when the student is saved">
                  <input value="RUPSA-GRD-····" readOnly />
                </Field>
                <Field label="Full name" note="required">
                  <input value={guardian.fullName} onChange={(event) => updateGuardian(guardian.key, { fullName: event.target.value })} />
                </Field>
                <Field label="Relationship" note="required">
                  <select value={guardian.relationship} onChange={(event) => updateGuardian(guardian.key, { relationship: event.target.value })}>
                    {RELATIONSHIPS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Telephone" note="optional">
                  <input value={guardian.phone ?? ''} onChange={(event) => updateGuardian(guardian.key, { phone: event.target.value })} />
                </Field>
                <Field label="Email" note="optional">
                  <input type="email" value={guardian.email ?? ''} onChange={(event) => updateGuardian(guardian.key, { email: event.target.value })} />
                </Field>
                <Field label="National ID" note="optional">
                  <input value={guardian.nationalId ?? ''} onChange={(event) => updateGuardian(guardian.key, { nationalId: event.target.value })} />
                </Field>
              </div>
              <div className="guardian-flags">
                <label className="app-check"><input type="checkbox" checked={Boolean(guardian.primary)} onChange={(event) => updateGuardian(guardian.key, { primary: event.target.checked })} /> Primary guardian</label>
                <label className="app-check"><input type="checkbox" checked={Boolean(guardian.emergencyContact)} onChange={(event) => updateGuardian(guardian.key, { emergencyContact: event.target.checked })} /> Emergency contact</label>
                <label className="app-check"><input type="checkbox" checked={Boolean(guardian.financialResponsibility)} onChange={(event) => updateGuardian(guardian.key, { financialResponsibility: event.target.checked })} /> Financially responsible</label>
                <label className="app-check"><input type="checkbox" checked={Boolean(guardian.communicationAuthorization)} onChange={(event) => updateGuardian(guardian.key, { communicationAuthorization: event.target.checked })} /> Authorized for school communication</label>
                <label className="app-check"><input type="checkbox" checked={Boolean(guardian.paymentAuthorization)} onChange={(event) => updateGuardian(guardian.key, { paymentAuthorization: event.target.checked })} /> Authorized for payment</label>
              </div>
            </article>
          ))}
          <button className="button secondary" type="button" onClick={() => setGuardians((current) => [...current, blankGuardian(false)])}>Add another guardian</button>
        </section>
      )}

      {step === 3 && (
        <>
          <FieldGroup title="Student photo">
            <Field label="Student photo" note="optional" span="full" hint="PNG or JPEG, up to 8 MB">
              <input type="file" accept="image/png,image/jpeg" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            </Field>
          </FieldGroup>
          <section className="document-list">
            {documents.map((document) => (
              <article className="document-row" key={document.key}>
                <header>
                  <b>{DOCUMENT_TYPES.find(([value]) => value === document.documentType)?.[1] ?? 'Supporting document'}</b>
                  {document.documentType === 'OTHER' && documents.filter((item) => item.documentType === 'OTHER').length > 1 && (
                    <button className="button secondary" type="button" onClick={() => setDocuments((current) => current.filter((item) => item.key !== document.key))}>Remove</button>
                  )}
                </header>
                <div className="app-form">
                  <Field label="Document type" note="optional">
                    <select value={document.documentType} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, documentType: event.target.value } : item))}>
                      {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                  <Field label="Document number" note="optional">
                    <input value={document.documentNumber} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, documentNumber: event.target.value } : item))} />
                  </Field>
                  <Field label="Issue date" note="optional">
                    <input type="date" value={document.issueDate} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, issueDate: event.target.value } : item))} />
                  </Field>
                  <Field label="Expiry date" note="optional">
                    <input type="date" value={document.expiryDate} onChange={(event) => setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, expiryDate: event.target.value } : item))} />
                  </Field>
                  <Field label="Attachment" note="optional" span="full" hint="PDF, PNG, or JPEG. Verification starts as pending.">
                    <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setDocuments((current) => current.map((item) => item.key === document.key ? { ...item, file } : item))
                    }} />
                  </Field>
                </div>
              </article>
            ))}
            <button className="button secondary" type="button" onClick={() => setDocuments((current) => [...current, blankDocument('OTHER')])}>Add another document</button>
          </section>
        </>
      )}

      {step === 4 && (
        <FieldGroup title="Financial profile">
          <Field label="Student ID" note="automatic"><input value="Assigned on save" readOnly /></Field>
          <Field label="School ID" note="automatic"><input value={schoolId || 'Choose a school first'} readOnly /></Field>
          <Field label="Parent / guardian ID" note="automatic" hint="The primary guardian is linked for billing"><input value="Assigned on save" readOnly /></Field>
          <Field label="Fee category" note="required">
            <input value={feeCategory} onChange={(event) => setFeeCategory(event.target.value)} placeholder="Day" />
          </Field>
          <Field label="Academic year" note="automatic"><input value={academicYear} readOnly /></Field>
          <Field label="Fee structure" note="optional">
            <input value={feeStructure} onChange={(event) => setFeeStructure(event.target.value)} placeholder="Senior day fees" />
          </Field>
          <Field label="Invoice account" note="automatic" hint="The school ledger bills this student account"><input value="Created with the student" readOnly /></Field>
          <Field label="Scholarship" note="optional">
            <input value={scholarship} onChange={(event) => setScholarship(event.target.value)} placeholder="None" />
          </Field>
          <Field label="Discount" note="optional" hint="Amount in RWF. It does not change invoices already issued.">
            <input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0" />
          </Field>
          <Field label="Payment plan" note="optional">
            <select value={paymentPlan} onChange={(event) => setPaymentPlan(event.target.value)}>
              {PLANS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Outstanding balance" note="automatic" span="full" hint="The school ledger is the source of amounts owed. A new student starts at zero until an invoice is issued.">
            <input value="0.00 RWF" readOnly />
          </Field>
        </FieldGroup>
      )}

      <div className="student-actions">
        <button className="button secondary" type="button" disabled={step === 0 || busy} onClick={() => go(step - 1)}>Back</button>
        {step < STEPS.length - 1
          ? <button className="button primary" type="button" onClick={() => go(step + 1)}>Continue</button>
          : <button className="button primary" type="button" disabled={busy} onClick={submit}>{busy ? 'Registering…' : 'Register student'}</button>}
      </div>
    </div>
  )
}
