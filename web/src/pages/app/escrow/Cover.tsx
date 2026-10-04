import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { onSubmit, useAction } from '../donations/kit'
import { DECISIONS, FACILITY_TYPES, PAYMENT_METHODS, num, str, today } from './catalog'

export function FacilityList() {
  usePageTitle('Guarantee facilities — UPSA Next Payment')
  const data = useLoad(() => api.escrow.facilities())
  const action = useAction()
  const groups = useLoad(() => api.escrow.groups())
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Guarantee" title="Facilities" lead="Capacity is the approved limit minus the remaining exposure of guarantees that are still open." icon="shield" />
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Facility', 'Limit', 'Used', 'Available', 'Percent', 'Status']}
        empty="No facility is registered."
        rows={(data.data?.items ?? []).map((item) => [item.name, money(item.approvedLimit, item.currency), money(item.utilized, item.currency), money(item.available, item.currency), `${item.guaranteePercent}%`, item.status])}
      />
      {can('guarantee.write') && (
        <Panel title="Create a facility" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.createFacility({
                name: str(form, 'name'),
                facilityType: str(form, 'facilityType'),
                groupId: str(form, 'groupId') || undefined,
                approvedLimit: num(form, 'approvedLimit'),
                guaranteePercent: num(form, 'guaranteePercent'),
                maximumAmount: num(form, 'maximumAmount'),
                feeRate: num(form, 'feeRate'),
                effectiveDate: str(form, 'effectiveDate'),
                expiryDate: str(form, 'expiryDate') || undefined,
                terms: str(form, 'terms'),
                mode: 'active',
              })
              data.reload()
            })
          })}>
            <Field label="Name"><input name="name" required /></Field>
            <Field label="Type"><select name="facilityType">{FACILITY_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Group" hint="optional"><select name="groupId"><option value="">None</option>{(groups.data?.items ?? []).map((group) => <option key={group.groupId} value={group.groupId}>{group.name}</option>)}</select></Field>
            <Field label="Approved limit"><input name="approvedLimit" type="number" min="1" step="0.01" required /></Field>
            <Field label="Maximum guarantee"><input name="maximumAmount" type="number" min="1" step="0.01" required /></Field>
            <Field label="Guarantee percentage"><input name="guaranteePercent" type="number" min="0" max="100" defaultValue="60" required /></Field>
            <Field label="Fee rate %"><input name="feeRate" type="number" min="0" step="0.001" defaultValue="1" /></Field>
            <Field label="Effective date"><input name="effectiveDate" type="date" defaultValue={today()} required /></Field>
            <Field label="Expiry" hint="optional"><input name="expiryDate" type="date" /></Field>
            <Field label="Terms" hint="optional"><textarea name="terms" /></Field>
            {action.error && <p className="form-error">{action.error}</p>}
            <button className="button primary" type="submit" disabled={action.busy}>Open facility</button>
          </form>
        </Panel>
      )}
    </>
  )
}

export function ApplicationList() {
  usePageTitle('Guarantee applications — UPSA Next Payment')
  const data = useLoad(() => api.escrow.applications())
  return (
    <>
      <PageHeading kicker="Guarantee" title="Applications" lead="Eligibility, assessment and the decision come before the certificate." icon="shield" actions={<Link className="button primary" to="/app/escrow/applications/new">New application</Link>} />
      <Table
        columns={['Applicant', 'Loan', 'Guarantee', 'Decision', 'Status']}
        empty="No guarantee application yet."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.applicationId} to={`/app/escrow/applications/${item.applicationId}`}>{item.applicant}</Link>,
          money(item.requestedLoan),
          money(item.requestedGuarantee),
          item.decision ?? '—',
          <StatusPill key={`${item.applicationId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

export function ApplicationForm() {
  usePageTitle('Guarantee application — UPSA Next Payment')
  const navigate = useNavigate()
  const groups = useLoad(() => api.escrow.groups())
  const facilities = useLoad(() => api.escrow.facilities())
  const accounts = useLoad(() => api.escrow.accounts())
  const collateral = useLoad(() => api.escrow.collateral())
  const loans = useLoad(() => api.loans.applications())
  const action = useAction()
  return (
    <>
      <PageHeading kicker="Guarantee" title="Request a guarantee" lead="The application can point at an existing loan application. It does not create a second loan." icon="shield" />
      <form className="app-form" onSubmit={onSubmit((event) => {
        const form = new FormData(event.currentTarget)
        action.run(async () => {
          const created = await api.escrow.createApplication({
            applicant: str(form, 'applicant'),
            groupId: str(form, 'groupId') || undefined,
            facilityId: str(form, 'facilityId') || undefined,
            accountId: str(form, 'accountId') || undefined,
            assetId: str(form, 'assetId') || undefined,
            loanApplicationId: str(form, 'loanApplicationId') || undefined,
            product: str(form, 'product'),
            requestedLoan: num(form, 'requestedLoan'),
            requestedGuarantee: num(form, 'requestedGuarantee'),
            guaranteePercent: num(form, 'guaranteePercent'),
            purpose: str(form, 'purpose'),
            contribution: num(form, 'contribution'),
            riskInformation: str(form, 'riskInformation'),
            requestedDate: str(form, 'requestedDate'),
          })
          navigate(`/app/escrow/applications/${created.applicationId}`)
        })
      })}>
        <Field label="Applicant"><input name="applicant" required /></Field>
        <Field label="Group" hint="optional"><select name="groupId"><option value="">None</option>{(groups.data?.items ?? []).map((group) => <option key={group.groupId} value={group.groupId}>{group.name}</option>)}</select></Field>
        <Field label="Facility" hint="optional"><select name="facilityId"><option value="">None</option>{(facilities.data?.items ?? []).map((item) => <option key={item.facilityId} value={item.facilityId}>{item.name}</option>)}</select></Field>
        <Field label="Escrow account" hint="optional"><select name="accountId"><option value="">None</option>{(accounts.data?.items ?? []).map((item) => <option key={item.accountId} value={item.accountId}>{item.name}</option>)}</select></Field>
        <Field label="Collateral" hint="optional"><select name="assetId"><option value="">None</option>{(collateral.data?.items ?? []).map((item) => <option key={item.collateralId} value={item.collateralId}>{item.description}</option>)}</select></Field>
        <Field label="Existing loan application" hint="optional"><select name="loanApplicationId"><option value="">None</option>{(loans.data?.items ?? []).map((item) => <option key={item.applicationId} value={item.applicationId}>{item.applicationId} · {item.productCode}</option>)}</select></Field>
        <Field label="Product" hint="optional"><input name="product" /></Field>
        <Field label="Requested loan"><input name="requestedLoan" type="number" min="1" step="0.01" required /></Field>
        <Field label="Requested guarantee"><input name="requestedGuarantee" type="number" min="1" step="0.01" required /></Field>
        <Field label="Guarantee percentage"><input name="guaranteePercent" type="number" min="0" max="100" defaultValue="60" required /></Field>
        <Field label="Applicant contribution"><input name="contribution" type="number" min="0" step="0.01" defaultValue="0" /></Field>
        <Field label="Purpose"><textarea name="purpose" required /></Field>
        <Field label="Risk information" hint="optional"><textarea name="riskInformation" /></Field>
        <Field label="Requested date"><input name="requestedDate" type="date" defaultValue={today()} required /></Field>
        {action.error && <p className="form-error">{action.error}</p>}
        <button className="button primary" type="submit" disabled={action.busy}>Submit application</button>
      </form>
    </>
  )
}

export function ApplicationFilePage() {
  usePageTitle('Guarantee application — UPSA Next Payment')
  const { applicationId = '' } = useParams()
  const data = useLoad(() => api.escrow.application(applicationId), [applicationId])
  const { can } = useAuth()
  const action = useAction()
  const navigate = useNavigate()
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the application.</p>
  const eligibility = file.eligibility as { result?: string; notes?: string } | null
  const assessment = file.assessment as { recommended?: number; result?: string } | null
  const decision = file.decision as { decision?: string; approvedAmount?: number } | null
  return (
    <>
      <PageHeading kicker="Guarantee" title={String(file.applicant)} lead={String(file.purpose)} icon="shield" />
      <p><StatusPill value={String(file.status)} /> Requested {money(Number(file.requestedGuarantee))} of loan {money(Number(file.requestedLoan))}</p>
      {eligibility && <p>Eligibility: {eligibility.result}{eligibility.notes ? ` — ${eligibility.notes}` : ''}</p>}
      {assessment && <p>Assessment: {assessment.result} · recommended {money(Number(assessment.recommended))}</p>}
      {decision && <p>Decision: {decision.decision} · approved {money(Number(decision.approvedAmount))}</p>}
      {action.error && <p className="form-error">{action.error}</p>}
      {can('guarantee.write') && (
        <>
          <button className="button secondary" type="button" disabled={action.busy} onClick={() => action.run(async () => { await api.escrow.eligibility(applicationId); data.reload() })}>Run eligibility</button>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.assessment(applicationId, {
                recommended: num(form, 'recommended'),
                result: str(form, 'result'),
                repaymentCapacity: str(form, 'repaymentCapacity'),
                riskFactors: str(form, 'riskFactors'),
                mitigation: str(form, 'mitigation'),
                conditions: str(form, 'conditions'),
              })
              data.reload()
            })
          })}>
            <Field label="Recommended guarantee"><input name="recommended" type="number" min="1" step="0.01" defaultValue={String(file.requestedGuarantee)} required /></Field>
            <Field label="Result"><input name="result" defaultValue="ACCEPT" required /></Field>
            <Field label="Repayment capacity" hint="optional"><input name="repaymentCapacity" /></Field>
            <Field label="Risk factors" hint="optional"><input name="riskFactors" /></Field>
            <Field label="Mitigation" hint="optional"><input name="mitigation" /></Field>
            <Field label="Conditions" hint="optional"><input name="conditions" /></Field>
            <button className="button secondary" type="submit" disabled={action.busy}>Save assessment</button>
          </form>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.decision(applicationId, {
                decision: str(form, 'decision'),
                approvedAmount: num(form, 'approvedAmount'),
                effectiveDate: str(form, 'effectiveDate'),
                expiryDate: str(form, 'expiryDate') || undefined,
                conditions: str(form, 'conditions'),
                reference: str(form, 'reference'),
              })
              data.reload()
            })
          })}>
            <Field label="Decision"><select name="decision">{DECISIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Approved amount"><input name="approvedAmount" type="number" min="0" step="0.01" defaultValue={String(assessment?.recommended ?? file.requestedGuarantee)} /></Field>
            <Field label="Effective date"><input name="effectiveDate" type="date" defaultValue={today()} /></Field>
            <Field label="Expiry" hint="optional"><input name="expiryDate" type="date" /></Field>
            <Field label="Conditions" hint="optional"><input name="conditions" /></Field>
            <Field label="Reference" hint="optional"><input name="reference" /></Field>
            <button className="button secondary" type="submit" disabled={action.busy}>Record decision</button>
          </form>
          <button className="button primary" type="button" disabled={action.busy} onClick={() => action.run(async () => {
            const issued = await api.escrow.issue(applicationId, { signatory: 'UPSA officer' })
            navigate(`/app/escrow/guarantees/${issued.guaranteeId}`)
          })}>Issue certificate</button>
        </>
      )}
    </>
  )
}

export function GuaranteeList() {
  usePageTitle('Guarantees — UPSA Next Payment')
  const data = useLoad(() => api.escrow.guarantees())
  return (
    <>
      <PageHeading kicker="Guarantee" title="Active guarantees" lead="Exposure is the outstanding loan times the guarantee percentage, capped by the maximum liability, then reduced by claims and restored by recoveries." icon="shield" />
      <Table
        columns={['Guarantee', 'Applicant', 'Certificate', 'Exposure', 'Status']}
        empty="No guarantee has been issued."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.guaranteeId} to={`/app/escrow/guarantees/${item.guaranteeId}`}>{item.guaranteeId}</Link>,
          item.applicant,
          item.certificateNumber ?? '—',
          money(item.currentExposure),
          <StatusPill key={`${item.guaranteeId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

export function GuaranteeFilePage() {
  usePageTitle('Guarantee — UPSA Next Payment')
  const { guaranteeId = '' } = useParams()
  const data = useLoad(() => api.escrow.guarantee(guaranteeId), [guaranteeId])
  const { can } = useAuth()
  const action = useAction()
  const navigate = useNavigate()
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the guarantee.</p>
  const coverage = file.coverage as { escrowCoverage: number; collateralCoverage: number; guaranteeCoverage: number; totalSecurity: number; coverageRatio: number; coverageGap: number } | undefined
  const certificate = file.certificate as { certificateNumber?: string; signatory?: string; claimConditions?: string } | null
  return (
    <>
      <PageHeading kicker="Guarantee" title={String(file.applicant)} lead={`Certificate ${certificate?.certificateNumber ?? 'pending'}`} icon="shield" />
      <p><StatusPill value={String(file.status)} /> Exposure {money(Number(file.currentExposure))} · Claims paid {money(Number(file.claimsPaid))} · Recoveries {money(Number(file.recoveries))}</p>
      {coverage && (
        <Panel title="Coverage, counted once" wide>
          <p>Escrow coverage {money(coverage.escrowCoverage)}. Collateral coverage {money(coverage.collateralCoverage)}. Guarantee coverage {money(coverage.guaranteeCoverage)}.</p>
          <p>Combined security {money(coverage.totalSecurity)}. Coverage ratio {coverage.coverageRatio}%. Gap {money(coverage.coverageGap)}.</p>
        </Panel>
      )}
      {certificate && <p>{certificate.claimConditions} Signed by {certificate.signatory}.</p>}
      {action.error && <p className="form-error">{action.error}</p>}
      {can('guarantee.write') && (
        <Panel title="Submit a claim" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              const claim = await api.escrow.claim(guaranteeId, {
                borrower: str(form, 'borrower'),
                lender: str(form, 'lender'),
                loanId: str(form, 'loanId') || undefined,
                defaultDate: str(form, 'defaultDate') || undefined,
                outstandingPrincipal: num(form, 'outstandingPrincipal'),
                outstandingInterest: num(form, 'outstandingInterest'),
                amountClaimed: num(form, 'amountClaimed'),
                reason: str(form, 'reason'),
                recoveryActions: str(form, 'recoveryActions'),
                claimDate: str(form, 'claimDate'),
              })
              navigate(`/app/escrow/claims/${claim.claimId}`)
            })
          })}>
            <Field label="Borrower"><input name="borrower" defaultValue={String(file.applicant)} required /></Field>
            <Field label="Lender" hint="optional"><input name="lender" /></Field>
            <Field label="Loan ID" hint="optional"><input name="loanId" defaultValue={String(file.loanPublicId ?? '')} /></Field>
            <Field label="Default date" hint="optional"><input name="defaultDate" type="date" defaultValue={today()} /></Field>
            <Field label="Outstanding principal"><input name="outstandingPrincipal" type="number" min="0" step="0.01" defaultValue="0" /></Field>
            <Field label="Outstanding interest"><input name="outstandingInterest" type="number" min="0" step="0.01" defaultValue="0" /></Field>
            <Field label="Amount claimed"><input name="amountClaimed" type="number" min="1" step="0.01" required /></Field>
            <Field label="Default reason"><textarea name="reason" required /></Field>
            <Field label="Recovery actions taken" hint="optional"><textarea name="recoveryActions" /></Field>
            <Field label="Claim date"><input name="claimDate" type="date" defaultValue={today()} required /></Field>
            <button className="button primary" type="submit" disabled={action.busy}>Submit claim</button>
          </form>
        </Panel>
      )}
    </>
  )
}

export function ClaimFilePage() {
  usePageTitle('Guarantee claim — UPSA Next Payment')
  const { claimId = '' } = useParams()
  const data = useLoad(() => api.escrow.claimFile(claimId), [claimId])
  const { can } = useAuth()
  const action = useAction()
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the claim.</p>
  return (
    <>
      <PageHeading kicker="Claim" title={String(file.claimId)} lead={`${file.borrower} · claimed ${money(Number(file.amountClaimed))}`} icon="shield" />
      <p><StatusPill value={String(file.status)} /> Eligible {money(Number(file.eligibleAmount))} · Approved {money(Number(file.approvedAmount))}</p>
      {action.error && <p className="form-error">{action.error}</p>}
      {can('guarantee.write') && (
        <>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.assessClaim(claimId, {
                guaranteeValid: true,
                certificateValid: true,
                loanValid: true,
                defaultVerified: true,
                result: str(form, 'result'),
              })
              data.reload()
            })
          })}>
            <Field label="Assessment result"><input name="result" defaultValue="ELIGIBLE" required /></Field>
            <button className="button secondary" type="submit" disabled={action.busy}>Assess claim</button>
          </form>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.approveClaim(claimId, { approvedAmount: num(form, 'approvedAmount'), reason: str(form, 'reason') })
              data.reload()
            })
          })}>
            <Field label="Approved amount"><input name="approvedAmount" type="number" min="0" step="0.01" defaultValue={String(file.eligibleAmount || file.amountClaimed)} required /></Field>
            <Field label="Reason" hint="optional"><input name="reason" /></Field>
            <button className="button secondary" type="submit" disabled={action.busy}>Approve claim</button>
          </form>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.payClaim(claimId, {
                amount: num(form, 'amount'),
                payee: str(form, 'payee'),
                bankAccount: str(form, 'bankAccount'),
                paymentMethod: str(form, 'paymentMethod'),
                externalTransactionId: str(form, 'externalTransactionId'),
                paymentReference: str(form, 'paymentReference'),
                paymentDate: str(form, 'paymentDate'),
              })
              data.reload()
            })
          })}>
            <Field label="Payee"><input name="payee" required /></Field>
            <Field label="Bank account"><input name="bankAccount" required /></Field>
            <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
            <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="External transaction ID"><input name="externalTransactionId" required /></Field>
            <Field label="Payment reference" hint="optional"><input name="paymentReference" /></Field>
            <Field label="Payment date"><input name="paymentDate" type="date" defaultValue={today()} required /></Field>
            <button className="button primary" type="submit" disabled={action.busy}>Pay through the payment service</button>
          </form>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.recover(claimId, { amount: num(form, 'amount'), source: str(form, 'source'), recoveryDate: str(form, 'recoveryDate'), action: str(form, 'action') })
              data.reload()
            })
          })}>
            <Field label="Recovery amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
            <Field label="Source"><input name="source" required /></Field>
            <Field label="Date"><input name="recoveryDate" type="date" defaultValue={today()} required /></Field>
            <Field label="Action" hint="optional"><input name="action" /></Field>
            <button className="button secondary" type="submit" disabled={action.busy}>Record recovery</button>
          </form>
        </>
      )}
    </>
  )
}
