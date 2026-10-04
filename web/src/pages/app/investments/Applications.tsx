import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Check, DocFields, FormSteps, Options, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { DILIGENCE, FUNDING, OPPORTUNITY_DOCS, RISKS, amount, text, today } from './catalog'

const STEPS = ['Member', 'Investment', 'Declaration']

export function ApplicationList() {
  usePageTitle('Applications — UPSA Next Payment')
  const [status, setStatus] = useState('')
  const list = useLoad(() => api.investments.applications({ status: status || undefined }), [status])

  return (
    <>
      <PageHeading kicker="Applications" title="Investment applications" lead="Eligibility, due diligence, risk, and approval stay on the application. Approval opens one investment position." icon="user" actions={<Link className="button primary" to="/app/investments/applications/new">New application</Link>} />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="search" title="All applications">
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Application status">
          <option value="">All statuses</option>
          {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select>
        {list.loading ? <p className="app-empty">Loading applications…</p> : (
          <Table
            columns={['Application', 'Member', 'Opportunity', 'Amount', 'Status']}
            empty="No applications match that filter."
            rows={(list.data?.items ?? []).map((item) => [
              <Link key={text(item.id)} to={`/app/investments/applications/${text(item.id)}`}>{text(item.id)}</Link>,
              text(item.member),
              text(item.opportunity),
              money(amount(item.requestedAmount), text(item.currency) || 'RWF'),
              <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function ApplicationForm() {
  usePageTitle('New application — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const members = useLoad(() => api.investments.members())
  const opportunities = useLoad(() => api.investments.opportunities({ status: 'OPEN' }))
  const [documents, setDocuments] = useState<DonationDoc[]>([{ documentType: 'PROPOSAL', fileName: '' }])
  const [flags, setFlags] = useState({ confirmInformation: false, reviewedTerms: false, understandRisks: false, agreeAgreement: false })

  function form() {
    return document.getElementById('application-form') as HTMLFormElement
  }

  function submit(mode: 'draft' | 'submit') {
    const node = form()
    if (mode === 'submit' && !node.reportValidity()) return
    const data = steps.collect(node)
    const member = (members.data?.items ?? []).find((item) => item.id === data.memberId)
    void run(async () => {
      const created = await api.investments.saveApplication({
        memberId: data.memberId,
        memberSource: member?.source,
        opportunityId: data.opportunityId,
        representative: data.representative,
        telephone: data.telephone || member?.telephone,
        email: data.email || member?.email || undefined,
        requestedAmount: Number(data.requestedAmount),
        currency: data.currency || undefined,
        investmentPeriod: data.investmentPeriod,
        purpose: data.purpose || undefined,
        fundingSource: data.fundingSource,
        ...flags,
        documents: documents.filter((item) => item.fileName.trim()),
        mode,
      })
      navigate(`/app/investments/applications/${text(created.id)}`)
    })
  }

  return (
    <>
      <PageHeading kicker="Applications" title="New application" lead="The member is an active verified school or an approved investor registration. The amount must sit inside the open opportunity." icon="user" />
      {(error || members.error || opportunities.error) && <Banner>{error || members.error || opportunities.error}</Banner>}
      <Panel icon="user" title="Application">
        <form id="application-form" className="form-wizard" onSubmit={onSubmit(() => submit('submit'))}>
          <FormSteps steps={STEPS} step={steps.step} onPick={(index) => steps.move(form(), index > steps.step ? steps.step + 1 : index, STEPS.length)} />
          {steps.step === 0 && (
            <div className="app-form" key="member">
              <Field label="Member" span="full" note="required">
                <select name="memberId" required defaultValue={kept(saved, 'memberId')}>
                  <option value="">Select a member</option>
                  {(members.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}
                </select>
              </Field>
              <Field label="Representative" note="required"><input name="representative" required defaultValue={kept(saved, 'representative')} /></Field>
              <Field label="Telephone" note="required"><input name="telephone" required defaultValue={kept(saved, 'telephone')} /></Field>
              <Field label="Email" note="optional"><input name="email" type="email" defaultValue={kept(saved, 'email')} /></Field>
            </div>
          )}
          {steps.step === 1 && (
            <div className="app-form" key="investment">
              <Field label="Opportunity" span="full" note="required">
                <select name="opportunityId" required defaultValue={kept(saved, 'opportunityId')}>
                  <option value="">Select an open opportunity</option>
                  {(opportunities.data?.items ?? []).map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.name)} · {text(item.currency)}</option>)}
                </select>
              </Field>
              <Field label="Requested amount" note="required"><input name="requestedAmount" type="number" min="1" step="0.01" required defaultValue={kept(saved, 'requestedAmount')} /></Field>
              <Field label="Currency" note="optional"><input name="currency" defaultValue={kept(saved, 'currency', 'RWF')} /></Field>
              <Field label="Investment period" note="required"><input name="investmentPeriod" required defaultValue={kept(saved, 'investmentPeriod')} /></Field>
              <Field label="Funding source" note="required">
                <select name="fundingSource" required defaultValue={kept(saved, 'fundingSource', 'MEMBER_CONTRIBUTION')}><Options options={FUNDING} /></select>
              </Field>
              <Field label="Purpose" span="full" note="optional"><textarea name="purpose" defaultValue={kept(saved, 'purpose')} /></Field>
            </div>
          )}
          {steps.step === 2 && (
            <div key="declaration">
              <div className="app-form">
                <Check label="The information is accurate." checked={flags.confirmInformation} onChange={(checked) => setFlags({ ...flags, confirmInformation: checked })} />
                <Check label="The terms have been reviewed." checked={flags.reviewedTerms} onChange={(checked) => setFlags({ ...flags, reviewedTerms: checked })} />
                <Check label="The risks are understood." checked={flags.understandRisks} onChange={(checked) => setFlags({ ...flags, understandRisks: checked })} />
                <Check label="The investment agreement will be accepted." checked={flags.agreeAgreement} onChange={(checked) => setFlags({ ...flags, agreeAgreement: checked })} />
              </div>
              <DocFields documents={documents} onChange={setDocuments} types={OPPORTUNITY_DOCS} />
            </div>
          )}
          <StepNav
            step={steps.step}
            count={STEPS.length}
            busy={busy}
            onBack={() => steps.move(form(), steps.step - 1, STEPS.length)}
            onNext={() => steps.move(form(), steps.step + 1, STEPS.length)}
            submitLabel="Submit application"
            extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft')}>Save draft</button>}
          />
        </form>
      </Panel>
    </>
  )
}

export function ApplicationFile() {
  usePageTitle('Application — UPSA Next Payment')
  const { applicationId = '' } = useParams()
  const { can } = useAuth()
  const file = useLoad(() => api.investments.application(applicationId), [applicationId])
  const { error, busy, run } = useAction()
  const data = file.data
  const write = can('investment.write')
  const [diligence, setDiligence] = useState<Record<string, boolean>>({})
  const [ratings, setRatings] = useState<Record<string, string>>({})

  return (
    <>
      <PageHeading
        kicker={text(data?.id) || 'Application'}
        title={text(data?.member) || 'Application'}
        lead={data ? `${text(data.opportunity)} · ${money(amount(data.requestedAmount), text(data.currency) || 'RWF')}` : ''}
        icon="user"
        actions={data ? <StatusPill value={text(data.status)} /> : undefined}
      />
      {(file.error || error) && <Banner>{file.error || error}</Banner>}
      {data && (
        <>
          <Panel icon="user" title="Request">
            <Table
              columns={['Field', 'Value']}
              empty="No request."
              rows={[
                ['Member number', text(data.memberNumber)],
                ['Representative', text(data.representative)],
                ['Telephone', text(data.telephone)],
                ['Period', text(data.investmentPeriod)],
                ['Funding', text(data.fundingSource).replaceAll('_', ' ')],
                ['Eligibility', text(data.eligibilityResult) || 'Pending'],
                ['Diligence', text(data.diligenceResult) || 'Pending'],
                ['Risk', text(data.riskLevel) || 'Pending'],
                ['Decision', text(data.decision) || 'Pending'],
              ]}
            />
            {text(data.positionId) && <p><Link to={`/app/investments/positions/${text(data.positionId)}`}>Open investment {text(data.positionId)}</Link></p>}
          </Panel>
          {write && text(data.status) !== 'APPROVED' && text(data.status) !== 'REJECTED' && (
            <>
              <Panel icon="shield" title="Eligibility">
                <form className="app-form" onSubmit={onSubmit((event) => {
                  const body = new FormData(event.currentTarget)
                  void run(async () => {
                    file.setData(await api.investments.eligibility(applicationId, { decision: String(body.get('decision') ?? ''), comments: String(body.get('comments') ?? '') }))
                  })
                })}>
                  <Field label="Decision" note="required">
                    <select name="decision" required>
                      <option value="APPROVED_FOR_ASSESSMENT">Approved for assessment</option>
                      <option value="MORE_INFORMATION">More information</option>
                      <option value="NOT_ELIGIBLE">Not eligible</option>
                    </select>
                  </Field>
                  <Field label="Comments" span="full" note="optional"><textarea name="comments" /></Field>
                  <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Save eligibility</button></div>
                </form>
              </Panel>
              <Panel icon="report" title="Due diligence">
                <form className="app-form" onSubmit={onSubmit((event) => {
                  const body = new FormData(event.currentTarget)
                  void run(async () => {
                    file.setData(await api.investments.diligence(applicationId, {
                      ...Object.fromEntries(DILIGENCE.map(([key]) => [key, Boolean(diligence[key])])),
                      documents: [{ documentType: 'PROPOSAL', status: String(body.get('documentStatus') ?? 'VERIFIED') }],
                      result: String(body.get('result') ?? ''),
                    }))
                  })
                })}>
                  {DILIGENCE.map(([key, label]) => (
                    <Check key={key} label={label} checked={Boolean(diligence[key])} onChange={(checked) => setDiligence((current) => ({ ...current, [key]: checked }))} />
                  ))}
                  <Field label="Document status" note="required">
                    <select name="documentStatus" required><option value="VERIFIED">Verified</option><option value="PENDING">Pending</option></select>
                  </Field>
                  <Field label="Result" note="required">
                    <select name="result" required>
                      <option value="PASSED">Passed</option>
                      <option value="FAILED">Failed</option>
                      <option value="MORE_INFORMATION_REQUIRED">More information required</option>
                    </select>
                  </Field>
                  <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Save diligence</button></div>
                </form>
              </Panel>
              <Panel icon="shield" title="Risk">
                <form className="app-form" onSubmit={onSubmit((event) => {
                  const body = new FormData(event.currentTarget)
                  void run(async () => {
                    file.setData(await api.investments.risk(applicationId, {
                      ratings: Object.fromEntries(RISKS.map((key) => [key, { rating: ratings[key] || 'MEDIUM', mitigation: '' }])),
                      riskLevel: String(body.get('riskLevel') ?? ''),
                      riskScore: body.get('riskScore') ? Number(body.get('riskScore')) : undefined,
                      mitigationPlan: String(body.get('mitigationPlan') ?? ''),
                      assessor: String(body.get('assessor') ?? ''),
                      assessmentDate: String(body.get('assessmentDate') ?? ''),
                      reviewDate: String(body.get('reviewDate') ?? ''),
                    }))
                  })
                })}>
                  {RISKS.map((key) => (
                    <Field key={key} label={key} note="required">
                      <select value={ratings[key] || 'MEDIUM'} onChange={(event) => setRatings({ ...ratings, [key]: event.target.value })}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </Field>
                  ))}
                  <Field label="Overall level" note="required">
                    <select name="riskLevel" required><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
                  </Field>
                  <Field label="Score" note="optional"><input name="riskScore" type="number" min="0" step="1" /></Field>
                  <Field label="Assessor" note="required"><input name="assessor" required /></Field>
                  <Field label="Assessment date" note="required"><input name="assessmentDate" type="date" required defaultValue={today()} /></Field>
                  <Field label="Review date" note="required"><input name="reviewDate" type="date" required defaultValue={today()} /></Field>
                  <Field label="Mitigation plan" span="full" note="required"><textarea name="mitigationPlan" required /></Field>
                  <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Save risk</button></div>
                </form>
              </Panel>
              <Panel icon="pay" title="Approval">
                <form className="app-form" onSubmit={onSubmit((event) => {
                  const body = new FormData(event.currentTarget)
                  void run(async () => {
                    file.setData(await api.investments.approveApplication(applicationId, {
                      decision: String(body.get('decision') ?? ''),
                      approvedAmount: body.get('approvedAmount') ? Number(body.get('approvedAmount')) : undefined,
                      investmentPeriod: String(body.get('investmentPeriod') ?? '') || undefined,
                      returnRate: body.get('returnRate') ? Number(body.get('returnRate')) : undefined,
                      returnFrequency: String(body.get('returnFrequency') ?? '') || undefined,
                      fees: body.get('fees') ? Number(body.get('fees')) : undefined,
                      conditions: String(body.get('conditions') ?? '') || undefined,
                      startDate: String(body.get('startDate') ?? '') || undefined,
                      maturityDate: String(body.get('maturityDate') ?? '') || undefined,
                      comments: String(body.get('comments') ?? '') || undefined,
                    }))
                  })
                })}>
                  <Field label="Decision" note="required">
                    <select name="decision" required>
                      <option value="APPROVE">Approve</option>
                      <option value="CONDITIONAL">Conditionally approve</option>
                      <option value="MORE_INFORMATION">More information</option>
                      <option value="REJECT">Reject</option>
                    </select>
                  </Field>
                  <Field label="Approved amount" note="optional"><input name="approvedAmount" type="number" min="1" step="0.01" defaultValue={amount(data.requestedAmount)} /></Field>
                  <Field label="Period" note="optional"><input name="investmentPeriod" defaultValue={text(data.investmentPeriod)} /></Field>
                  <Field label="Return rate (%)" note="optional"><input name="returnRate" type="number" min="0" step="0.01" /></Field>
                  <Field label="Fees" note="optional"><input name="fees" type="number" min="0" step="0.01" /></Field>
                  <Field label="Start date" note="required"><input name="startDate" type="date" required defaultValue={today()} /></Field>
                  <Field label="Maturity date" note="required"><input name="maturityDate" type="date" required /></Field>
                  <Field label="Conditions" span="full" note="optional"><textarea name="conditions" /></Field>
                  <Field label="Comments" span="full" note="optional"><textarea name="comments" /></Field>
                  <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Save decision</button></div>
                </form>
              </Panel>
            </>
          )}
        </>
      )}
    </>
  )
}
