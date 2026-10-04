import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, PageHeading, Panel, SearchField, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { DocFields, FormSteps, Options, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { FEE_TYPES, FREQUENCIES, INVESTMENT_TYPES, OPPORTUNITY_DOCS, SECTORS, amount, rows, text, today } from './catalog'

const STEPS = ['Opportunity', 'Financials', 'Documents']

export function OpportunityList() {
  usePageTitle('Opportunities — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const list = useLoad(() => api.investments.opportunities({ q: query || undefined, status: status || undefined }), [query, status])

  return (
    <>
      <PageHeading kicker="Opportunities" title="Investment opportunities" lead="A draft stays unpublished until the proposal documents are attached. Members apply only to a published or open opportunity." icon="school" actions={<Link className="button primary" to="/app/investments/opportunities/new">New opportunity</Link>} />
      {list.error && <Banner>{list.error}</Banner>}
      <Panel icon="search" title="All opportunities">
        <div className="app-inline-actions">
          <SearchField value={query} onChange={setQuery} placeholder="Name, code, or sector…" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Opportunity status">
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            {['DRAFT', 'PUBLISHED', 'OPEN_FOR_INVESTMENT', 'FULLY_SUBSCRIBED', 'SUSPENDED', 'COMPLETED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        {list.loading ? <p className="app-empty">Loading opportunities…</p> : (
          <Table
            columns={['Opportunity', 'Code', 'Type', 'Target', 'Raised', 'Status']}
            empty="No opportunities match that search."
            rows={(list.data?.items ?? []).map((item) => [
              <Link key={text(item.id)} to={`/app/investments/opportunities/${text(item.id)}`}>{text(item.name)}</Link>,
              text(item.code),
              text(item.investmentType).replaceAll('_', ' '),
              money(amount(item.targetAmount), text(item.currency) || 'RWF'),
              money(amount(item.amountRaised), text(item.currency) || 'RWF'),
              <StatusPill key={`${text(item.id)}-status`} value={text(item.status)} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function OpportunityForm() {
  usePageTitle('New opportunity — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const [documents, setDocuments] = useState<DonationDoc[]>([{ documentType: 'PROPOSAL', fileName: '' }])

  function form() {
    return document.getElementById('opportunity-form') as HTMLFormElement
  }

  function submit(mode: 'draft' | 'save') {
    const node = form()
    if (!node.reportValidity()) return
    const data = steps.collect(node)
    void run(async () => {
      const created = await api.investments.saveOpportunity({
        code: data.code,
        name: data.name,
        investmentType: data.investmentType,
        description: data.description,
        projectName: data.projectName,
        sector: data.sector,
        location: data.location,
        managerName: data.managerName,
        startDate: data.startDate,
        endDate: data.endDate,
        targetAmount: Number(data.targetAmount),
        minimumAmount: Number(data.minimumAmount),
        maximumAmount: data.maximumAmount ? Number(data.maximumAmount) : undefined,
        currency: data.currency || 'RWF',
        expectedReturnRate: Number(data.expectedReturnRate),
        returnFrequency: data.returnFrequency,
        investmentPeriod: data.investmentPeriod,
        expectedProfit: data.expectedProfit ? Number(data.expectedProfit) : undefined,
        riskDisclosure: data.riskDisclosure,
        managementFeeRate: data.managementFeeRate ? Number(data.managementFeeRate) : undefined,
        otherCharges: data.otherCharges ? Number(data.otherCharges) : undefined,
        earlyRedemptionRate: data.earlyRedemptionRate ? Number(data.earlyRedemptionRate) : undefined,
        documents: documents.filter((item) => item.fileName.trim()),
        mode,
      })
      navigate(`/app/investments/opportunities/${text(created.id)}`)
    })
  }

  return (
    <>
      <PageHeading kicker="Opportunities" title="New opportunity" lead="The opportunity number is assigned when this record is saved. Publishing happens from the opportunity file after the documents are attached." icon="school" />
      {error && <Banner>{error}</Banner>}
      <Panel icon="ledger" title="Opportunity">
        <form id="opportunity-form" className="form-wizard" onSubmit={onSubmit(() => submit('save'))}>
          <FormSteps steps={STEPS} step={steps.step} onPick={(index) => steps.move(form(), index > steps.step ? steps.step + 1 : index, STEPS.length)} />
          {steps.step === 0 && (
            <div className="app-form" key="details">
              <Field label="Opportunity code" note="required"><input name="code" required defaultValue={kept(saved, 'code')} /></Field>
              <Field label="Opportunity name" note="required"><input name="name" required defaultValue={kept(saved, 'name')} /></Field>
              <Field label="Investment type" note="required">
                <select name="investmentType" required defaultValue={kept(saved, 'investmentType', 'PROJECT')}><Options options={INVESTMENT_TYPES} /></select>
              </Field>
              <Field label="Sector" note="required">
                <select name="sector" required defaultValue={kept(saved, 'sector', 'EDUCATION')}><Options options={SECTORS} /></select>
              </Field>
              <Field label="Project name" note="required"><input name="projectName" required defaultValue={kept(saved, 'projectName')} /></Field>
              <Field label="Location" note="required"><input name="location" required defaultValue={kept(saved, 'location')} /></Field>
              <Field label="Investment manager" note="required"><input name="managerName" required defaultValue={kept(saved, 'managerName')} /></Field>
              <Field label="Start date" note="required"><input name="startDate" type="date" required defaultValue={kept(saved, 'startDate', today())} /></Field>
              <Field label="End date" note="required"><input name="endDate" type="date" required defaultValue={kept(saved, 'endDate')} /></Field>
              <Field label="Description" span="full" note="required"><textarea name="description" required defaultValue={kept(saved, 'description')} /></Field>
            </div>
          )}
          {steps.step === 1 && (
            <div className="app-form" key="financials">
              <Field label="Target amount" note="required"><input name="targetAmount" type="number" min="1" step="0.01" required defaultValue={kept(saved, 'targetAmount')} /></Field>
              <Field label="Minimum investment" note="required"><input name="minimumAmount" type="number" min="1" step="0.01" required defaultValue={kept(saved, 'minimumAmount')} /></Field>
              <Field label="Maximum investment" note="optional"><input name="maximumAmount" type="number" min="1" step="0.01" defaultValue={kept(saved, 'maximumAmount')} /></Field>
              <Field label="Currency" note="required"><input name="currency" required defaultValue={kept(saved, 'currency', 'RWF')} /></Field>
              <Field label="Expected return rate (%)" note="required"><input name="expectedReturnRate" type="number" min="0" step="0.01" required defaultValue={kept(saved, 'expectedReturnRate')} /></Field>
              <Field label="Return frequency" note="required">
                <select name="returnFrequency" required defaultValue={kept(saved, 'returnFrequency', 'ANNUAL')}><Options options={FREQUENCIES} /></select>
              </Field>
              <Field label="Investment period" note="required"><input name="investmentPeriod" required defaultValue={kept(saved, 'investmentPeriod')} placeholder="12 months" /></Field>
              <Field label="Expected profit" note="optional"><input name="expectedProfit" type="number" min="0" step="0.01" defaultValue={kept(saved, 'expectedProfit')} /></Field>
              <Field label="Management fee (%)" note="optional"><input name="managementFeeRate" type="number" min="0" step="0.01" defaultValue={kept(saved, 'managementFeeRate', '0')} /></Field>
              <Field label="Other charges" note="optional"><input name="otherCharges" type="number" min="0" step="0.01" defaultValue={kept(saved, 'otherCharges', '0')} /></Field>
              <Field label="Early redemption rate (%)" note="optional"><input name="earlyRedemptionRate" type="number" min="0" step="0.01" defaultValue={kept(saved, 'earlyRedemptionRate', '0')} /></Field>
              <Field label="Risk disclosure" span="full" note="required"><textarea name="riskDisclosure" required defaultValue={kept(saved, 'riskDisclosure')} /></Field>
            </div>
          )}
          {steps.step === 2 && (
            <DocFields documents={documents} onChange={setDocuments} types={OPPORTUNITY_DOCS} />
          )}
          <StepNav
            step={steps.step}
            count={STEPS.length}
            busy={busy}
            onBack={() => steps.move(form(), steps.step - 1, STEPS.length)}
            onNext={() => steps.move(form(), steps.step + 1, STEPS.length)}
            submitLabel="Save opportunity"
            extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft')}>Save draft</button>}
          />
        </form>
      </Panel>
    </>
  )
}

export function OpportunityFile() {
  usePageTitle('Opportunity — UPSA Next Payment')
  const { opportunityId = '' } = useParams()
  const { can } = useAuth()
  const file = useLoad(() => api.investments.opportunity(opportunityId), [opportunityId])
  const { error, busy, run } = useAction()
  const data = file.data
  const fees = rows(data?.feeLines)

  return (
    <>
      <PageHeading
        kicker={text(data?.id) || 'Opportunity'}
        title={text(data?.name) || 'Opportunity'}
        lead={text(data?.description)}
        icon="school"
        actions={data ? <StatusPill value={text(data.status)} /> : undefined}
      />
      {(file.error || error) && <Banner>{file.error || error}</Banner>}
      {data && (
        <>
          <Panel icon="ledger" title="Terms">
            <Table
              columns={['Field', 'Value']}
              empty="This opportunity has no terms."
              rows={[
                ['Code', text(data.code)],
                ['Type', text(data.investmentType).replaceAll('_', ' ')],
                ['Sector', text(data.sector).replaceAll('_', ' ')],
                ['Location', text(data.location)],
                ['Manager', text(data.managerName)],
                ['Target', money(amount(data.targetAmount), text(data.currency) || 'RWF')],
                ['Raised', money(amount(data.amountRaised), text(data.currency) || 'RWF')],
                ['Minimum', money(amount(data.minimumAmount), text(data.currency) || 'RWF')],
                ['Expected return', `${amount(data.expectedReturnRate)}% ${text(data.returnFrequency).replaceAll('_', ' ')}`],
                ['Period', text(data.investmentPeriod)],
                ['Dates', `${text(data.startDate)} – ${text(data.endDate)}`],
                ['Management fee', `${amount(data.managementFeeRate)}%`],
                ['Other charges', money(amount(data.otherCharges), text(data.currency) || 'RWF')],
                ['Early redemption', `${amount(data.earlyRedemptionRate)}%`],
              ].map(([label, value]) => [label, value])}
            />
            <p className="app-note">{text(data.riskDisclosure)}</p>
          </Panel>
          {can('investment.write') && (
            <Panel icon="shield" title="Status">
              <div className="app-inline-actions">
                {['PUBLISHED', 'OPEN_FOR_INVESTMENT', 'SUSPENDED', 'CLOSED', 'COMPLETED'].map((status) => (
                  <button key={status} className="button secondary" type="button" disabled={busy || text(data.status) === status} onClick={() => void run(async () => { file.setData(await api.investments.opportunityStatus(opportunityId, status)) })}>
                    {status.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </Panel>
          )}
          <Panel icon="report" title="Fee lines">
            {fees.length > 0 && (
              <Table
                columns={['Code', 'Name', 'Type', 'Basis', 'Rate', 'Effective']}
                empty="No fee lines."
                rows={fees.map((line) => [text(line.code), text(line.name), text(line.feeType).replaceAll('_', ' '), text(line.basis), String(amount(line.rate)), text(line.effectiveDate)])}
              />
            )}
            {can('investment.write') && (
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  file.setData(await api.investments.saveFee(opportunityId, {
                    code: String(body.get('code') ?? ''),
                    name: String(body.get('name') ?? ''),
                    feeType: String(body.get('feeType') ?? ''),
                    basis: String(body.get('basis') ?? ''),
                    rate: Number(body.get('rate') ?? 0),
                    effectiveDate: String(body.get('effectiveDate') ?? ''),
                  }))
                  event.currentTarget.reset()
                })
              })}>
                <Field label="Code" note="required"><input name="code" required /></Field>
                <Field label="Name" note="required"><input name="name" required /></Field>
                <Field label="Type" note="required"><select name="feeType" required><Options options={FEE_TYPES} /></select></Field>
                <Field label="Basis" note="required"><select name="basis" required><option value="PERCENT">Percent</option><option value="FIXED">Fixed</option></select></Field>
                <Field label="Rate" note="required"><input name="rate" type="number" min="0" step="0.01" required /></Field>
                <Field label="Effective date" note="required"><input name="effectiveDate" type="date" required defaultValue={today()} /></Field>
                <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Save fee</button></div>
              </form>
            )}
          </Panel>
          {can('investment.write') && text(data.status) !== 'DRAFT' && (
            <Panel icon="pay" title="Dividend">
              <form className="app-form" onSubmit={onSubmit((event) => {
                const body = new FormData(event.currentTarget)
                void run(async () => {
                  await api.investments.dividend(opportunityId, {
                    period: String(body.get('period') ?? ''),
                    totalDividend: Number(body.get('totalDividend') ?? 0),
                    distributionDate: String(body.get('distributionDate') ?? ''),
                  })
                  event.currentTarget.reset()
                })
              })}>
                <Field label="Period" note="required"><input name="period" required placeholder="2026 Q4" /></Field>
                <Field label="Total dividend" note="required"><input name="totalDividend" type="number" min="1" step="0.01" required /></Field>
                <Field label="Distribution date" note="required"><input name="distributionDate" type="date" required defaultValue={today()} /></Field>
                <div className="student-actions"><button className="button primary" type="submit" disabled={busy}>Calculate dividend</button></div>
              </form>
            </Panel>
          )}
        </>
      )}
    </>
  )
}
