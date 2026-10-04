import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import type { DonationDoc } from '../../../platform/donation'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, FieldGroup, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { ALLOCATION_CATEGORIES, DISTRIBUTION_METHODS, today } from './catalog'
import { DocFields, FormSteps, StepNav, useAction, useFormSteps } from './kit'

export function AllocationBoard() {
  usePageTitle('Allocation — UPSA Next Payment')
  const { can } = useAuth()
  const [params] = useSearchParams()
  const status = params.get('status') ?? ''
  const rows = useLoad(() => api.donations.allocations({ status: status || undefined }), [status])
  const gifts = useLoad(() => api.donations.gifts())
  const beneficiaries = useLoad(() => api.donations.beneficiaries({ status: 'VERIFIED' }))
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const allocationSteps = ['Source', 'Amount']
  const pending = (rows.data?.items ?? []).filter((item) => item.status === 'PENDING_APPROVAL' || item.status === 'DRAFT')

  return (
    <>
      <PageHeading kicker="Allocation" title="Where the donation will be used" lead="An allocation can be approved only against a verified beneficiary, and only up to the donation balance that is still unallocated." icon="ledger" />
      {(error || rows.error) && <Banner>{error || rows.error}</Banner>}
      <div className="app-inline-actions">
        <Link to="/app/donations/allocations">All</Link>
        <Link to="/app/donations/allocations?status=PENDING_APPROVAL">Pending approval</Link>
        <Link to="/app/donations/allocations?status=APPROVED">Approved</Link>
      </div>
      {can('donation.write') && (
        <Panel icon="ledger" title="New allocation">
          <div className="form-wizard">
            <FormSteps steps={allocationSteps} step={steps.step} onPick={(index) => {
              const node = document.getElementById('allocation-form') as HTMLFormElement
              steps.move(node, index > steps.step ? steps.step + 1 : index, allocationSteps.length)
            }} />
            <form id="allocation-form" key={steps.step} onSubmit={(event) => {
              event.preventDefault()
              const data = steps.collect(event.currentTarget)
              void run(async () => {
                await api.donations.saveAllocation({ ...data, amount: Number(data.amount) })
                rows.reload()
                steps.reset()
              })
            }}>
              {steps.step === 0 && (
                <FieldGroup title="Source">
                  <Field label="Donation" note="required">
                    <select name="donationId" required defaultValue={saved.donationId ?? ''}>
                      <option value="">Approved donation</option>
                      {(gifts.data?.items ?? []).filter((item) => item.status === 'APPROVED' || item.status === 'ALLOCATED').map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.campaign} · {item.donor}</option>)}
                    </select>
                  </Field>
                  <Field label="Beneficiary" note="required">
                    <select name="beneficiaryId" required defaultValue={saved.beneficiaryId ?? ''}>
                      <option value="">Verified beneficiary</option>
                      {(beneficiaries.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Allocation date" note="required"><input name="allocationDate" type="date" required defaultValue={saved.allocationDate || today()} /></Field>
                </FieldGroup>
              )}
              {steps.step === 1 && (
                <FieldGroup title="Amount">
                  <Field label="Amount" note="required"><input name="amount" type="number" min="1" required defaultValue={saved.amount ?? ''} /></Field>
                  <Field label="Currency" note="required"><input name="currency" defaultValue={saved.currency || 'RWF'} maxLength={3} required /></Field>
                  <Field label="Purpose" note="required"><input name="purpose" required defaultValue={saved.purpose ?? ''} /></Field>
                  <Field label="Category" note="required">
                    <select name="category" defaultValue={saved.category || ALLOCATION_CATEGORIES[0]}>{ALLOCATION_CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
                  </Field>
                </FieldGroup>
              )}
              <StepNav
                step={steps.step}
                count={allocationSteps.length}
                busy={busy}
                onBack={() => steps.move(document.getElementById('allocation-form') as HTMLFormElement, steps.step - 1, allocationSteps.length)}
                onNext={() => steps.move(document.getElementById('allocation-form') as HTMLFormElement, steps.step + 1, allocationSteps.length)}
                submitLabel={busy ? 'Submitting…' : 'Submit for approval'}
              />
            </form>
          </div>
        </Panel>
      )}
      {can('donation.write') && (
        <Panel icon="shield" title="Allocation approval">
          <form className="app-form" onSubmit={(event) => {
            event.preventDefault()
            const data = Object.fromEntries(new FormData(event.currentTarget).entries())
            void run(async () => {
              await api.donations.decideAllocation(String(data.allocationId), { decision: String(data.decision), comments: String(data.comments || '') })
              rows.reload()
            })
          }}>
            <Field label="Allocation" note="required">
              <select name="allocationId" required defaultValue="">
                <option value="">Pending allocation</option>
                {pending.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.beneficiary} · {money(item.amount, item.currency)} · balance {money(item.availableBalance, item.currency)}</option>)}
              </select>
            </Field>
            <Field label="Decision" note="required">
              <select name="decision" defaultValue="APPROVE">
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
                <option value="MORE_INFORMATION">Request more information</option>
              </select>
            </Field>
            <Field label="Comments" note="optional" span="full"><textarea name="comments" rows={2} /></Field>
            <button className="button primary" type="submit" disabled={busy || pending.length === 0}>Record decision</button>
          </form>
        </Panel>
      )}
      <Panel icon="shield" title="Allocations">
        <Table
          columns={['Allocation', 'Donation', 'Donor', 'Beneficiary', 'Amount', 'Available', 'Status']}
          empty="No allocations yet."
          rows={(rows.data?.items ?? []).map((item) => [
            item.id,
            <Link key={item.donationId} to={`/app/donations/gifts/${item.donationId}`}>{item.donationId}</Link>,
            item.donor,
            item.beneficiary,
            money(item.amount, item.currency),
            money(item.availableBalance, item.currency),
            <StatusPill key={`${item.id}-status`} value={item.status} />,
          ])}
        />
      </Panel>
    </>
  )
}

export function DistributionBoard() {
  usePageTitle('Distribution — UPSA Next Payment')
  const { can } = useAuth()
  const rows = useLoad(() => api.donations.distributions())
  const approved = useLoad(() => api.donations.allocations({ status: 'APPROVED' }))
  const { error, busy, run } = useAction()
  const steps = useFormSteps()
  const saved = steps.values
  const [action, setAction] = useState('distribute')
  const [documents, setDocuments] = useState<DonationDoc[]>([{ documentType: 'DELIVERY_NOTE', fileName: '' }])
  const [confirmed, setConfirmed] = useState(false)
  const distributionSteps = action === 'disburse' ? ['Allocation', 'Disbursement'] : ['Allocation', 'Delivery', 'Evidence']

  return (
    <>
      <PageHeading kicker="Distribution" title="Delivery to the beneficiary" lead="Monetary transfers need a successful disbursement first. Every distribution needs the beneficiary’s confirmation and supporting evidence." icon="family" />
      {(error || rows.error) && <Banner>{error || rows.error}</Banner>}
      {can('donation.write') && (
        <Panel icon="pay" title="Disbursement and distribution">
          <div className="form-wizard">
            <FormSteps steps={distributionSteps} step={steps.step} onPick={(index) => {
              const node = document.getElementById('distribution-form') as HTMLFormElement
              const next = index > steps.step ? steps.step + 1 : index
              if (next < distributionSteps.length) steps.move(node, next, distributionSteps.length)
            }} />
            <form id="distribution-form" key={`${action}-${steps.step}`} onSubmit={(event) => {
              event.preventDefault()
              const data = steps.collect(event.currentTarget)
              void run(async () => {
                if (action === 'disburse') {
                  await api.donations.disburse(String(data.allocationId), {
                    amount: data.amount ? Number(data.amount) : undefined,
                    paymentMethod: data.paymentMethod,
                    bankAccount: data.bankAccount,
                    mobileMoneyNumber: data.mobileMoneyNumber,
                    paymentReference: data.paymentReference,
                    paymentDate: data.paymentDate,
                    status: data.status,
                  })
                } else {
                  await api.donations.distribute(String(data.allocationId), {
                    distributionDate: data.distributionDate,
                    method: data.method,
                    location: data.location,
                    itemDescription: data.itemDescription,
                    beneficiaryConfirmed: confirmed,
                    documents: documents.filter((item) => item.fileName.trim()),
                  })
                  rows.reload()
                  approved.reload()
                }
                steps.reset()
                setConfirmed(false)
              })
            }}>
              {steps.step === 0 && (
                <FieldGroup title="Allocation">
                  <Field label="Approved allocation" note="required">
                    <select name="allocationId" required defaultValue={saved.allocationId ?? ''}>
                      <option value="">Select allocation</option>
                      {(approved.data?.items ?? []).filter((item) => item.status === 'APPROVED').map((item) => (
                        <option key={item.id} value={item.id}>{item.beneficiary} · {money(item.amount, item.currency)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Action" note="required">
                    <select value={action} onChange={(event) => { setAction(event.target.value); if (steps.step > 0) steps.reset() }}>
                      <option value="disburse">Disburse money</option>
                      <option value="distribute">Confirm distribution</option>
                    </select>
                  </Field>
                </FieldGroup>
              )}
              {action === 'disburse' && steps.step === 1 && (
                <FieldGroup title="Disbursement">
                  <Field label="Payment method" note="required">
                    <select name="paymentMethod" defaultValue={saved.paymentMethod || 'BANK_TRANSFER'}>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="MOBILE_PAYMENT">Mobile payment</option>
                      <option value="OTHER">Other approved method</option>
                    </select>
                  </Field>
                  <Field label="Bank account" note="optional"><input name="bankAccount" defaultValue={saved.bankAccount ?? ''} /></Field>
                  <Field label="Mobile money number" note="optional"><input name="mobileMoneyNumber" defaultValue={saved.mobileMoneyNumber ?? ''} /></Field>
                  <Field label="Disbursement amount" note="optional"><input name="amount" type="number" min="1" defaultValue={saved.amount ?? ''} /></Field>
                  <Field label="Payment reference" note="optional"><input name="paymentReference" defaultValue={saved.paymentReference ?? ''} /></Field>
                  <Field label="Payment date" note="required"><input name="paymentDate" type="date" required defaultValue={saved.paymentDate || today()} /></Field>
                  <Field label="Payment status" note="required">
                    <select name="status" defaultValue={saved.status || 'SUCCESS'}>
                      {['INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED'].map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </Field>
                </FieldGroup>
              )}
              {action === 'distribute' && steps.step === 1 && (
                <FieldGroup title="Delivery">
                  <Field label="Distribution date" note="required"><input name="distributionDate" type="date" required defaultValue={saved.distributionDate || today()} /></Field>
                  <Field label="Distribution method" note="required">
                    <select name="method" defaultValue={saved.method || 'DIRECT_DELIVERY'}>{DISTRIBUTION_METHODS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
                  </Field>
                  <Field label="Location" note="optional"><input name="location" defaultValue={saved.location ?? ''} /></Field>
                  <Field label="Item or amount delivered" note="optional"><input name="itemDescription" defaultValue={saved.itemDescription ?? ''} /></Field>
                  <Field label="Responsible officer" note="automatic"><input value="Signed-in officer" disabled /></Field>
                </FieldGroup>
              )}
              {action === 'distribute' && steps.step === 2 && (
                <>
                  <label className="app-check">
                    <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    <span>Beneficiary received the donation or resources.</span>
                  </label>
                  <DocFields documents={documents} onChange={setDocuments} types={['DELIVERY_NOTE', 'CONFIRMATION', 'RECEIPT', 'PHOTO', 'OTHER']} />
                </>
              )}
              <StepNav
                step={steps.step}
                count={distributionSteps.length}
                busy={busy}
                onBack={() => steps.move(document.getElementById('distribution-form') as HTMLFormElement, steps.step - 1, distributionSteps.length)}
                onNext={() => steps.move(document.getElementById('distribution-form') as HTMLFormElement, steps.step + 1, distributionSteps.length)}
                submitLabel={busy ? 'Recording…' : action === 'disburse' ? 'Record disbursement' : 'Confirm distribution'}
              />
            </form>
          </div>
        </Panel>
      )}
      <Panel icon="family" title="Distributions">
        <Table
          columns={['Distribution', 'Beneficiary', 'Donation', 'Method', 'Date', 'Officer', 'Confirmed']}
          empty="No distributions yet."
          rows={(rows.data?.items ?? []).map((item) => [
            item.id,
            item.beneficiary,
            <Link key={item.donationId} to={`/app/donations/gifts/${item.donationId}`}>{item.donationId}</Link>,
            item.method.replaceAll('_', ' '),
            item.date ?? '—',
            item.officer,
            item.confirmed ? 'Yes' : 'No',
          ])}
        />
      </Panel>
    </>
  )
}
