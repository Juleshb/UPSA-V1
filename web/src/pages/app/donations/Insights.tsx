import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api, openProtectedFile } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money, shortDate } from '../../../platform/format'
import { Banner, Field, FieldGroup, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { CHANNELS, DONATION_TYPES, MESSAGE_TYPES, REPORTS, today } from './catalog'
import { DocFields, FormSteps, StepNav, useAction, useFormSteps } from './kit'

const DONATION_STATUSES = ['DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'PAYMENT_PENDING', 'RECEIVED', 'APPROVED', 'ALLOCATED', 'DISTRIBUTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED', 'REFUNDED', 'UNDER_REVIEW']

export function ReceiptBoard() {
  usePageTitle('Receipts — UPSA Next Payment')
  const receipts = useLoad(() => api.donations.receipts())
  return (
    <>
      <PageHeading kicker="Receipts" title="Donation receipts" lead="A receipt is issued when a monetary payment is matched or an in-kind gift is received." icon="report" />
      {receipts.error && <Banner>{receipts.error}</Banner>}
      <Panel icon="report" title="Issued receipts">
        <Table
          columns={['Receipt', 'Donor', 'Campaign', 'Amount', 'Method', '']}
          empty="No receipts yet."
          rows={(receipts.data?.items ?? []).map((item) => [
            item.id,
            item.donorName,
            item.campaign ?? '—',
            money(item.amount, item.currency),
            item.paymentMethod ?? '—',
            <button key={`${item.id}-pdf`} className="button secondary" type="button" onClick={() => void openProtectedFile(`/donations/${item.donationId}/receipt.pdf`)}>PDF</button>,
          ])}
        />
      </Panel>
    </>
  )
}

export function PaymentBoard() {
  usePageTitle('Donation payments — UPSA Next Payment')
  const payments = useLoad(() => api.donations.payments())
  return (
    <>
      <PageHeading kicker="Payments" title="Donation payment requests" lead="Bank, card, and mobile gifts are routed on an approved rail. Cash is recorded at the desk. A gift is received only when the amounts match." icon="pay" />
      {payments.error && <Banner>{payments.error}</Banner>}
      <Panel icon="pay" title="Payments">
        <Table
          columns={['Payment', 'Donation', 'Donor', 'Method', 'Amount', 'Status', 'Reconciliation']}
          empty="No donation payments yet."
          rows={(payments.data?.items ?? []).map((item) => [
            item.id,
            <Link key={item.donationId} to={`/app/donations/gifts/${item.donationId}`}>{item.donationId}</Link>,
            item.donor,
            item.paymentMethod.replaceAll('_', ' '),
            money(item.amount, item.currency),
            <StatusPill key={`${item.id}-status`} value={item.status} />,
            item.reconciliationStatus,
          ])}
        />
      </Panel>
    </>
  )
}

export function ImpactBoard() {
  usePageTitle('Impact — UPSA Next Payment')
  const { can } = useAuth()
  const impacts = useLoad(() => api.donations.impacts())
  const campaigns = useLoad(() => api.donations.campaigns())
  const beneficiaries = useLoad(() => api.donations.beneficiaries({ status: 'VERIFIED' }))
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const [evidence, setEvidence] = useState<DonationDoc[]>([{ documentType: 'REPORT', fileName: '' }])
  const impactSteps = ['Subject', 'Results', 'Evidence']
  return (
    <>
      <PageHeading kicker="Impact" title="What the donations achieved" lead="Close a distributed donation only after an impact report records the activities, outputs, and outcomes." icon="report" />
      {(error || impacts.error) && <Banner>{error || impacts.error}</Banner>}
      {can('donation.write') && (
        <Panel icon="report" title="Impact report">
          <div className="form-wizard">
            <FormSteps steps={impactSteps} step={steps.step} onPick={(index) => {
              const node = document.getElementById('impact-form') as HTMLFormElement
              steps.move(node, index > steps.step ? steps.step + 1 : index, impactSteps.length)
            }} />
            <form id="impact-form" key={steps.step} onSubmit={(event) => {
              event.preventDefault()
              const data = steps.collect(event.currentTarget)
              void run(async () => {
                await api.donations.saveImpact({
                  campaignId: data.campaignId || undefined,
                  donationId: data.donationId || undefined,
                  beneficiaryId: data.beneficiaryId || undefined,
                  reportingPeriod: data.reportingPeriod,
                  amountUsed: Number(data.amountUsed),
                  currency: data.currency,
                  beneficiaryCount: Number(data.beneficiaryCount),
                  activities: data.activities,
                  outputs: data.outputs,
                  outcomes: data.outcomes,
                  challenges: data.challenges,
                  evidence: evidence.filter((item) => item.fileName.trim()),
                })
                impacts.reload()
                steps.reset()
                setEvidence([{ documentType: 'REPORT', fileName: '' }])
              })
            }}>
              {steps.step === 0 && (
                <FieldGroup title="Subject">
                  <Field label="Campaign" note="optional">
                    <select name="campaignId" defaultValue={saved.campaignId ?? ''}>
                      <option value="">Select</option>
                      {(campaigns.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Donation ID" note="optional"><input name="donationId" placeholder="RUPSA-DON-000001" defaultValue={saved.donationId ?? ''} /></Field>
                  <Field label="Beneficiary" note="optional">
                    <select name="beneficiaryId" defaultValue={saved.beneficiaryId ?? ''}>
                      <option value="">Select</option>
                      {(beneficiaries.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Reporting period" note="required"><input name="reportingPeriod" required defaultValue={saved.reportingPeriod || today().slice(0, 7)} /></Field>
                </FieldGroup>
              )}
              {steps.step === 1 && (
                <FieldGroup title="Results">
                  <Field label="Amount used" note="required"><input name="amountUsed" type="number" min="0" required defaultValue={saved.amountUsed ?? ''} /></Field>
                  <Field label="Currency" note="required"><input name="currency" defaultValue={saved.currency || 'RWF'} maxLength={3} required /></Field>
                  <Field label="Beneficiaries" note="required"><input name="beneficiaryCount" type="number" min="0" required defaultValue={saved.beneficiaryCount ?? ''} /></Field>
                  <Field label="Activities" note="required" span="full"><textarea name="activities" required rows={2} defaultValue={saved.activities ?? ''} /></Field>
                  <Field label="Outputs" note="required" span="full"><textarea name="outputs" required rows={2} defaultValue={saved.outputs ?? ''} /></Field>
                  <Field label="Outcomes" note="required" span="full"><textarea name="outcomes" required rows={2} defaultValue={saved.outcomes ?? ''} /></Field>
                  <Field label="Challenges" note="optional" span="full"><textarea name="challenges" rows={2} defaultValue={saved.challenges ?? ''} /></Field>
                </FieldGroup>
              )}
              {steps.step === 2 && (
                <DocFields documents={evidence} onChange={setEvidence} types={['REPORT', 'PHOTO', 'RECEIPT', 'BENEFICIARY_CONFIRMATION', 'OTHER']} />
              )}
              <StepNav
                step={steps.step}
                count={impactSteps.length}
                busy={busy}
                onBack={() => steps.move(document.getElementById('impact-form') as HTMLFormElement, steps.step - 1, impactSteps.length)}
                onNext={() => steps.move(document.getElementById('impact-form') as HTMLFormElement, steps.step + 1, impactSteps.length)}
                submitLabel={busy ? 'Saving…' : 'Save impact report'}
              />
            </form>
          </div>
        </Panel>
      )}
      <Panel icon="family" title="Reports">
        <Table
          columns={['Report', 'Campaign', 'Period', 'Beneficiaries', 'Outputs']}
          empty="No impact reports yet."
          rows={(impacts.data?.items ?? []).map((item) => [item.id, item.campaign, item.reportingPeriod, String(item.beneficiaryCount), item.outputs])}
        />
      </Panel>
    </>
  )
}

export function MessageBoard() {
  usePageTitle('Donation notifications — UPSA Next Payment')
  const { can } = useAuth()
  const messages = useLoad(() => api.donations.messages())
  const donors = useLoad(() => api.donations.donors())
  const campaigns = useLoad(() => api.donations.campaigns())
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const messageSteps = ['Recipient', 'Message']
  return (
    <>
      <PageHeading kicker="Notifications" title="Donor communication" lead="Thank-you notes, receipts, campaign updates, and payment reminders are queued on SMS, email, in-app, or push." icon="report" />
      {(error || messages.error) && <Banner>{error || messages.error}</Banner>}
      {can('donation.write') && (
        <Panel icon="user" title="Send a message">
          <div className="form-wizard">
            <FormSteps steps={messageSteps} step={steps.step} onPick={(index) => {
              const node = document.getElementById('message-form') as HTMLFormElement
              steps.move(node, index > steps.step ? steps.step + 1 : index, messageSteps.length)
            }} />
            <form id="message-form" key={steps.step} onSubmit={(event) => {
              event.preventDefault()
              const data = steps.collect(event.currentTarget)
              void run(async () => {
                await api.donations.sendMessage({
                  donorId: String(data.donorId),
                  donationId: String(data.donationId || '') || undefined,
                  campaignId: String(data.campaignId || '') || undefined,
                  communicationType: String(data.communicationType),
                  channel: String(data.channel),
                  subject: String(data.subject),
                  message: String(data.message),
                })
                messages.reload()
                steps.reset()
              })
            }}>
              {steps.step === 0 && (
                <FieldGroup title="Recipient">
                  <Field label="Donor" note="required">
                    <select name="donorId" required defaultValue={saved.donorId ?? ''}>
                      <option value="">Select</option>
                      {(donors.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Type" note="required">
                    <select name="communicationType" defaultValue={saved.communicationType || MESSAGE_TYPES[0]}>{MESSAGE_TYPES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
                  </Field>
                  <Field label="Channel" note="required">
                    <select name="channel" defaultValue={saved.channel || CHANNELS[0]}>{CHANNELS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
                  </Field>
                  <Field label="Donation ID" note="optional"><input name="donationId" placeholder="RUPSA-DON-000001" defaultValue={saved.donationId ?? ''} /></Field>
                  <Field label="Campaign" note="optional">
                    <select name="campaignId" defaultValue={saved.campaignId ?? ''}>
                      <option value="">Select</option>
                      {(campaigns.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                </FieldGroup>
              )}
              {steps.step === 1 && (
                <FieldGroup title="Message">
                  <Field label="Subject" note="required"><input name="subject" required defaultValue={saved.subject ?? ''} /></Field>
                  <Field label="Message" note="required" span="full"><textarea name="message" required rows={3} defaultValue={saved.message ?? ''} /></Field>
                </FieldGroup>
              )}
              <StepNav
                step={steps.step}
                count={messageSteps.length}
                busy={busy}
                onBack={() => steps.move(document.getElementById('message-form') as HTMLFormElement, steps.step - 1, messageSteps.length)}
                onNext={() => steps.move(document.getElementById('message-form') as HTMLFormElement, steps.step + 1, messageSteps.length)}
                submitLabel={busy ? 'Sending…' : 'Send'}
              />
            </form>
          </div>
        </Panel>
      )}
      <Panel icon="report" title="Sent and queued">
        <Table
          columns={['When', 'Donor', 'Type', 'Channel', 'Subject', 'Status']}
          empty="No donor messages yet."
          rows={(messages.data?.items ?? []).map((item) => [shortDate(item.sentAt), item.donor, item.type.replaceAll('_', ' '), item.channel, item.subject, item.status])}
        />
      </Panel>
    </>
  )
}

export function ReportBoard() {
  usePageTitle('Donation reports — UPSA Next Payment')
  const [type, setType] = useState('donor-register')
  const report = useLoad(() => api.donations.report(type), [type])
  const donors = useLoad(() => api.donations.donors())
  const campaigns = useLoad(() => api.donations.campaigns())
  const [filters, setFilters] = useState({ donorId: '', campaignId: '', from: '', to: '', donationType: '', status: '', currency: 'RWF' })
  const statement = useLoad(() => api.donations.statement({
    donorId: filters.donorId || undefined,
    campaignId: filters.campaignId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    donationType: filters.donationType || undefined,
    status: filters.status || undefined,
    currency: filters.currency || undefined,
  }), [filters])
  const items = report.data?.items ?? []
  const columns = items[0] ? Object.keys(items[0]) : []

  return (
    <>
      <PageHeading kicker="Reports" title="Donation reports and statements" lead="Donor, campaign, financial, beneficiary, and compliance reports use the same ledger as the donation file." icon="report" />
      {(report.error || statement.error) && <Banner>{report.error || statement.error}</Banner>}
      <Panel icon="report" title="Report">
        <Field label="Report">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {items.length === 0 ? <p className="app-empty">Nothing to show for this report yet.</p> : (
          <Table columns={columns} empty="" rows={items.map((item) => columns.map((column) => String(item[column] ?? '—')))} />
        )}
      </Panel>
      <Panel icon="ledger" title="Statement">
        <form className="app-form" onSubmit={(event) => {
          event.preventDefault()
          const data = Object.fromEntries(new FormData(event.currentTarget).entries())
          setFilters({
            donorId: String(data.donorId || ''),
            campaignId: String(data.campaignId || ''),
            from: String(data.from || ''),
            to: String(data.to || ''),
            donationType: String(data.donationType || ''),
            status: String(data.status || ''),
            currency: String(data.currency || 'RWF'),
          })
        }}>
          <Field label="Donor">
            <select name="donorId" defaultValue={filters.donorId}>
              <option value="">All donors</option>
              {(donors.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Campaign">
            <select name="campaignId" defaultValue={filters.campaignId}>
              <option value="">All campaigns</option>
              {(campaigns.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Date from"><input name="from" type="date" defaultValue={filters.from} /></Field>
          <Field label="Date to"><input name="to" type="date" defaultValue={filters.to} /></Field>
          <Field label="Donation type">
            <select name="donationType" defaultValue={filters.donationType}>
              <option value="">All types</option>
              {DONATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {DONATION_STATUSES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Currency"><input name="currency" defaultValue={filters.currency} maxLength={3} /></Field>
          <button className="button secondary" type="submit">Apply filters</button>
        </form>
        {statement.data && (
          <dl className="app-dl">
            <div><dt>Opening balance</dt><dd>{money(statement.data.openingBalance)}</dd></div>
            <div><dt>Donations received</dt><dd>{money(statement.data.donationsReceived)}</dd></div>
            <div><dt>Adjustments</dt><dd>{money(statement.data.adjustments)}</dd></div>
            <div><dt>Refunds</dt><dd>{money(statement.data.refunds)}</dd></div>
            <div><dt>Net donations</dt><dd>{money(statement.data.netDonations)}</dd></div>
          </dl>
        )}
        <Table
          columns={['Date', 'Donation', 'Description', 'Amount', 'Currency', 'Payment reference', 'Status']}
          empty="No ledger lines in this period."
          rows={(statement.data?.lines ?? []).map((line) => [shortDate(line.date), line.donationId, line.description, money(line.amount, line.currency), line.currency, line.paymentReference ?? '—', line.status])}
        />
      </Panel>
    </>
  )
}

export function AuditBoard() {
  usePageTitle('Donation audit — UPSA Next Payment')
  const audit = useLoad(() => api.donations.audit())
  return (
    <>
      <PageHeading kicker="Audit" title="Donation audit log" lead="Every registration, verification, payment, allocation, refund, and adjustment is stored with the officer, previous status, new status, amount, and session." icon="shield" />
      {audit.error && <Banner>{audit.error}</Banner>}
      <Panel icon="shield" title="Audit log">
        <Table
          columns={['When', 'Action', 'Donation', 'From', 'To', 'Amount', 'Officer', 'Reason', 'Reference', 'IP', 'Session']}
          empty="No donation audit events yet."
          rows={(audit.data?.items ?? []).map((item) => [
            item.createdAt.slice(0, 16).replace('T', ' '),
            item.action,
            item.donationId ?? '—',
            item.previousStatus ?? '—',
            item.newStatus ?? '—',
            item.amount == null ? '—' : String(item.amount),
            item.userId ?? '—',
            item.reason ?? '—',
            item.reference ?? '—',
            item.ip ?? '—',
            item.sessionId ?? '—',
          ])}
        />
      </Panel>
    </>
  )
}
