import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { money } from '../../../platform/format'
import { Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { FormSteps, StepNav, kept, onSubmit, useAction, useFormSteps } from '../donations/kit'
import { ACCOUNT_TYPES, CONTRIBUTION_TYPES, FREQUENCIES, MOVEMENT_TYPES, PAYMENT_METHODS, checked, num, str, today } from './catalog'

export function AccountList() {
  usePageTitle('Escrow accounts — UPSA Next Payment')
  const data = useLoad(() => api.escrow.accounts())
  return (
    <>
      <PageHeading kicker="Escrow" title="Escrow accounts" lead="Available balance, the restricted financing component and frozen funds are shown separately." icon="ledger" actions={<Link className="button primary" to="/app/escrow/accounts/new">Open account</Link>} />
      {data.error && <p className="form-error">{data.error}</p>}
      <Table
        columns={['Account', 'Group', 'Closing', 'Available', 'Restricted', 'Frozen', 'Status']}
        empty="No escrow account is open."
        rows={(data.data?.items ?? []).map((item) => [
          <Link key={item.accountId} to={`/app/escrow/accounts/${item.accountId}`}>{item.name}</Link>,
          item.groupName ?? '—',
          money(item.closing, item.currency),
          money(item.available, item.currency),
          money(item.restricted, item.currency),
          money(item.frozen, item.currency),
          <StatusPill key={`${item.accountId}-status`} value={item.status} />,
        ])}
      />
    </>
  )
}

const STEPS = ['Account', 'Parties and bank', '40/60 and controls']

export function AccountForm() {
  usePageTitle('Open escrow — UPSA Next Payment')
  const navigate = useNavigate()
  const groups = useLoad(() => api.escrow.groups())
  const schools = useLoad(() => api.schools.list())
  const institutions = useLoad(() => api.institutions.list())
  const form = useFormSteps()
  const action = useAction()
  return (
    <>
      <PageHeading kicker="Escrow" title="Open an escrow account" lead="Set the member percentage and the financing percentage. They must add up to 100. The default is 40 and 60." icon="ledger" />
      <form className="form-wizard" onSubmit={onSubmit((event) => {
        const values = Object.fromEntries(Object.entries(form.collect(event.currentTarget)).filter(([, value]) => value !== ''))
        const data = new FormData(event.currentTarget)
        action.run(async () => {
          const created = await api.escrow.openAccount({
            ...values,
            memberPercent: Number(values.memberPercent || 40),
            financePercent: Number(values.financePercent || 60),
            requiredContribution: Number(values.requiredContribution || 0),
            requiredFinancing: Number(values.requiredFinancing || 0),
            minimumBalance: Number(values.minimumBalance || 0),
            maximumBalance: Number(values.maximumBalance || 0),
            withdrawalRestricted: checked(data, 'withdrawalRestricted'),
            approvalRequired: checked(data, 'approvalRequired'),
            dualAuthorization: checked(data, 'dualAuthorization'),
            freezeAllowed: checked(data, 'freezeAllowed'),
            partialReleaseAllowed: checked(data, 'partialReleaseAllowed'),
            setOffAllowed: checked(data, 'setOffAllowed'),
            mode: 'submit',
            groupId: values.groupId || undefined,
            schoolId: values.schoolId || undefined,
            institutionId: values.institutionId || undefined,
          })
          navigate(`/app/escrow/accounts/${created.accountId}`)
        })
      })}>
        <FormSteps steps={STEPS} step={form.step} onPick={(index) => form.move(document.querySelector('.form-wizard') as HTMLFormElement, index, STEPS.length)} />
        {form.step === 0 && (
          <div className="app-form">
            <Field label="Account name"><input name="name" defaultValue={kept(form.values, 'name')} required /></Field>
            <Field label="Account type"><select name="accountType" defaultValue={kept(form.values, 'accountType', 'GROUP_ESCROW')}>{ACCOUNT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Escrow product"><input name="product" defaultValue={kept(form.values, 'product', '40/60 group escrow')} required /></Field>
            <Field label="Currency"><input name="currency" defaultValue={kept(form.values, 'currency', 'RWF')} required /></Field>
            <Field label="Purpose"><textarea name="purpose" defaultValue={kept(form.values, 'purpose')} required /></Field>
            <Field label="Description" hint="optional"><textarea name="description" defaultValue={kept(form.values, 'description')} /></Field>
            <Field label="Opening date"><input name="openingDate" type="date" defaultValue={kept(form.values, 'openingDate', today())} required /></Field>
            <Field label="Expected closing date" hint="optional"><input name="expectedClosingDate" type="date" defaultValue={kept(form.values, 'expectedClosingDate')} /></Field>
          </div>
        )}
        {form.step === 1 && (
          <div className="app-form">
            <Field label="Group" hint="optional"><select name="groupId" defaultValue={kept(form.values, 'groupId')}><option value="">None</option>{(groups.data?.items ?? []).map((group) => <option key={group.groupId} value={group.groupId}>{group.name}</option>)}</select></Field>
            <Field label="School" hint="optional"><select name="schoolId" defaultValue={kept(form.values, 'schoolId')}><option value="">None</option>{(schools.data?.items ?? []).map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></Field>
            <Field label="Financial institution" hint="optional"><select name="institutionId" defaultValue={kept(form.values, 'institutionId')}><option value="">None</option>{(institutions.data?.items ?? []).map((item) => <option key={item.financialInstitutionId} value={item.financialInstitutionId}>{item.name}</option>)}</select></Field>
            <Field label="Group representative" hint="optional"><input name="representative" defaultValue={kept(form.values, 'representative')} /></Field>
            <Field label="Authorized signatory" hint="optional"><input name="signatory" defaultValue={kept(form.values, 'signatory')} /></Field>
            <Field label="Contact" hint="optional"><input name="contact" defaultValue={kept(form.values, 'contact')} /></Field>
            <Field label="Bank name" hint="optional"><input name="bankName" defaultValue={kept(form.values, 'bankName')} /></Field>
            <Field label="Branch" hint="optional"><input name="branch" defaultValue={kept(form.values, 'branch')} /></Field>
            <Field label="Bank account number" hint="optional"><input name="bankAccountNumber" defaultValue={kept(form.values, 'bankAccountNumber')} /></Field>
            <Field label="Bank account name" hint="optional"><input name="bankAccountName" defaultValue={kept(form.values, 'bankAccountName')} /></Field>
            <Field label="Settlement account" hint="optional"><input name="settlementAccount" defaultValue={kept(form.values, 'settlementAccount')} /></Field>
          </div>
        )}
        {form.step === 2 && (
          <div className="app-form">
            <Field label="Member percentage"><input name="memberPercent" type="number" min="0" max="100" step="0.01" defaultValue={kept(form.values, 'memberPercent', '40')} required /></Field>
            <Field label="Financing percentage"><input name="financePercent" type="number" min="0" max="100" step="0.01" defaultValue={kept(form.values, 'financePercent', '60')} required /></Field>
            <Field label="Required contribution"><input name="requiredContribution" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'requiredContribution', '0')} /></Field>
            <Field label="Required financing"><input name="requiredFinancing" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'requiredFinancing', '0')} /></Field>
            <Field label="Minimum balance"><input name="minimumBalance" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'minimumBalance', '0')} /></Field>
            <Field label="Maximum balance"><input name="maximumBalance" type="number" min="0" step="0.01" defaultValue={kept(form.values, 'maximumBalance', '0')} /></Field>
            <Field label="Contribution frequency"><select name="contributionFrequency" defaultValue={kept(form.values, 'contributionFrequency', 'MONTHLY')}>{FREQUENCIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Allocation rule" hint="optional"><input name="allocationRule" defaultValue={kept(form.values, 'allocationRule', '40/60')} /></Field>
            <Field label="Release rule" hint="optional"><input name="releaseRule" defaultValue={kept(form.values, 'releaseRule')} /></Field>
            <label className="app-check"><input name="withdrawalRestricted" type="checkbox" defaultChecked /> Withdrawal needs approval</label>
            <label className="app-check"><input name="approvalRequired" type="checkbox" defaultChecked /> Release needs approval</label>
            <label className="app-check"><input name="dualAuthorization" type="checkbox" /> Dual authorization</label>
            <label className="app-check"><input name="freezeAllowed" type="checkbox" defaultChecked /> Freeze allowed</label>
            <label className="app-check"><input name="partialReleaseAllowed" type="checkbox" defaultChecked /> Partial release allowed</label>
            <label className="app-check"><input name="setOffAllowed" type="checkbox" /> Set-off allowed by the agreement</label>
          </div>
        )}
        {action.error && <p className="form-error">{action.error}</p>}
        <StepNav step={form.step} count={STEPS.length} busy={action.busy} submitLabel="Submit for approval" onBack={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step - 1, STEPS.length)} onNext={() => form.move(document.querySelector('.form-wizard') as HTMLFormElement, form.step + 1, STEPS.length)} />
      </form>
    </>
  )
}

export function AccountFilePage() {
  usePageTitle('Escrow account — UPSA Next Payment')
  const { accountId = '' } = useParams()
  const { can } = useAuth()
  const data = useLoad(() => api.escrow.account(accountId), [accountId])
  const action = useAction()
  const file = data.data
  if (!file) return data.error ? <p className="form-error">{data.error}</p> : <p>Loading the escrow account.</p>
  const currency = String(file.currency ?? 'RWF')
  const write = can('guarantee.write')
  const contributions = (file.contributions as { contributionId: string; memberName: string; amount: number; memberAllocation: number; financeAllocation: number; status: string }[]) ?? []
  return (
    <>
      <PageHeading kicker="Escrow" title={String(file.name)} lead={`${file.memberPercent}% member contribution and ${file.financePercent}% restricted financing component. The financing component is not a loan.`} icon="ledger" />
      <p><StatusPill value={String(file.status)} /> {String(file.accountNumber)}</p>
      <div className="app-stats">
        <p><b>Closing</b> {money(Number(file.closing), currency)}</p>
        <p><b>Available</b> {money(Number(file.available), currency)}</p>
        <p><b>Restricted</b> {money(Number(file.restricted), currency)}</p>
        <p><b>Frozen</b> {money(Number(file.frozen), currency)}</p>
        <p><b>Member component</b> {money(Number(file.member), currency)}</p>
        <p><b>Financing component</b> {money(Number(file.finance), currency)}</p>
      </div>
      {write && file.status !== 'ACTIVE' && file.status !== 'CLOSED' && (
        <button className="button primary" type="button" disabled={action.busy} onClick={() => action.run(async () => { await api.escrow.decideAccount(accountId, 'ACTIVE'); data.reload() })}>Activate account</button>
      )}
      {action.error && <p className="form-error">{action.error}</p>}
      <Panel title="Contributions" wide>
        <Table columns={['Member', 'Amount', '40% side', '60% side', 'Status']} empty="No contribution yet." rows={contributions.map((item) => [item.memberName, money(item.amount, currency), money(item.memberAllocation, currency), money(item.financeAllocation, currency), item.status])} />
      </Panel>
      {write && file.status === 'ACTIVE' && (
        <Panel title="Add a contribution" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.contribute(accountId, {
                memberName: str(form, 'memberName'),
                contributionType: str(form, 'contributionType'),
                amount: num(form, 'amount'),
                contributionDate: str(form, 'contributionDate'),
                paymentMethod: str(form, 'paymentMethod'),
                paymentReference: str(form, 'paymentReference'),
                externalTransactionId: str(form, 'externalTransactionId') || undefined,
                sourceOfFunds: str(form, 'sourceOfFunds'),
              })
              data.reload()
            })
          })}>
            <Field label="Member name"><input name="memberName" required /></Field>
            <Field label="Contribution type"><select name="contributionType">{CONTRIBUTION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
            <Field label="Date"><input name="contributionDate" type="date" defaultValue={today()} required /></Field>
            <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Payment reference" hint="optional"><input name="paymentReference" /></Field>
            <Field label="External transaction ID" hint="Required for a bank, PSP, mobile money or card payment."><input name="externalTransactionId" /></Field>
            <Field label="Source of funds" hint="optional"><input name="sourceOfFunds" /></Field>
            <button className="button primary" type="submit" disabled={action.busy}>Receive contribution</button>
          </form>
        </Panel>
      )}
      {write && (file.status === 'ACTIVE' || file.status === 'FROZEN') && (
        <>
          <Panel title="Freeze funds" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                const fileNow = await api.escrow.freeze(accountId, { amount: num(form, 'amount'), reason: str(form, 'reason'), authority: str(form, 'authority'), startDate: str(form, 'startDate'), endDate: str(form, 'endDate') || undefined, legalReference: str(form, 'legalReference') })
                const freeze = ((fileNow.freezes as { freezeId: string; status: string }[]) ?? []).find((item) => item.status === 'REQUESTED')
                if (freeze) await api.escrow.decideFreeze(accountId, freeze.freezeId, 'ACTIVE')
                data.reload()
              })
            })}>
              <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
              <Field label="Reason"><input name="reason" required /></Field>
              <Field label="Authority" hint="optional"><input name="authority" /></Field>
              <Field label="Start"><input name="startDate" type="date" defaultValue={today()} required /></Field>
              <Field label="End" hint="optional"><input name="endDate" type="date" /></Field>
              <Field label="Legal reference" hint="optional"><input name="legalReference" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Freeze</button>
            </form>
          </Panel>
          <Panel title="Release funds" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                const requested = await api.escrow.release(accountId, {
                  amount: num(form, 'amount'),
                  fromRestricted: checked(form, 'fromRestricted'),
                  purpose: str(form, 'purpose'),
                  beneficiary: str(form, 'beneficiary'),
                  destinationAccount: str(form, 'destinationAccount'),
                  paymentMethod: str(form, 'paymentMethod'),
                })
                const release = ((requested.releases as { releaseId: string; status: string }[]) ?? []).find((item) => item.status === 'REQUESTED')
                if (release) {
                  await api.escrow.decideRelease(accountId, release.releaseId, {
                    decision: 'RELEASED',
                    paymentMethod: str(form, 'paymentMethod'),
                    externalTransactionId: str(form, 'externalTransactionId') || undefined,
                    paymentReference: str(form, 'paymentReference'),
                  })
                }
                data.reload()
              })
            })}>
              <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
              <Field label="Purpose"><input name="purpose" required /></Field>
              <Field label="Beneficiary"><input name="beneficiary" required /></Field>
              <Field label="Destination account"><input name="destinationAccount" required /></Field>
              <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="External transaction ID"><input name="externalTransactionId" /></Field>
              <Field label="Payment reference" hint="optional"><input name="paymentReference" /></Field>
              <label className="app-check"><input name="fromRestricted" type="checkbox" /> Release the restricted financing component</label>
              <button className="button secondary" type="submit" disabled={action.busy}>Request and release</button>
            </form>
          </Panel>
          <Panel title="Withdrawal, refund or other movement" wide>
            <form className="app-form" onSubmit={onSubmit((event) => {
              const form = new FormData(event.currentTarget)
              action.run(async () => {
                const kind = str(form, 'kind')
                if (kind === 'WITHDRAWAL') {
                  await api.escrow.withdraw(accountId, { amount: num(form, 'amount'), reason: str(form, 'reason'), beneficiary: str(form, 'beneficiary'), destinationAccount: str(form, 'destinationAccount'), approval: str(form, 'approval'), paymentMethod: str(form, 'paymentMethod'), externalTransactionId: str(form, 'externalTransactionId') || undefined })
                } else if (kind === 'REFUND') {
                  await api.escrow.refund(accountId, { amount: num(form, 'amount'), reason: str(form, 'reason'), beneficiary: str(form, 'beneficiary'), refundDate: today(), paymentMethod: str(form, 'paymentMethod'), externalTransactionId: str(form, 'externalTransactionId') || undefined, destinationAccount: str(form, 'destinationAccount') })
                } else {
                  await api.escrow.movement(accountId, { type: kind, amount: num(form, 'amount'), transactionDate: today(), purpose: str(form, 'reason'), externalTransactionId: str(form, 'externalTransactionId') || undefined })
                }
                data.reload()
              })
            })}>
              <Field label="Kind"><select name="kind"><option>WITHDRAWAL</option><option>REFUND</option>{MOVEMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Amount"><input name="amount" type="number" min="1" step="0.01" required /></Field>
              <Field label="Reason"><input name="reason" required /></Field>
              <Field label="Beneficiary"><input name="beneficiary" defaultValue="Group" /></Field>
              <Field label="Destination account"><input name="destinationAccount" defaultValue="Settlement" /></Field>
              <Field label="Approval reference" hint="Required when withdrawal is restricted."><input name="approval" /></Field>
              <Field label="Payment method"><select name="paymentMethod">{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="External transaction ID"><input name="externalTransactionId" /></Field>
              <button className="button secondary" type="submit" disabled={action.busy}>Post</button>
            </form>
          </Panel>
        </>
      )}
    </>
  )
}
