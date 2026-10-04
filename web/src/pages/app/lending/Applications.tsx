import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { useAuth } from '../../../platform/AuthContext'
import { Field, PageHeading, Panel, Stat, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { FormSteps, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { COLLATERAL_TYPES, CUSTOMER_TYPES, DOCUMENT_TYPES, checked, num, readable, str, today } from './catalog'

export function ApplicationList() {
  usePageTitle('Loan applications — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const data = useLoad(() => api.lending.applications({ q: query, status }), [query, status])
  return (
    <>
      <PageHeading kicker="Applications" title="Lending applications" lead="Search by applicant, product, school, or district." icon="loan" actions={<Link className="button primary" to="/app/loans/applications/new">New application</Link>} />
      <div className="app-form">
        <Field label="Search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Applicant, school, product, district" /></Field>
        <Field label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All stages</option>
            {['SUBMITTED', 'DOCUMENT_CHECK', 'KYC_KYB', 'ASSESSMENT', 'FI_REVIEW', 'OFFER', 'ACCEPTANCE', 'CONTRACT', 'ACTIVE', 'DECLINED', 'SETTLED', 'RECOVERY'].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
          </select>
        </Field>
      </div>
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Applicant', 'Reference', 'Product', 'District', 'Requested', 'Status']}
        empty="No lending application yet."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.applicationId} to={`/app/loans/applications/${item.applicationId}`}>{item.applicant}</Link>,
          item.applicationId,
          readable(item.productCode),
          item.district,
          money(item.requestedAmount, item.currency),
          <StatusPill key={`${item.applicationId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

const STEPS = ['Product', 'Request', 'Financials', 'Security', 'Purpose details']

export function ApplicationForm() {
  usePageTitle('New loan application — UPSA Next Payment')
  const navigate = useNavigate()
  const schools = useLoad(() => api.schools.list())
  const institutions = useLoad(() => api.institutions.list())
  const products = useLoad(() => api.lending.products())
  const form = useFormSteps()
  const action = useAction()
  const [productCode, setProductCode] = useState(() => kept(form.values, 'productCode'))
  const chosen = (products.data?.items ?? []).find((item) => item.code === productCode)
  return (
    <>
      <PageHeading kicker="Lending" title="New loan application" lead="The product sets the amount, tenor, guarantee, and collateral limits. The financial institution still makes the credit decision." icon="loan" />
      <form className="form-wizard" onSubmit={onSubmit((event) => {
        const values = form.collect(event.currentTarget)
        action.run(async () => {
          const details = {
            studentName: values.studentName,
            guardianName: values.guardianName,
            academicYear: values.academicYear,
            invoiceId: values.invoiceId,
            paymentDestination: values.paymentDestination,
            supplierName: values.supplierName,
            contractNumber: values.contractNumber,
            invoiceNumber: values.invoiceNumber,
            purchaseOrder: values.purchaseOrder,
            assetType: values.assetType,
            assetDescription: values.assetDescription,
            investmentPurpose: values.investmentPurpose,
            projectCost: values.projectCost,
            repaymentSource: values.repaymentSource,
          }
          const created = await api.lending.apply({
            schoolId: values.schoolId,
            financialInstitutionId: values.financialInstitutionId,
            productCode: values.productCode,
            customerType: values.customerType,
            applicantName: values.applicantName,
            representative: values.representative || undefined,
            memberPublicId: values.memberPublicId || undefined,
            requestedAmount: Number(values.requestedAmount),
            tenorMonths: Number(values.tenorMonths),
            graceMonths: Number(values.graceMonths || 0),
            repaymentFrequency: values.repaymentFrequency || 'MONTHLY',
            purpose: values.purpose,
            guaranteeRequested: values.guaranteeRequested === 'on',
            guaranteeAmountRequested: Number(values.guaranteeAmountRequested || 0) || undefined,
            monthlyRevenue: Number(values.monthlyRevenue || 0),
            monthlyExpenses: Number(values.monthlyExpenses || 0),
            existingDebt: Number(values.existingDebt || 0),
            existingRepayments: Number(values.existingRepayments || 0),
            applicantContribution: Number(values.applicantContribution || 0),
            expectedCashFlow: values.expectedCashFlow || undefined,
            collateralAvailable: values.collateralAvailable === 'on',
            collateralType: values.collateralType || undefined,
            collateralValue: Number(values.collateralValue || 0) || undefined,
            collateralOwner: values.collateralOwner || undefined,
            details: Object.fromEntries(Object.entries(details).filter(([, value]) => value)),
          })
          navigate(`/app/loans/applications/${created.applicationId}`)
        })
      })}>
        <FormSteps steps={STEPS} step={form.step} onPick={(index) => form.move(document.querySelector('.form-wizard') as HTMLFormElement, index, STEPS.length)} />
        {form.step === 0 && (
          <div className="app-form">
            <Field label="School"><select name="schoolId" defaultValue={kept(form.values, 'schoolId')} required><option value="">Choose</option>{(schools.data?.items ?? []).map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></Field>
            <Field label="Financial institution"><select name="financialInstitutionId" defaultValue={kept(form.values, 'financialInstitutionId')} required><option value="">Choose</option>{(institutions.data?.items ?? []).map((item) => <option key={item.financialInstitutionId} value={item.financialInstitutionId}>{item.name}</option>)}</select></Field>
            <Field label="Product"><select name="productCode" defaultValue={productCode} required onChange={(event) => setProductCode(event.target.value)}><option value="">Choose</option>{(products.data?.items ?? []).filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Field>
            {chosen && <p className="product-hint">{chosen.name}: {money(chosen.minimumAmount, chosen.currency)} to {money(chosen.maximumAmount, chosen.currency)}, {chosen.minimumTenor}–{chosen.maximumTenor} months, {chosen.interestRate}% {readable(chosen.interestMethod)}. Guarantee {chosen.guaranteeRequired ? 'required' : 'optional'}. Collateral {chosen.collateralRequired ? 'required' : 'optional'}.</p>}
            <Field label="Customer type"><select name="customerType" defaultValue={kept(form.values, 'customerType', 'SCHOOL')}>{CUSTOMER_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Applicant name"><input name="applicantName" defaultValue={kept(form.values, 'applicantName')} required /></Field>
            <Field label="Authorized representative" hint="optional"><input name="representative" defaultValue={kept(form.values, 'representative')} /></Field>
            <Field label="Membership number" hint="optional"><input name="memberPublicId" defaultValue={kept(form.values, 'memberPublicId')} /></Field>
          </div>
        )}
        {form.step === 1 && (
          <div className="app-form">
            <Field label="Requested amount"><input name="requestedAmount" type="number" min="1" step="0.01" defaultValue={kept(form.values, 'requestedAmount')} required /></Field>
            <Field label="Tenor in months"><input name="tenorMonths" type="number" min="1" defaultValue={kept(form.values, 'tenorMonths')} required /></Field>
            <Field label="Grace period in months" hint="optional"><input name="graceMonths" type="number" min="0" defaultValue={kept(form.values, 'graceMonths', '0')} /></Field>
            <Field label="Repayment frequency"><select name="repaymentFrequency" defaultValue={kept(form.values, 'repaymentFrequency', 'MONTHLY')}><option>MONTHLY</option><option>QUARTERLY</option></select></Field>
            <Field label="Purpose"><textarea name="purpose" defaultValue={kept(form.values, 'purpose')} required /></Field>
          </div>
        )}
        {form.step === 2 && (
          <div className="app-form">
            <Field label="Monthly revenue"><input name="monthlyRevenue" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'monthlyRevenue')} required /></Field>
            <Field label="Monthly expenses"><input name="monthlyExpenses" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'monthlyExpenses')} required /></Field>
            <Field label="Existing debt"><input name="existingDebt" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'existingDebt', '0')} /></Field>
            <Field label="Existing monthly repayments"><input name="existingRepayments" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'existingRepayments', '0')} /></Field>
            <Field label="Applicant contribution"><input name="applicantContribution" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'applicantContribution', '0')} /></Field>
            <Field label="Expected cash flow" hint="optional"><input name="expectedCashFlow" defaultValue={kept(form.values, 'expectedCashFlow')} /></Field>
          </div>
        )}
        {form.step === 3 && (
          <div className="app-form">
            <label className="app-check"><input name="guaranteeRequested" type="checkbox" defaultChecked={kept(form.values, 'guaranteeRequested') === 'on'} /> Guarantee requested</label>
            <Field label="Guarantee amount" hint="optional"><input name="guaranteeAmountRequested" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'guaranteeAmountRequested')} /></Field>
            <label className="app-check"><input name="collateralAvailable" type="checkbox" defaultChecked={kept(form.values, 'collateralAvailable') === 'on'} /> Collateral available</label>
            <Field label="Collateral type"><select name="collateralType" defaultValue={kept(form.values, 'collateralType')}><option value="">None</option>{COLLATERAL_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Estimated value" hint="optional"><input name="collateralValue" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'collateralValue')} /></Field>
            <Field label="Owner" hint="optional"><input name="collateralOwner" defaultValue={kept(form.values, 'collateralOwner')} /></Field>
          </div>
        )}
        {form.step === 4 && (
          <div className="app-form">
            <Field label="Student" hint="optional"><input name="studentName" defaultValue={kept(form.values, 'studentName')} /></Field>
            <Field label="Parent or guardian" hint="optional"><input name="guardianName" defaultValue={kept(form.values, 'guardianName')} /></Field>
            <Field label="Academic year" hint="optional"><input name="academicYear" defaultValue={kept(form.values, 'academicYear')} /></Field>
            <Field label="Fee invoice" hint="optional"><input name="invoiceId" defaultValue={kept(form.values, 'invoiceId')} placeholder="RUPSA invoice reference" /></Field>
            <Field label="Payment destination" hint="optional"><input name="paymentDestination" defaultValue={kept(form.values, 'paymentDestination')} /></Field>
            <Field label="Supplier" hint="optional"><input name="supplierName" defaultValue={kept(form.values, 'supplierName')} /></Field>
            <Field label="Contract or purchase order" hint="optional"><input name="purchaseOrder" defaultValue={kept(form.values, 'purchaseOrder')} /></Field>
            <Field label="Invoice number" hint="optional"><input name="invoiceNumber" defaultValue={kept(form.values, 'invoiceNumber')} /></Field>
            <Field label="Asset" hint="optional"><input name="assetDescription" defaultValue={kept(form.values, 'assetDescription')} /></Field>
            <Field label="Asset type" hint="optional"><input name="assetType" defaultValue={kept(form.values, 'assetType')} /></Field>
            <Field label="Investment purpose" hint="optional"><input name="investmentPurpose" defaultValue={kept(form.values, 'investmentPurpose')} /></Field>
            <Field label="Project cost" hint="optional"><input name="projectCost" defaultValue={kept(form.values, 'projectCost')} /></Field>
            <Field label="Repayment source" hint="optional"><input name="repaymentSource" defaultValue={kept(form.values, 'repaymentSource')} /></Field>
          </div>
        )}
        {action.error && <p className="form-error">{action.error}</p>}
        <StepNav step={form.step} count={STEPS.length} busy={action.busy} submitLabel="Submit application" onBack={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step - 1, STEPS.length)} onNext={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step + 1, STEPS.length)} />
      </form>
    </>
  )
}

const STAGES = ['SUBMITTED', 'DOCUMENT_CHECK', 'KYC_KYB', 'ASSESSMENT', 'FI_REVIEW', 'OFFER', 'ACCEPTANCE', 'CONTRACT', 'ACTIVE', 'SETTLED']
const DESK = [
  ['overview', 'Overview'],
  ['documents', 'Documents'],
  ['kyc', 'KYC / KYB'],
  ['consent', 'Consent'],
  ['assessment', 'Assessment'],
  ['decision', 'Decision'],
  ['offer', 'Offer'],
  ['security', 'Security'],
] as const

function nextDesk(status: string) {
  if (status === 'SUBMITTED' || status === 'DOCUMENT_CHECK') return 'documents'
  if (status === 'KYC_KYB') return 'kyc'
  if (status === 'ASSESSMENT') return 'assessment'
  if (status === 'FI_REVIEW') return 'decision'
  if (status === 'OFFER' || status === 'ACCEPTANCE') return 'offer'
  return 'overview'
}

export function ApplicationFilePage() {
  usePageTitle('Loan application — UPSA Next Payment')
  const { applicationId = '' } = useParams()
  const { can } = useAuth()
  const data = useLoad(() => api.lending.application(applicationId), [applicationId])
  const action = useAction()
  const [tab, setTab] = useState('overview')
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the application.</p>
  const write = can('loan.write')
  const stage = STAGES.indexOf(file.status)
  const next = nextDesk(file.status)
  return (
    <>
      <PageHeading kicker="Application" title={file.applicantName} lead={`${readable(file.productCode)} · ${file.schoolName} · ${file.institutionName}`} icon="loan" actions={file.loanId ? <Link className="button primary" to={`/app/loans/book/${file.loanId}`}>Open loan account</Link> : undefined} />
      <div className="lend-facts">
        <StatusPill value={file.status} />
        <span>{file.applicationId}</span>
        <span>{money(file.requestedAmount, file.currency)} over {file.tenorMonths} months</span>
      </div>
      <ol className="app-steps">
        {STAGES.map((item, index) => <li key={item} className={stage === index ? 'current' : stage > index ? 'done' : undefined}>{readable(item)}</li>)}
      </ol>
      <p className="lend-note">{file.purpose}</p>
      <div className="lend-tabs" role="tablist">
        {DESK.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {action.error && <p className="form-error">{action.error}</p>}
      {tab === 'overview' && (
        <div className="app-stats">
          <Stat label="Requested" value={money(file.requestedAmount, file.currency)} hint={file.purpose} />
          <Stat label="Institution decision" value={file.decision ? readable(file.decision) : 'Waiting'} hint={file.approvedAmount != null ? money(file.approvedAmount, file.currency) : 'The institution has not decided'} />
          <Stat label="UPSA recommendation" value={file.assessment ? readable(file.assessment.result) : 'Not recorded'} hint={file.assessment ? `Free cash flow ${money(file.assessment.freeCashFlow, file.currency)}. ${file.assessment.note}` : 'A recommendation is not the credit decision.'} />
          <Stat label="Offer" value={file.offer ? money(file.offer.amount, file.currency) : 'None'} hint={file.offer ? `${file.offer.interestRate}% for ${file.offer.tenorMonths} months · ${readable(file.offer.response)}` : 'Created when the institution approves'} />
          <Stat label="Contract" value={file.contract?.contractNumber ?? 'None'} hint={file.contract ? money(file.contract.principal, file.currency) : 'Both parties sign before the schedule is built'} />
        </div>
      )}
      {tab === 'overview' && next !== 'overview' && write && <p><button className="button primary" type="button" onClick={() => setTab(next)}>Continue this file</button></p>}
      {write && tab === 'documents' && (
          <Panel title="Documents" wide>
            <Table columns={['Type', 'File', 'Status']} empty="No document yet." rows={file.documents.map((item) => [readable(item.documentType), item.fileName, <StatusPill key={item.documentId} value={item.status} />])} />
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.addDocument(applicationId, { documentType: str(form, 'documentType'), documentNumber: str(form, 'documentNumber') || undefined, issueDate: str(form, 'issueDate') || undefined, fileName: str(form, 'fileName') })
                data.reload()
              })
            })}>
              <Field label="Document type"><select name="documentType">{DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Document number" hint="optional"><input name="documentNumber" /></Field>
              <Field label="Issue date" hint="optional"><input name="issueDate" type="date" /></Field>
              <Field label="File name"><input name="fileName" required placeholder="statements.pdf" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Add document</button>
            </form>
            {file.documents[0] && (
              <form className="app-form" onSubmit={onSubmit((event) => {
                const form = new FormData(event.currentTarget)
                action.run(async () => {
                  await api.lending.reviewDocument(applicationId, str(form, 'documentId'), { status: str(form, 'status'), comment: str(form, 'comment') || undefined })
                  data.reload()
                })
              })}>
                <Field label="Document"><select name="documentId">{file.documents.map((item) => <option key={item.documentId} value={item.documentId}>{item.documentType}</option>)}</select></Field>
                <Field label="Status"><select name="status"><option>VERIFIED</option><option>REJECTED</option><option>PENDING</option></select></Field>
                <Field label="Comment" hint="optional"><input name="comment" /></Field>
                <button className="button secondary" type="submit" disabled={action.busy}>Update document</button>
              </form>
            )}
          </Panel>
      )}
      {write && tab === 'kyc' && (
          <Panel title="KYC and KYB" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.kyc(applicationId, { kind: str(form, 'kind'), organizationName: str(form, 'organizationName') || undefined, registrationNumber: str(form, 'registrationNumber') || undefined, taxId: str(form, 'taxId') || undefined, representative: str(form, 'representative') || undefined, fullName: str(form, 'fullName') || undefined, idNumber: str(form, 'idNumber') || undefined, result: str(form, 'result') })
                data.reload()
              })
            })}>
              <Field label="Kind"><select name="kind"><option>ORGANIZATION</option><option>INDIVIDUAL</option></select></Field>
              <Field label="Organization"><input name="organizationName" defaultValue={file.schoolName} /></Field>
              <Field label="Registration number" hint="optional"><input name="registrationNumber" /></Field>
              <Field label="Tax ID" hint="optional"><input name="taxId" /></Field>
              <Field label="Representative" hint="optional"><input name="representative" /></Field>
              <Field label="Individual name" hint="optional"><input name="fullName" /></Field>
              <Field label="ID number" hint="optional"><input name="idNumber" /></Field>
              <Field label="Result"><select name="result"><option>VERIFIED</option><option>PENDING</option><option>FAILED</option><option>MORE_INFORMATION_REQUIRED</option></select></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Save KYC / KYB</button>
            </form>
          </Panel>
      )}
      {write && tab === 'consent' && (
          <Panel title="Consent" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.consent(applicationId, { purpose: str(form, 'purpose'), scope: str(form, 'scope'), institution: file.institutionName, effectiveDate: today(), expiryDate: str(form, 'expiryDate'), version: '2026-1', withdraw: checked(form, 'withdraw') })
                data.reload()
              })
            })}>
              <Field label="Purpose"><input name="purpose" defaultValue="Credit assessment" required /></Field>
              <Field label="Data scope"><input name="scope" defaultValue="Financial profile, payment history, loan history, school collections" required /></Field>
              <Field label="Expiry"><input name="expiryDate" type="date" required /></Field>
              <label className="app-check"><input name="withdraw" type="checkbox" /> Withdraw the current consent</label>
              <button className="button secondary" type="submit" disabled={action.busy}>Record consent</button>
            </form>
          </Panel>
      )}
      {write && tab === 'assessment' && (
          <Panel title="Credit assessment" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.assess(applicationId, { revenue: num(form, 'revenue'), collections: num(form, 'collections'), collectionRate: num(form, 'collectionRate'), expenses: num(form, 'expenses'), exposure: num(form, 'exposure'), debtService: num(form, 'debtService'), repaymentCapacity: str(form, 'repaymentCapacity'), cashFlowStability: str(form, 'cashFlowStability'), paymentHistory: str(form, 'paymentHistory'), trend: str(form, 'trend'), risks: str(form, 'risks') || undefined, mitigation: str(form, 'mitigation') || undefined, result: str(form, 'result') })
                data.reload()
              })
            })}>
              <Field label="Average monthly revenue"><input name="revenue" type="number" min="0" step="0.01" required /></Field>
              <Field label="Average monthly collections"><input name="collections" type="number" min="0" step="0.01" required /></Field>
              <Field label="Collection rate"><input name="collectionRate" type="number" min="0" max="100" step="0.01" required /></Field>
              <Field label="Operating expenses"><input name="expenses" type="number" min="0" step="0.01" required /></Field>
              <Field label="Existing exposure"><input name="exposure" type="number" min="0" step="0.01" defaultValue="0" /></Field>
              <Field label="Monthly debt service"><input name="debtService" type="number" min="0" step="0.01" defaultValue="0" /></Field>
              <Field label="Repayment capacity"><input name="repaymentCapacity" defaultValue="Adequate" required /></Field>
              <Field label="Cash-flow stability"><input name="cashFlowStability" defaultValue="Stable" required /></Field>
              <Field label="Payment history"><input name="paymentHistory" defaultValue="Current" required /></Field>
              <Field label="Trend"><input name="trend" defaultValue="Stable" required /></Field>
              <Field label="Risks" hint="optional"><input name="risks" /></Field>
              <Field label="Mitigation" hint="optional"><input name="mitigation" /></Field>
              <Field label="Recommendation"><select name="result"><option>RECOMMEND</option><option>RECOMMEND_WITH_CONDITIONS</option><option>MORE_INFORMATION_REQUIRED</option><option>NOT_RECOMMENDED</option></select></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Save recommendation</button>
            </form>
          </Panel>
      )}
      {write && tab === 'decision' && (
          <Panel title="Institution credit decision" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.decide(applicationId, { decision: str(form, 'decision'), approvedAmount: num(form, 'approvedAmount') || undefined, tenorMonths: num(form, 'tenorMonths') || undefined, interestRate: num(form, 'interestRate') || undefined, conditions: str(form, 'conditions') || undefined, decisionReference: str(form, 'decisionReference') || undefined, comments: str(form, 'comments') || undefined })
                data.reload()
              })
            })}>
              <Field label="Decision"><select name="decision"><option value="APPROVED">Approve</option><option value="CONDITIONAL_APPROVAL">Conditional approval</option><option value="MORE_INFORMATION_REQUIRED">More information</option><option value="DECLINED">Decline</option><option value="CANCELLED">Cancel</option></select></Field>
              <Field label="Approved amount"><input name="approvedAmount" type="number" min="0" step="0.01" defaultValue={String(file.requestedAmount)} /></Field>
              <Field label="Tenor"><input name="tenorMonths" type="number" min="1" defaultValue={String(file.tenorMonths)} /></Field>
              <Field label="Interest rate" hint="Annual percent. Leave blank to use the product rate."><input name="interestRate" type="number" min="0" step="0.001" /></Field>
              <Field label="Conditions" hint="optional"><input name="conditions" /></Field>
              <Field label="Decision reference" hint="optional"><input name="decisionReference" /></Field>
              <Field label="Comments" hint="optional"><input name="comments" /></Field>
              <button className="button primary" type="submit" disabled={action.busy}>Record the institution decision</button>
            </form>
          </Panel>
      )}
      {write && tab === 'offer' && (
          <Panel title="Offer and contract" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.offer(applicationId, { response: str(form, 'response'), acceptedBy: str(form, 'acceptedBy') || undefined })
                data.reload()
              })
            })}>
              <Field label="Customer response"><select name="response"><option value="ACCEPTED">Accept</option><option value="CHANGES">Request changes</option><option value="REJECTED">Reject</option></select></Field>
              <Field label="Accepted by" hint="optional"><input name="acceptedBy" defaultValue={file.applicantName} /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Record response</button>
            </form>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.contract(applicationId, { security: str(form, 'security') || undefined, guarantee: str(form, 'guarantee') || undefined, defaultTerms: str(form, 'defaultTerms') || undefined, borrowerSigned: checked(form, 'borrowerSigned'), institutionSigned: checked(form, 'institutionSigned'), representative: str(form, 'representative') || undefined })
                data.reload()
              })
            })}>
              <Field label="Security" hint="optional"><input name="security" /></Field>
              <Field label="Guarantee" hint="optional"><input name="guarantee" /></Field>
              <Field label="Default terms" hint="optional"><input name="defaultTerms" /></Field>
              <Field label="Representative" hint="optional"><input name="representative" /></Field>
              <label className="app-check"><input name="borrowerSigned" type="checkbox" /> Borrower signed</label>
              <label className="app-check"><input name="institutionSigned" type="checkbox" /> Financial institution signed</label>
              <button className="button primary" type="submit" disabled={action.busy}>Create the contract and schedule</button>
            </form>
          </Panel>
      )}
      {write && tab === 'security' && (
          <Panel title="Collateral and guarantee" wide>
            <Table columns={['Type', 'Value', 'Status']} empty="No collateral is registered." rows={file.collateral.map((item) => [item.collateralType, money(item.estimatedValue, file.currency), item.status])} />
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.collateral(applicationId, { collateralType: str(form, 'collateralType'), description: str(form, 'description'), owner: str(form, 'owner'), estimatedValue: num(form, 'estimatedValue'), documentName: str(form, 'documentName') || undefined })
                data.reload()
              })
            })}>
              <Field label="Type"><select name="collateralType">{COLLATERAL_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Description"><input name="description" required /></Field>
              <Field label="Owner"><input name="owner" required /></Field>
              <Field label="Estimated value"><input name="estimatedValue" type="number" min="0" step="0.01" required /></Field>
              <Field label="Ownership document" hint="optional"><input name="documentName" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Add collateral</button>
            </form>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                await api.lending.guarantee(applicationId, { requestedLoan: num(form, 'requestedLoan'), requestedGuarantee: num(form, 'requestedGuarantee'), purpose: str(form, 'purpose'), facility: str(form, 'facility') || undefined, fee: num(form, 'fee') })
                data.reload()
              })
            })}>
              <Field label="Requested loan"><input name="requestedLoan" type="number" min="1" step="0.01" defaultValue={String(file.requestedAmount)} required /></Field>
              <Field label="Requested guarantee"><input name="requestedGuarantee" type="number" min="0" step="0.01" required /></Field>
              <Field label="Facility" hint="optional"><input name="facility" /></Field>
              <Field label="Purpose"><input name="purpose" required /></Field>
              <Field label="Guarantee fee"><input name="fee" type="number" min="0" step="0.01" defaultValue="0" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Request a guarantee</button>
            </form>
            {file.guarantee && <p>Guarantee request {file.guarantee.requestId}: {money(file.guarantee.requestedGuarantee, file.currency)} · {readable(file.guarantee.decision)}</p>}
          </Panel>
      )}
    </>
  )
}
