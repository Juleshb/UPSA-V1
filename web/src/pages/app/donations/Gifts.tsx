import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api, openProtectedFile } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, FieldGroup, PageHeading, Panel, SearchField, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { CONDITIONS, DONATION_TYPES, FREQUENCIES, IN_KIND_CATEGORIES, VALUATION_METHODS, today } from './catalog'
import { Check, DocFields, FormSteps, StepNav, useAction, useFormSteps } from './kit'

export function PledgeBoard() {
  usePageTitle('Pledges — UPSA Next Payment')
  const { can } = useAuth()
  const pledges = useLoad(() => api.donations.pledges())
  const donors = useLoad(() => api.donations.donors({ status: 'VERIFIED' }))
  const campaigns = useLoad(() => api.donations.campaigns({ status: 'ACTIVE' }))
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const pledgeSteps = ['Parties', 'Schedule']

  return (
    <>
      <PageHeading kicker="Pledges" title="Commitments before payment" lead="A pledge can be recorded only for a verified donor and an open campaign. It moves to fulfilled as donations are received against it." icon="loan" />
      {(error || pledges.error) && <Banner>{error || pledges.error}</Banner>}
      {can('donation.write') && (
        <Panel icon="loan" title="Record pledge">
          <div className="form-wizard">
            <FormSteps steps={pledgeSteps} step={steps.step} onPick={(index) => {
              const node = document.getElementById('pledge-form') as HTMLFormElement
              steps.move(node, index > steps.step ? steps.step + 1 : index, pledgeSteps.length)
            }} />
            <form id="pledge-form" key={steps.step} onSubmit={(event) => {
              event.preventDefault()
              const data = steps.collect(event.currentTarget)
              void run(async () => {
                await api.donations.savePledge({ ...data, amount: Number(data.amount) })
                pledges.reload()
                steps.reset()
              })
            }}>
              {steps.step === 0 && (
                <FieldGroup title="Parties">
                  <Field label="Donor" note="required">
                    <select name="donorId" required defaultValue={saved.donorId ?? ''}>
                      <option value="">Select a verified donor</option>
                      {(donors.data?.items ?? []).map((donor) => <option key={donor.id} value={donor.id}>{donor.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Campaign" note="required">
                    <select name="campaignId" required defaultValue={saved.campaignId ?? ''}>
                      <option value="">Select an open campaign</option>
                      {(campaigns.data?.items ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                    </select>
                  </Field>
                </FieldGroup>
              )}
              {steps.step === 1 && (
                <FieldGroup title="Schedule">
                  <Field label="Pledged amount" note="required"><input name="amount" type="number" min="1" required defaultValue={saved.amount ?? ''} /></Field>
                  <Field label="Currency" note="required"><input name="currency" defaultValue={saved.currency || 'RWF'} maxLength={3} /></Field>
                  <Field label="Pledge date" note="required"><input name="pledgeDate" type="date" required defaultValue={saved.pledgeDate || today()} /></Field>
                  <Field label="Expected payment date" note="optional"><input name="expectedPaymentDate" type="date" defaultValue={saved.expectedPaymentDate ?? ''} /></Field>
                  <Field label="Payment frequency" note="required">
                    <select name="frequency" defaultValue={saved.frequency || 'ONE_TIME'}>{FREQUENCIES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
                  </Field>
                  <Field label="Purpose" note="optional"><input name="purpose" defaultValue={saved.purpose ?? ''} /></Field>
                  <Field label="Notes" note="optional" span="full"><textarea name="notes" rows={2} defaultValue={saved.notes ?? ''} /></Field>
                </FieldGroup>
              )}
              <StepNav
                step={steps.step}
                count={pledgeSteps.length}
                busy={busy}
                onBack={() => steps.move(document.getElementById('pledge-form') as HTMLFormElement, steps.step - 1, pledgeSteps.length)}
                onNext={() => steps.move(document.getElementById('pledge-form') as HTMLFormElement, steps.step + 1, pledgeSteps.length)}
                submitLabel={busy ? 'Recording…' : 'Record pledge'}
              />
            </form>
          </div>
        </Panel>
      )}
      <Panel icon="ledger" title="Pledges">
        <Table
          columns={['Pledge', 'Donor', 'Campaign', 'Amount', 'Fulfilled', 'Frequency', 'Status']}
          empty="No pledges yet."
          rows={(pledges.data?.items ?? []).map((item) => [
            item.id,
            item.donor,
            item.campaign,
            money(item.amount, item.currency),
            money(item.fulfilled, item.currency),
            item.frequency.replaceAll('_', ' '),
            <StatusPill key={item.id} value={item.status} />,
          ])}
        />
      </Panel>
    </>
  )
}

export function GiftList() {
  usePageTitle('Donations — UPSA Next Payment')
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const queue = params.get('queue') ?? ''
  const donationType = params.get('type') ?? ''
  const gifts = useLoad(() => api.donations.gifts({ q: query || undefined, queue: queue || undefined, donationType: donationType || undefined }), [query, queue, donationType])

  return (
    <>
      <PageHeading kicker="Donations" title="Donation register" lead="Cash and in-kind gifts follow the same file: submit, verify, receive through the payment service or valuation, approve, then allocate." icon="pay" actions={<Link className="button primary" to="/app/donations/gifts/new">New donation</Link>} />
      {gifts.error && <Banner>{gifts.error}</Banner>}
      <div className="app-inline-actions">
        <Link to="/app/donations/gifts">All</Link>
        <Link to="/app/donations/gifts?type=MONETARY">Cash and transfers</Link>
        <Link to="/app/donations/gifts?type=IN_KIND">In-kind</Link>
        <Link to="/app/donations/gifts?queue=verification">Verification</Link>
        <Link to="/app/donations/gifts?queue=approval">Approval</Link>
      </div>
      <Panel icon="search" title="Donations">
        <SearchField value={query} onChange={setQuery} placeholder="Donor, reference, campaign…" />
        {gifts.loading ? <p className="app-empty">Loading donations…</p> : (
          <Table
            columns={['Reference', 'Donor', 'Campaign', 'Type', 'Amount', 'Status']}
            empty="No donations match that view."
            rows={(gifts.data?.items ?? []).map((item) => [
              <Link key={item.id} to={`/app/donations/gifts/${item.id}`}>{item.reference}</Link>,
              item.donor,
              item.campaign,
              item.donationType.replaceAll('_', ' '),
              money(item.amount, item.currency),
              <StatusPill key={`${item.id}-status`} value={item.status} />,
            ])}
          />
        )}
      </Panel>
    </>
  )
}

export function GiftForm() {
  usePageTitle('New donation — UPSA Next Payment')
  const navigate = useNavigate()
  const { error, busy, run } = useAction()
  const donors = useLoad(() => api.donations.donors({ status: 'VERIFIED' }))
  const campaigns = useLoad(() => api.donations.campaigns({ status: 'ACTIVE' }))
  const beneficiaries = useLoad(() => api.donations.beneficiaries({ status: 'VERIFIED' }))
  const pledges = useLoad(() => api.donations.pledges({ status: 'PLEDGED' }))
  const steps = useFormSteps()
  const saved = steps.values
  const [donationType, setDonationType] = useState('CASH')
  const [documents, setDocuments] = useState<DonationDoc[]>([{ documentType: 'SUPPORT', fileName: '' }])
  const inKind = donationType === 'IN_KIND'
  const giftSteps = inKind ? ['Donation', 'In-kind', 'Documents'] : ['Donation', 'Documents']

  function form() {
    return document.getElementById('gift-form') as HTMLFormElement
  }

  function submit(mode: 'draft' | 'submit', data: Record<string, string>) {
    void run(async () => {
      const created = await api.donations.saveGift({
        donorId: data.donorId,
        campaignId: data.campaignId || undefined,
        pledgeId: data.pledgeId || undefined,
        beneficiaryId: data.beneficiaryId || undefined,
        donationType,
        donationDate: data.donationDate,
        amount: data.amount ? Number(data.amount) : undefined,
        currency: data.currency,
        purpose: data.purpose,
        documents: documents.filter((item) => item.fileName.trim()),
        mode,
        inKind: inKind ? {
          category: data.category,
          description: data.description,
          quantity: Number(data.quantity || 0),
          unit: data.unit,
          estimatedValue: Number(data.estimatedValue || 0),
          condition: data.condition,
          dateReceived: data.dateReceived,
          storageLocation: data.storageLocation,
          intendedBeneficiary: data.intendedBeneficiary,
        } : undefined,
      })
      navigate(`/app/donations/gifts/${created.id}`)
    })
  }

  return (
    <div className="form-wizard">
      <PageHeading kicker="Donations" title="Record a donation" lead="Submit the gift for verification. Monetary gifts are then sent to the payment service. In-kind gifts need a valuation before they can be received." icon="pay" actions={<Link className="button secondary" to="/app/donations/gifts">All donations</Link>} />
      {error && <Banner>{error}</Banner>}
      <FormSteps steps={giftSteps} step={steps.step} onPick={(index) => steps.move(form(), index > steps.step ? steps.step + 1 : index, giftSteps.length)} />
      <form id="gift-form" key={steps.step} onSubmit={(event) => { event.preventDefault(); submit('submit', steps.collect(event.currentTarget)) }}>
        {steps.step === 0 && (
          <FieldGroup title="Donation information">
            <Field label="Donation ID" note="automatic"><input value="Assigned on save" disabled /></Field>
            <Field label="Donor" note="required">
              <select name="donorId" required defaultValue={saved.donorId ?? ''}>
                <option value="">Verified donor</option>
                {(donors.data?.items ?? []).map((donor) => <option key={donor.id} value={donor.id}>{donor.name}</option>)}
              </select>
            </Field>
            <Field label="Campaign" note="required">
              <select name="campaignId" required defaultValue={saved.campaignId ?? ''}>
                <option value="">Open campaign</option>
                {(campaigns.data?.items ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </Field>
            <Field label="Pledge" note="optional">
              <select name="pledgeId" defaultValue={saved.pledgeId ?? ''}>
                <option value="">No pledge</option>
                {(pledges.data?.items ?? []).map((pledge) => <option key={pledge.id} value={pledge.id}>{pledge.donor} · {pledge.campaign}</option>)}
              </select>
            </Field>
            <Field label="Donation type" note="required">
              <select value={donationType} onChange={(event) => setDonationType(event.target.value)}>
                {DONATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Donation date" note="required"><input name="donationDate" type="date" required defaultValue={saved.donationDate || today()} /></Field>
            {!inKind && <Field label="Amount" note="required"><input name="amount" type="number" min="1" required defaultValue={saved.amount ?? ''} /></Field>}
            <Field label="Currency" note="required"><input name="currency" defaultValue={saved.currency || 'RWF'} maxLength={3} required /></Field>
            <Field label="Purpose" note="optional" span="full"><input name="purpose" defaultValue={saved.purpose ?? ''} /></Field>
            <Field label="Designated beneficiary" note="optional">
              <select name="beneficiaryId" defaultValue={saved.beneficiaryId ?? ''}>
                <option value="">None yet</option>
                {(beneficiaries.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
          </FieldGroup>
        )}
        {inKind && steps.step === 1 && (
          <FieldGroup title="In-kind donation">
            <Field label="Category" note="required">
              <select name="category" defaultValue={saved.category || IN_KIND_CATEGORIES[0]}>{IN_KIND_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            </Field>
            <Field label="Description" note="required"><input name="description" required defaultValue={saved.description ?? ''} /></Field>
            <Field label="Quantity" note="required"><input name="quantity" type="number" min="1" required defaultValue={saved.quantity ?? ''} /></Field>
            <Field label="Unit" note="required"><input name="unit" required defaultValue={saved.unit ?? ''} placeholder="pieces, sets, days" /></Field>
            <Field label="Estimated value" note="required"><input name="estimatedValue" type="number" min="1" required defaultValue={saved.estimatedValue ?? ''} /></Field>
            <Field label="Condition" note="required">
              <select name="condition" defaultValue={saved.condition || CONDITIONS[0]}>{CONDITIONS.map((item) => <option key={item}>{item}</option>)}</select>
            </Field>
            <Field label="Date received" note="required"><input name="dateReceived" type="date" required defaultValue={saved.dateReceived || today()} /></Field>
            <Field label="Storage location" note="required"><input name="storageLocation" required defaultValue={saved.storageLocation ?? ''} /></Field>
            <Field label="Intended beneficiary" note="optional"><input name="intendedBeneficiary" defaultValue={saved.intendedBeneficiary ?? ''} /></Field>
          </FieldGroup>
        )}
        {steps.step === giftSteps.length - 1 && (
          <Panel icon="ledger" title="Supporting documents">
            <DocFields documents={documents} onChange={setDocuments} types={['SUPPORT', 'DELIVERY_NOTE', 'VALUATION', 'DONOR_DECLARATION', 'PHOTO', 'OTHER']} />
          </Panel>
        )}
        <StepNav
          step={steps.step}
          count={giftSteps.length}
          busy={busy}
          onBack={() => steps.move(form(), steps.step - 1, giftSteps.length)}
          onNext={() => steps.move(form(), steps.step + 1, giftSteps.length)}
          submitLabel={busy ? 'Submitting…' : 'Submit donation'}
          extra={<button className="button secondary" type="button" disabled={busy} onClick={() => submit('draft', steps.collect(form()))}>Save draft</button>}
        />
      </form>
    </div>
  )
}

export function GiftFile() {
  usePageTitle('Donation file — UPSA Next Payment')
  const { giftId = '' } = useParams()
  const { can } = useAuth()
  const gift = useLoad(() => api.donations.gift(giftId), [giftId])
  const { error, busy, run } = useAction()
  const file = gift.data
  const write = can('donation.write')
  const [refundDocuments, setRefundDocuments] = useState<DonationDoc[]>([{ documentType: 'SUPPORT', fileName: '' }])
  const [unitPreview, setUnitPreview] = useState('')
  const [receivedPreview, setReceivedPreview] = useState<Record<string, string>>({})
  const [checks, setChecks] = useState({
    donorVerified: false,
    amountVerified: false,
    paymentVerified: false,
    campaignVerified: false,
    purposeVerified: false,
    documentsVerified: false,
    beneficiaryVerified: false,
  })

  function act(action: () => Promise<NonNullable<typeof file>>) {
    void run(async () => {
      gift.setData(await action())
    })
  }

  return (
    <>
      <PageHeading
        kicker="Donation file"
        title={file ? `${file.donorName}` : 'Donation'}
        lead={file ? `${file.reference} · ${file.donationType.replaceAll('_', ' ')} · ${money(file.amount, file.currency)}` : 'Loading the donation.'}
        icon="pay"
        actions={<Link className="button secondary" to="/app/donations/gifts">All donations</Link>}
      />
      {(gift.error || error) && <Banner>{gift.error || error}</Banner>}
      {file && (
        <>
          <Panel icon="pay" title="Donation" action={<StatusPill value={file.status} />}>
            <dl className="app-dl">
              <div><dt>Donor</dt><dd><Link to={`/app/donations/donors/${file.donorId}`}>{file.donorName}</Link></dd></div>
              <div><dt>Campaign</dt><dd>{file.campaignName ?? '—'}</dd></div>
              <div><dt>Purpose</dt><dd>{file.purpose || '—'}</dd></div>
              <div><dt>Beneficiary</dt><dd>{file.beneficiaryName ?? '—'}</dd></div>
              <div><dt>Unallocated balance</dt><dd>{money(file.availableBalance, file.currency)}</dd></div>
              {file.approvedAmount != null && <div><dt>Approved amount</dt><dd>{money(file.approvedAmount, file.currency)}</dd></div>}
            </dl>
            {write && ['DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'PAYMENT_PENDING', 'FAILED'].includes(file.status) && (
              <button className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.cancelGift(file.id, 'Cancelled from the donation file'))}>Cancel donation</button>
            )}
            {write && file.status === 'UNDER_REVIEW' && (
              <button className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.releaseGift(file.id))}>Release hold</button>
            )}
          </Panel>

          {file.inKind && (
            <Panel icon="ledger" title="In-kind valuation">
              <p className="app-note">{file.inKind.category} · {file.inKind.quantity} {file.inKind.unit} · {file.inKind.condition} · stored at {file.inKind.storageLocation || '—'}</p>
              {write && (
                <form className="app-form" onSubmit={(event) => {
                  event.preventDefault()
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                  act(() => api.donations.saveValuation(file.id, { ...data, unitValue: Number(data.unitValue) }))
                }}>
                  <Field label="Item" note="automatic"><input value={file.inKind.description} disabled /></Field>
                  <Field label="Quantity" note="automatic"><input value={`${file.inKind.quantity} ${file.inKind.unit}`} disabled /></Field>
                  <Field label="Valuation method" note="required">
                    <select name="valuationMethod">{VALUATION_METHODS.map((item) => <option key={item}>{item}</option>)}</select>
                  </Field>
                  <Field label="Valuer" note="optional"><input name="valuer" /></Field>
                  <Field label="Valuation date" note="required"><input name="valuationDate" type="date" required defaultValue={today()} /></Field>
                  <Field label="Estimated unit value" note="required"><input name="unitValue" type="number" min="1" required defaultValue={file.inKind.unitValue ?? ''} onChange={(event) => setUnitPreview(event.target.value)} /></Field>
                  <Field label="Total estimated value" note="automatic"><input value={String((Number(unitPreview || file.inKind.unitValue || 0)) * Number(file.inKind.quantity))} disabled /></Field>
                  <Field label="Valued by" note="required"><input name="valuedBy" required /></Field>
                  <Field label="Reviewed by" note="required"><input name="reviewedBy" required /></Field>
                  <Field label="Approved by" note="required"><input name="approvedBy" required /></Field>
                  <Field label="Supporting evidence" note="optional" span="full"><input name="evidence" /></Field>
                  <button className="button primary" type="submit" disabled={busy}>Save valuation</button>
                </form>
              )}
              {write && file.status === 'VERIFIED' && (
                <button className="button primary" type="button" disabled={busy} onClick={() => act(() => api.donations.receiveGift(file.id))}>Receive in-kind donation</button>
              )}
            </Panel>
          )}

          {write && ['SUBMITTED', 'PENDING_VERIFICATION', 'UNDER_REVIEW', 'VERIFIED'].includes(file.status) && (
            <Panel icon="shield" title="Verification">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                act(() => api.donations.verifyGift(file.id, { ...checks, result: data.result, comments: data.comments }))
              }}>
                <Check label="Donor verified" checked={checks.donorVerified} onChange={(donorVerified) => setChecks({ ...checks, donorVerified })} />
                <Check label="Donation amount verified" checked={checks.amountVerified} onChange={(amountVerified) => setChecks({ ...checks, amountVerified })} />
                <Check label="Payment verified" checked={checks.paymentVerified} onChange={(paymentVerified) => setChecks({ ...checks, paymentVerified })} />
                <Check label="Campaign verified" checked={checks.campaignVerified} onChange={(campaignVerified) => setChecks({ ...checks, campaignVerified })} />
                <Check label="Purpose verified" checked={checks.purposeVerified} onChange={(purposeVerified) => setChecks({ ...checks, purposeVerified })} />
                <Check label="Supporting documents verified" checked={checks.documentsVerified} onChange={(documentsVerified) => setChecks({ ...checks, documentsVerified })} />
                <Check label="Beneficiary verified" checked={checks.beneficiaryVerified} onChange={(beneficiaryVerified) => setChecks({ ...checks, beneficiaryVerified })} />
                <Field label="Result" note="required">
                  <select name="result" defaultValue="VERIFIED">
                    {['VERIFIED', 'PENDING', 'MORE_INFORMATION_REQUIRED', 'REJECTED'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Verification comment" note="optional" span="full"><textarea name="comments" rows={2} /></Field>
                <button className="button primary" type="submit" disabled={busy}>Save verification</button>
              </form>
            </Panel>
          )}

          {file.donationType !== 'IN_KIND' && (
            <Panel icon="pay" title="Payment service">
              {write && ['VERIFIED', 'FAILED'].includes(file.status) && (
                <form className="app-form" onSubmit={(event) => {
                  event.preventDefault()
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                  act(() => api.donations.payGift(file.id, data))
                }}>
                  <Field label="Amount" note="automatic"><input value={String(file.amount)} disabled /></Field>
                  <Field label="Currency" note="automatic"><input value={file.currency} disabled /></Field>
                  <Field label="Payment method" note="required">
                    <select name="paymentMethod" defaultValue={file.donationType === 'OTHER' ? 'CASH' : file.donationType}>
                      {(file.donationType === 'OTHER' ? ['CASH', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'OTHER'] : [file.donationType]).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Payer name" note="optional"><input name="payerName" defaultValue={file.donorName} /></Field>
                  <Field label="Payer phone" note="optional"><input name="payerPhone" /></Field>
                  <button className="button primary" type="submit" disabled={busy}>Process payment</button>
                </form>
              )}
              <Table
                columns={['Payment', 'Method', 'Rail', 'Status', 'Reconciliation']}
                empty="No payment request yet."
                rows={file.payments.map((payment) => [payment.id, payment.paymentMethod.replaceAll('_', ' '), payment.railName ?? 'Desk', <StatusPill key={payment.id} value={payment.status} />, payment.reconciliationStatus])}
              />
              {write && file.payments.filter((payment) => payment.status === 'INITIATED' || payment.status === 'PENDING').map((payment) => (
                <form key={payment.id} className="app-form" onSubmit={(event) => {
                  event.preventDefault()
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                  act(() => api.donations.confirmGift(file.id, payment.id, {
                    outcome: data.outcome,
                    externalTransactionId: data.externalTransactionId,
                    transactionReference: data.transactionReference,
                    receivedAmount: Number(data.receivedAmount),
                    settlementReference: data.settlementReference,
                    settlementDate: data.settlementDate,
                  }))
                }}>
                  <Field label="Outcome" note="required">
                    <select name="outcome" defaultValue="SUCCESS"><option value="SUCCESS">Success</option><option value="FAILED">Failed</option></select>
                  </Field>
                  <Field label="External transaction ID" note="required"><input name="externalTransactionId" required /></Field>
                  <Field label="Transaction reference" note="optional"><input name="transactionReference" /></Field>
                  <Field label="Expected amount" note="automatic"><input value={`${payment.amount} ${payment.currency}`} disabled /></Field>
                  <Field label="Received amount" note="required"><input name="receivedAmount" type="number" min="0" required defaultValue={payment.amount} onChange={(event) => setReceivedPreview((current) => ({ ...current, [payment.id]: event.target.value }))} /></Field>
                  <Field label="Difference" note="automatic"><input value={String(Number(receivedPreview[payment.id] ?? payment.amount) - payment.amount)} disabled /></Field>
                  <Field label="Settlement reference" note="optional"><input name="settlementReference" /></Field>
                  <Field label="Settlement date" note="optional"><input name="settlementDate" type="date" defaultValue={today()} /></Field>
                  <button className="button primary" type="submit" disabled={busy}>Confirm payment</button>
                </form>
              ))}
            </Panel>
          )}

          {write && (file.status === 'RECEIVED' || (file.status === 'UNDER_REVIEW' && file.heldFromStatus === 'RECEIVED')) && (
            <Panel icon="shield" title="Approval">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                act(() => api.donations.decideGift(file.id, {
                  decision: data.decision,
                  approvedAmount: data.approvedAmount ? Number(data.approvedAmount) : undefined,
                  conditions: data.conditions,
                  comments: data.comments,
                }))
              }}>
                <Field label="Decision" note="required">
                  <select name="decision" defaultValue="APPROVE">
                    <option value="APPROVE">Approve</option>
                    <option value="REJECT">Reject</option>
                    <option value="MORE_INFORMATION">Request more information</option>
                    <option value="HOLD">Hold</option>
                  </select>
                </Field>
                <Field label="Approved amount" note="optional"><input name="approvedAmount" type="number" min="1" defaultValue={file.amount} /></Field>
                <Field label="Conditions" note="optional" span="full"><textarea name="conditions" rows={2} /></Field>
                <Field label="Comments" note="optional" span="full"><textarea name="comments" rows={2} /></Field>
                <button className="button primary" type="submit" disabled={busy}>Record decision</button>
              </form>
            </Panel>
          )}

          {file.receipt && (
            <Panel icon="report" title="Receipt">
              <p className="app-note">{file.receipt.id} · {money(file.receipt.amount, file.receipt.currency)} · {file.receipt.signatory}</p>
              <div className="app-inline-actions">
                <button className="button secondary" type="button" onClick={() => window.print()}>Print</button>
                <button className="button secondary" type="button" onClick={() => void openProtectedFile(`/donations/${file.id}/receipt.pdf`)}>Download PDF</button>
                {write && <button className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.sendReceipt(file.id, 'EMAIL'))}>Send by email</button>}
                {write && <button className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.sendReceipt(file.id, 'SMS'))}>Send by SMS</button>}
              </div>
            </Panel>
          )}

          {write && ['RECEIVED', 'APPROVED', 'ALLOCATED', 'UNDER_REVIEW'].includes(file.status) && (
            <Panel icon="report" title="Refund">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                act(() => api.donations.refund(file.id, {
                  amount: Number(data.amount),
                  reason: data.reason,
                  destination: data.destination,
                  originalTransactionReference: data.originalTransactionReference,
                  documents: refundDocuments.filter((item) => item.fileName.trim()),
                }))
              }}>
                <Field label="Original amount" note="automatic"><input value={`${file.amount} ${file.currency}`} disabled /></Field>
                <Field label="Refund amount" note="required"><input name="amount" type="number" min="1" required /></Field>
                <Field label="Currency" note="automatic"><input value={file.currency} disabled /></Field>
                <Field label="Original transaction reference" note="optional"><input name="originalTransactionReference" defaultValue={file.payments.find((payment) => payment.status === 'SUCCESS')?.transactionReference ?? ''} /></Field>
                <Field label="Destination" note="required"><input name="destination" required /></Field>
                <Field label="Reason" note="required" span="full"><textarea name="reason" required rows={2} /></Field>
                <DocFields documents={refundDocuments} onChange={setRefundDocuments} types={['SUPPORT', 'OTHER']} />
                <button className="button secondary" type="submit" disabled={busy}>Request refund</button>
              </form>
              {file.refunds.map((refund) => (
                <div key={refund.id} className="app-inline-actions">
                  <StatusPill value={refund.status} />
                  <span>{money(refund.amount, refund.currency)} · {refund.reason}</span>
                  {['REVIEW', 'APPROVE', 'PROCESS', 'COMPLETE', 'REJECT'].map((action) => (
                    <button key={action} className="button secondary" type="button" disabled={busy} onClick={() => act(() => api.donations.advanceRefund(file.id, refund.id, action))}>{action}</button>
                  ))}
                </div>
              ))}
            </Panel>
          )}

          {write && ['RECEIVED', 'APPROVED', 'ALLOCATED', 'UNDER_REVIEW'].includes(file.status) && (
            <Panel icon="ledger" title="Adjustment">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                act(() => api.donations.adjust(file.id, {
                  adjustmentType: data.adjustmentType,
                  amount: Number(data.amount || 0),
                  reason: data.reason,
                  documentName: data.documentName,
                  donationType: data.donationType || undefined,
                  campaignId: data.campaignId || undefined,
                  beneficiaryId: data.beneficiaryId || undefined,
                }))
              }}>
                <Field label="Original amount" note="automatic"><input value={`${file.amount} ${file.currency}`} disabled /></Field>
                <Field label="Adjustment type" note="required">
                  <select name="adjustmentType">
                    {['AMOUNT_CORRECTION', 'CLASSIFICATION_CORRECTION', 'CAMPAIGN_CORRECTION', 'BENEFICIARY_CORRECTION', 'OTHER'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Adjustment amount" hint="Use a negative amount to reduce an amount correction."><input name="amount" type="number" defaultValue="0" /></Field>
                <Field label="Corrected type" note="optional">
                  <select name="donationType" defaultValue="">
                    <option value="">Unchanged</option>
                    {DONATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Corrected campaign ID" note="optional"><input name="campaignId" /></Field>
                <Field label="Corrected beneficiary ID" note="optional"><input name="beneficiaryId" /></Field>
                <Field label="Supporting document" note="optional"><input name="documentName" /></Field>
                <Field label="Reason" note="required" span="full"><textarea name="reason" required rows={2} /></Field>
                <button className="button secondary" type="submit" disabled={busy}>Record adjustment</button>
              </form>
            </Panel>
          )}

          {write && (
            <Panel icon="shield" title="Compliance">
              <form className="app-form" onSubmit={(event) => {
                event.preventDefault()
                const data = Object.fromEntries(new FormData(event.currentTarget).entries())
                const flags = ['donorIdentified', 'donorVerified', 'sourceRecorded', 'approvalsObtained', 'documentationComplete', 'beneficiaryVerified', 'restrictionsRecorded', 'reportingCompleted']
                const body = Object.fromEntries(flags.map((flag) => [flag, data[flag] === 'on']))
                act(() => api.donations.compliance(file.id, { ...body, result: data.result, comments: data.comments }))
              }}>
                {[
                  ['donorIdentified', 'Donor identification completed'],
                  ['donorVerified', 'Donor verification completed'],
                  ['sourceRecorded', 'Source and purpose recorded'],
                  ['approvalsObtained', 'Required approvals obtained'],
                  ['documentationComplete', 'Donation documentation complete'],
                  ['beneficiaryVerified', 'Beneficiary verification completed'],
                  ['restrictionsRecorded', 'Restricted-purpose conditions recorded'],
                  ['reportingCompleted', 'Required reporting completed'],
                ].map(([name, label]) => (
                  <label key={name} className="app-check"><input type="checkbox" name={name} /><span>{label}</span></label>
                ))}
                <Field label="Result" note="required">
                  <select name="result" defaultValue="PENDING_REVIEW">
                    {['COMPLIANT', 'PENDING_REVIEW', 'NON_COMPLIANT', 'ESCALATED'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Comments" note="optional" span="full"><textarea name="comments" rows={2} /></Field>
                <button className="button secondary" type="submit" disabled={busy}>Save compliance review</button>
              </form>
            </Panel>
          )}

          {write && file.status === 'DISTRIBUTED' && (
            <button className="button primary" type="button" disabled={busy} onClick={() => act(() => api.donations.closeGift(file.id))}>Close donation</button>
          )}

          <Panel icon="shield" title="Audit trail">
            <Table
              columns={['When', 'Action', 'From', 'To', 'Officer', 'Reason']}
              empty="No audit events yet."
              rows={file.audits.map((item) => [item.createdAt.slice(0, 16).replace('T', ' '), item.action, item.previousStatus ?? '—', item.newStatus ?? '—', item.userId ?? '—', item.reason ?? '—'])}
            />
          </Panel>
        </>
      )}
    </>
  )
}
