import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, FieldGroup, PageHeading, Panel, SearchField, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { BUDGET_CATEGORIES, CAMPAIGN_DOCS, CAMPAIGN_TYPES, today } from './catalog'
import { DocFields, FormSteps, StepNav, useAction, useFormSteps } from './kit'

const CAMPAIGN_STEPS = ['Campaign', 'Target', 'Documents']

export function CampaignList() {
  usePageTitle('Campaigns — UPSA Next Payment')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const campaigns = useLoad(() => api.donations.campaigns({ q: query || undefined, status: status || undefined }), [query, status])

  return (
    <>
      <PageHeading kicker="Campaigns" title="Fundraising campaigns" lead="A campaign stays in draft until it is approved. Only a published, active, or target-reached campaign can accept pledges and donations." icon="school" actions={<Link className="button primary" to="/app/donations/campaigns/new">New campaign</Link>} />
      {campaigns.error && <Banner>{campaigns.error}</Banner>}
      <Panel icon="search" title="All campaigns">
        <div className="app-inline-actions">
          <SearchField value={query} onChange={setQuery} placeholder="Name or code…" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Campaign status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Open campaigns</option>
            {['DRAFT', 'PUBLISHED', 'TARGET_REACHED', 'CLOSED', 'SUSPENDED', 'CANCELLED'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        {campaigns.loading ? <p className="app-empty">Loading campaigns…</p> : (
          <Table
            columns={['Campaign', 'Code', 'Target', 'Raised', 'Remaining', 'Status']}
            empty="No campaigns match that search."
            rows={(campaigns.data?.items ?? []).map((item) => [
              <Link key={item.id} to={`/app/donations/campaigns/${item.id}`}>{item.name}</Link>,
              item.code,
              money(item.targetAmount, item.currency),
              money(item.amountRaised, item.currency),
              money(item.amountRemaining, item.currency),
              <StatusPill key={`${item.id}-status`} value={item.status} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function CampaignForm() {
  usePageTitle('New campaign — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const [documents, setDocuments] = useState<DonationDoc[]>([
    { documentType: 'PROPOSAL', fileName: '' },
    { documentType: 'BUDGET', fileName: '' },
    { documentType: 'APPROVAL', fileName: '' },
  ])

  function form() {
    return document.getElementById('campaign-form') as HTMLFormElement
  }

  function submit(mode: 'draft' | 'save', data: Record<string, string>) {
    void run(async () => {
      const created = await api.donations.saveCampaign({
        ...data,
        targetAmount: Number(data.targetAmount || 0),
        minimumDonation: data.minimumDonation ? Number(data.minimumDonation) : undefined,
        maximumDonation: data.maximumDonation ? Number(data.maximumDonation) : undefined,
        targetDonors: data.targetDonors ? Number(data.targetDonors) : undefined,
        documents: documents.filter((item) => item.fileName.trim()),
        mode,
      })
      navigate(`/app/donations/campaigns/${created.id}`)
    })
  }

  return (
    <div className="form-wizard">
      <PageHeading kicker="Campaigns" title="Create campaign" lead="Proposal, budget, and approval documents are required before the campaign can be approved and published." icon="school" actions={<Link className="button secondary" to="/app/donations/campaigns">All campaigns</Link>} />
      {error && <Banner>{error}</Banner>}
      <FormSteps steps={CAMPAIGN_STEPS} step={steps.step} onPick={(index) => steps.move(form(), index > steps.step ? steps.step + 1 : index, CAMPAIGN_STEPS.length)} />
      <form id="campaign-form" key={steps.step} onSubmit={(event) => { event.preventDefault(); submit('save', steps.collect(event.currentTarget)) }}>
        {steps.step === 0 && (
          <FieldGroup title="Campaign information">
            <Field label="Campaign code" note="required"><input name="code" required defaultValue={saved.code ?? ''} placeholder="EDU-2026" /></Field>
            <Field label="Campaign name" note="required"><input name="name" required defaultValue={saved.name ?? ''} /></Field>
            <Field label="Campaign type" note="required">
              <select name="campaignType" defaultValue={saved.campaignType || CAMPAIGN_TYPES[0]}>{CAMPAIGN_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            </Field>
            <Field label="Purpose" note="required" span="full"><textarea name="purpose" required rows={3} defaultValue={saved.purpose ?? ''} /></Field>
            <Field label="Description" note="optional" span="full"><textarea name="description" rows={2} defaultValue={saved.description ?? ''} /></Field>
            <Field label="Target beneficiary" note="optional"><input name="targetBeneficiary" defaultValue={saved.targetBeneficiary ?? ''} /></Field>
            <Field label="Campaign manager" note="required"><input name="manager" required defaultValue={saved.manager ?? ''} /></Field>
            <Field label="Start date" note="required"><input name="startDate" type="date" required defaultValue={saved.startDate || today()} /></Field>
            <Field label="End date" note="required"><input name="endDate" type="date" required defaultValue={saved.endDate ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === 1 && (
          <FieldGroup title="Financial target">
            <Field label="Target amount" note="required"><input name="targetAmount" type="number" min="1" required defaultValue={saved.targetAmount ?? ''} /></Field>
            <Field label="Currency" note="required"><input name="currency" defaultValue={saved.currency || 'RWF'} maxLength={3} required /></Field>
            <Field label="Minimum donation" note="optional"><input name="minimumDonation" type="number" min="0" defaultValue={saved.minimumDonation ?? ''} /></Field>
            <Field label="Maximum donation" note="optional"><input name="maximumDonation" type="number" min="0" defaultValue={saved.maximumDonation ?? ''} /></Field>
            <Field label="Target number of donors" note="optional"><input name="targetDonors" type="number" min="1" defaultValue={saved.targetDonors ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === 2 && (
          <Panel icon="ledger" title="Campaign documents">
            <DocFields documents={documents} onChange={setDocuments} types={CAMPAIGN_DOCS} />
          </Panel>
        )}
        <StepNav
          step={steps.step}
          count={CAMPAIGN_STEPS.length}
          busy={busy}
          onBack={() => steps.move(form(), steps.step - 1, CAMPAIGN_STEPS.length)}
          onNext={() => steps.move(form(), steps.step + 1, CAMPAIGN_STEPS.length)}
          submitLabel={busy ? 'Saving…' : 'Save campaign'}
          extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft', steps.collect(form()))}>Save draft</button>}
        />
      </form>
    </div>
  )
}

export function CampaignFile() {
  usePageTitle('Campaign — UPSA Next Payment')
  const { campaignId = '' } = useParams()
  const { can } = useAuth()
  const campaign = useLoad(() => api.donations.campaign(campaignId), [campaignId])
  const donors = useLoad(() => api.donations.donors({ status: 'VERIFIED' }))
  const agreements = useLoad(() => api.donations.agreements())
  const { error, busy, run } = useAction()
  const agreementSteps = useFormSteps()
  const agreement = agreementSteps.values
  const [agreementDocs, setAgreementDocs] = useState<DonationDoc[]>([{ documentType: 'DONATION_AGREEMENT', fileName: '' }])
  const file = campaign.data
  const write = can('donation.write')

  function act(action: () => Promise<typeof file>) {
    void run(async () => {
      const saved = await action()
      if (saved) campaign.setData(saved)
    })
  }

  return (
    <>
      <PageHeading kicker="Campaign" title={file?.name ?? 'Campaign'} lead={file ? `${file.code} · ${file.completionPercent}% of target` : 'Loading the campaign.'} icon="school" actions={<Link className="button secondary" to="/app/donations/campaigns">All campaigns</Link>} />
      {(campaign.error || error) && <Banner>{campaign.error || error}</Banner>}
      {file && (
        <>
          <div className="app-stats">
            <Panel icon="pay" title="Performance">
              <dl className="app-dl">
                <div><dt>Status</dt><dd><StatusPill value={file.status} /></dd></div>
                <div><dt>Approval</dt><dd><StatusPill value={file.approvalStatus} /></dd></div>
                <div><dt>Target</dt><dd>{money(file.targetAmount, file.currency)}</dd></div>
                <div><dt>Raised</dt><dd>{money(file.amountRaised, file.currency)}</dd></div>
                <div><dt>Remaining</dt><dd>{money(file.amountRemaining, file.currency)}</dd></div>
                <div><dt>Donors</dt><dd>{file.donorCount}</dd></div>
                <div><dt>Allocated</dt><dd>{money(file.amountAllocated, file.currency)}</dd></div>
                <div><dt>Distributed</dt><dd>{money(file.amountDistributed, file.currency)}</dd></div>
              </dl>
            </Panel>
          </div>
          {write && (
            <Panel icon="shield" title="Campaign approval and status">
              <div className="app-inline-actions">
                <button className="button primary" type="button" disabled={busy} onClick={() => act(() => api.donations.decideCampaign(file.id, { decision: 'APPROVE' }))}>Approve</button>
                <button className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.decideCampaign(file.id, { decision: 'REJECT' }))}>Reject</button>
                {['PUBLISHED', 'ACTIVE', 'CLOSED', 'SUSPENDED', 'CANCELLED'].map((status) => (
                  <button key={status} className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.campaignStatus(file.id, status))}>{status.replaceAll('_', ' ')}</button>
                ))}
              </div>
              {file.approvedBy && <p className="app-note">Decision by {file.approvedBy}{file.approvalComments ? ` — ${file.approvalComments}` : ''}.</p>}
            </Panel>
          )}
          {write && (
            <Panel icon="ledger" title="Budget">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                act(() => api.donations.saveBudget(file.id, {
                  category: data.category,
                  approvedBudget: Number(data.approvedBudget),
                  currency: file.currency,
                  department: data.department,
                  approvalDate: data.approvalDate,
                }))
              }}>
                <Field label="Budget category" note="required">
                  <select name="category">{BUDGET_CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
                </Field>
                <Field label="Approved budget" note="required"><input name="approvedBudget" type="number" min="1" required /></Field>
                <Field label="Responsible department" note="optional"><input name="department" /></Field>
                <Field label="Approval date" note="optional"><input name="approvalDate" type="date" defaultValue={today()} /></Field>
                <button className="button primary" type="submit" disabled={busy}>Save budget line</button>
              </form>
              <Table columns={['Category', 'Approved', 'Used', 'Remaining']} empty="No budget lines yet." rows={file.budgets.map((row) => [row.category.replaceAll('_', ' '), money(row.approvedBudget, row.currency), money(row.amountUsed, row.currency), money(row.amountRemaining, row.currency)])} />
            </Panel>
          )}
          {write && (
            <Panel icon="report" title="Monitoring">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                act(() => api.donations.saveMonitoring(file.id, {
                  reportingPeriod: data.reportingPeriod,
                  activitiesCompleted: data.activitiesCompleted,
                  beneficiariesReached: Number(data.beneficiariesReached),
                  issues: data.issues,
                  correctiveActions: data.correctiveActions,
                }))
              }}>
                <Field label="Reporting period" note="required"><input name="reportingPeriod" required placeholder="2026 Q1" /></Field>
                <Field label="Beneficiaries reached" note="required"><input name="beneficiariesReached" type="number" min="0" required /></Field>
                <Field label="Activities completed" note="required" span="full"><textarea name="activitiesCompleted" required rows={2} /></Field>
                <Field label="Issues" note="optional"><textarea name="issues" rows={2} /></Field>
                <Field label="Corrective actions" note="optional"><textarea name="correctiveActions" rows={2} /></Field>
                <button className="button primary" type="submit" disabled={busy}>Record monitoring</button>
              </form>
            </Panel>
          )}
          <Panel icon="user" title="Donor agreement">
            {write && (
              <div className="form-wizard">
                <FormSteps steps={['Parties', 'Terms', 'Documents']} step={agreementSteps.step} onPick={(index) => {
                  const node = document.getElementById('agreement-form') as HTMLFormElement
                  agreementSteps.move(node, index > agreementSteps.step ? agreementSteps.step + 1 : index, 3)
                }} />
                <form id="agreement-form" key={agreementSteps.step} onSubmit={(event) => {
                  event.preventDefault()
                  const data = agreementSteps.collect(event.currentTarget)
                  void run(async () => {
                    await api.donations.saveAgreement({
                      donorId: data.donorId,
                      campaignId: file.id,
                      amount: Number(data.amount),
                      currency: data.currency || file.currency,
                      purpose: data.purpose,
                      conditions: data.conditions,
                      startDate: data.startDate,
                      endDate: data.endDate,
                      reportingRequirements: data.reportingRequirements,
                      donorRepresentative: data.donorRepresentative,
                      rupsaRepresentative: data.rupsaRepresentative,
                      accept: data.accept === 'on',
                      documents: agreementDocs.filter((item) => item.fileName.trim()),
                    })
                    agreementSteps.reset()
                    setAgreementDocs([{ documentType: 'DONATION_AGREEMENT', fileName: '' }])
                    agreements.reload()
                  })
                }}>
                  {agreementSteps.step === 0 && (
                    <FieldGroup title="Parties">
                      <Field label="Verified donor" note="required">
                        <select name="donorId" required defaultValue={agreement.donorId ?? ''}>
                          <option value="">Select a donor</option>
                          {(donors.data?.items ?? []).map((donor) => <option key={donor.id} value={donor.id}>{donor.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Agreed amount" note="required"><input name="amount" type="number" min="1" required defaultValue={agreement.amount ?? ''} /></Field>
                      <Field label="Currency" note="required"><input name="currency" defaultValue={agreement.currency || file.currency} maxLength={3} required /></Field>
                      <Field label="Start date" note="required"><input name="startDate" type="date" required defaultValue={agreement.startDate || today()} /></Field>
                      <Field label="End date" note="required"><input name="endDate" type="date" required defaultValue={agreement.endDate ?? ''} /></Field>
                    </FieldGroup>
                  )}
                  {agreementSteps.step === 1 && (
                    <FieldGroup title="Terms">
                      <Field label="Purpose" note="required" span="full"><textarea name="purpose" required rows={2} defaultValue={agreement.purpose ?? ''} /></Field>
                      <Field label="Conditions" note="required" span="full"><textarea name="conditions" required rows={2} defaultValue={agreement.conditions ?? ''} /></Field>
                      <Field label="Reporting requirements" note="optional" span="full"><textarea name="reportingRequirements" rows={2} defaultValue={agreement.reportingRequirements ?? ''} /></Field>
                      <Field label="Donor representative" note="optional"><input name="donorRepresentative" defaultValue={agreement.donorRepresentative ?? ''} /></Field>
                      <Field label="UPSA representative" note="optional"><input name="rupsaRepresentative" defaultValue={agreement.rupsaRepresentative ?? ''} /></Field>
                    </FieldGroup>
                  )}
                  {agreementSteps.step === 2 && (
                    <>
                      <DocFields documents={agreementDocs} onChange={setAgreementDocs} types={['DONATION_AGREEMENT', 'TERMS', 'DONOR_REQUIREMENTS', 'OTHER']} />
                      <label className="app-check">
                        <input name="accept" type="checkbox" defaultChecked={agreement.accept === 'on'} />
                        <span>Both representatives accept this agreement</span>
                      </label>
                    </>
                  )}
                  <StepNav
                    step={agreementSteps.step}
                    count={3}
                    busy={busy}
                    onBack={() => agreementSteps.move(document.getElementById('agreement-form') as HTMLFormElement, agreementSteps.step - 1, 3)}
                    onNext={() => agreementSteps.move(document.getElementById('agreement-form') as HTMLFormElement, agreementSteps.step + 1, 3)}
                    submitLabel={busy ? 'Saving…' : 'Save agreement'}
                  />
                </form>
              </div>
            )}
            <Table
              columns={['Agreement', 'Donor', 'Amount', 'Period', 'Status']}
              empty="No agreements for this campaign."
              rows={(agreements.data?.items ?? []).filter((row) => row.campaign === file.name).map((row) => [
                row.id,
                row.donor,
                money(row.amount, row.currency),
                `${row.startDate ?? '—'} – ${row.endDate ?? '—'}`,
                <StatusPill key={row.id} value={row.status} />,
              ])}
            />
          </Panel>
        </>
      )}
    </>
  )
}
