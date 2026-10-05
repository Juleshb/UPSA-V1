import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../../../components/usePageTitle'
import type { AccountFile } from '../../../platform/account'
import { api } from '../../../platform/api'
import { useAuth } from '../../../platform/AuthContext'
import { money } from '../../../platform/format'
import { Banner, Field, PageHeading, Panel, StatusPill, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { Check, Options, onSubmit, useAction } from '../donations/kit'
import { KYC_CHECKS, label } from './catalog'

export function AccountFilePage() {
  const { accountId = '' } = useParams()
  usePageTitle('Account file — UPSA Next Payment')
  const auth = useAuth()
  const writable = auth.can('account.write')
  const file = useLoad(() => api.accounts.account(accountId), [accountId])
  const statement = useLoad(() => api.accounts.statement(accountId), [accountId])
  const { error, busy, run } = useAction()
  const account = file.data

  function refresh(action: () => Promise<unknown>) {
    void run(async () => {
      await action()
      const next = await api.accounts.account(accountId)
      file.setData(next)
      const snapshot = await api.accounts.statement(accountId)
      statement.setData(snapshot)
    })
  }

  return (
    <>
      <PageHeading
        kicker="Account file"
        title={account ? account.applicantName : 'Account file'}
        lead={account ? `${label(account.accountType)} · ${account.id}` : 'Loading the account file.'}
        icon="shield"
        actions={<Link className="button secondary" to="/app/accounts/applications">All applications</Link>}
      />
      {(file.error || error) && <Banner>{file.error || error}</Banner>}
      {account && (
        <>
          <Panel icon="user" title="Where this file stands">
            <div className="app-stats">
              <StatusPill value={account.status} />
              <StatusPill value={account.kycResult === 'PENDING' ? 'KYC PENDING' : account.kycResult} />
              <StatusPill value={account.duplicateResult} />
            </div>
            <p>{account.nextStep}</p>
            <Table
              columns={['Applicant', 'Contact', 'Linked record', 'Role', 'MFA']}
              empty="Account details are still loading."
              rows={[[
                account.applicantName,
                `${account.phone}${account.email ? ` · ${account.email}` : ''}`,
                account.party ? `${account.party.source} ${account.party.name} · ${account.party.id}` : 'Assigned on activation',
                account.roleName ?? 'Assigned on approval',
                account.mfaMethod ? `${account.mfaMethod}${account.accessIssued ? ' · login linked' : ''}` : 'Required at activation',
              ]]}
            />
          </Panel>
          <Panel icon="school" title="Details collected on the application">
            <Table
              columns={['Field', 'Value']}
              empty="No extra details yet."
              rows={[
                ['Purpose', account.purpose],
                ['Channel', label(account.channel)],
                ['Address', [account.address, account.village, account.cell, account.sector, account.district, account.province].filter(Boolean).join(', ')],
                ['Identity', account.identityNumber ?? '—'],
                ...Object.entries(account.profile).filter(([key]) => !key.startsWith('kyc_')).map(([key, value]) => [key, value]),
              ]}
            />
            {account.documents.length > 0 && (
              <Table columns={['Document', 'File']} empty="No documents on the file." rows={account.documents.map((item) => [label(item.documentType), item.fileName])} />
            )}
          </Panel>
          {writable && <Review account={account} busy={busy} refresh={refresh} />}
          <Panel icon="ledger" title="Statement">
            {statement.error && <Banner>{statement.error}</Banner>}
            {statement.data && (
              <>
                <div className="app-stats">
                  <p>Billed {money(statement.data.billed, statement.data.currency)}</p>
                  <p>Paid {money(statement.data.paid, statement.data.currency)}</p>
                  <p>Outstanding {money(statement.data.outstanding, statement.data.currency)}</p>
                </div>
                <Table
                  columns={['Invoice', 'Description', 'Balance', 'Status', 'Due']}
                  empty={account.party ? 'No invoices on the linked record.' : 'A statement is available after the account links to a school or student.'}
                  rows={statement.data.invoices.map((item) => [item.id, item.description, money(item.balance, item.currency), item.status, item.dueDate])}
                />
              </>
            )}
          </Panel>
          <Panel icon="report" title="Audit trail">
            <Table
              columns={['When', 'Action', 'From', 'To', 'Note']}
              empty="No actions on this file yet."
              rows={account.audits.map((item) => [item.at.slice(0, 16).replace('T', ' '), label(item.action), item.previousStatus ? label(item.previousStatus) : '—', item.newStatus ? label(item.newStatus) : '—', item.reason ?? '—'])}
            />
          </Panel>
        </>
      )}
    </>
  )
}

function Review({ account, busy, refresh }: { account: AccountFile; busy: boolean; refresh: (action: () => Promise<unknown>) => void }) {
  const checks = KYC_CHECKS[account.accountType] ?? KYC_CHECKS.PARENT
  const [kyc, setKyc] = useState<Record<string, boolean>>({})
  const [verified, setVerified] = useState(true)
  const parties = useLoad(() => api.accounts.parties(account.accountType), [account.accountType])

  return (
    <>
      {account.status === 'MORE_INFORMATION_REQUIRED' && (
        <Panel icon="user" title="Resubmit">
          <p>{account.rejectionReason}</p>
          <button className="button primary" type="button" disabled={busy} onClick={() => refresh(() => api.accounts.update(account.id, {
            mode: 'submit',
            accountType: account.accountType,
            channel: account.channel,
            purpose: account.purpose,
            language: account.language,
            communicationPreference: account.communicationPreference,
            applicantName: account.applicantName,
            identityNumber: account.identityNumber ?? undefined,
            phone: account.phone,
            email: account.email ?? undefined,
            province: account.province ?? undefined,
            district: account.district ?? undefined,
            sector: account.sector ?? undefined,
            cell: account.cell ?? undefined,
            village: account.village ?? undefined,
            address: account.address ?? undefined,
            termsAccepted: account.termsAccepted,
            privacyAccepted: account.privacyAccepted,
            dataConsent: account.dataConsent,
            digitalAccess: account.digitalAccess,
            mobileAccess: account.mobileAccess,
            webAccess: account.webAccess,
            documents: account.documents,
            profile: account.profile,
          }))}>Resubmit application</button>
        </Panel>
      )}
      {account.status === 'SUBMITTED' && (
        <Panel icon="report" title="Document review">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.documents(account.id, { verified, comments: String(data.get('comments') ?? '') }))
          })}>
            <Check label="The documents are complete and match the applicant" checked={verified} onChange={setVerified} />
            <Field label="Comments" note="optional"><input name="comments" /></Field>
            <button className="button primary" type="submit" disabled={busy}>{verified ? 'Verify documents' : 'Return the documents'}</button>
          </form>
        </Panel>
      )}
      {account.status === 'DOCUMENT_REVIEW' && (
        <Panel icon="shield" title={account.accountType === 'SCHOOL' || account.accountType === 'SUPPLIER' ? 'KYB' : 'KYC'}>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            const result = String(data.get('result'))
            refresh(() => api.accounts.kyc(account.id, { result, notes: String(data.get('notes') ?? ''), checks: kyc }))
          })}>
            {checks.map((item) => (
              <Check key={item.key} label={item.label} checked={Boolean(kyc[item.key])} onChange={(checked) => setKyc((current) => ({ ...current, [item.key]: checked }))} />
            ))}
            <Field label="Result" note="required">
              <select name="result" required defaultValue="VERIFIED"><Options options={['VERIFIED', 'REJECTED']} /></select>
            </Field>
            <Field label="Notes" note="optional"><input name="notes" /></Field>
            <button className="button primary" type="submit" disabled={busy}>Save KYC result</button>
          </form>
        </Panel>
      )}
      {account.status === 'KYC_KYB' && account.kycResult === 'VERIFIED' && (
        <Panel icon="user" title="Phone, email, and address">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.contacts(account.id, {
              phoneStatus: String(data.get('phoneStatus')),
              emailStatus: String(data.get('emailStatus')),
              addressStatus: String(data.get('addressStatus')),
              reference: String(data.get('reference')),
            }))
          })}>
            <Field label="Phone" note="required"><select name="phoneStatus" defaultValue="VERIFIED"><Options options={['VERIFIED', 'FAILED', 'PENDING']} /></select></Field>
            <Field label="Email" note="required"><select name="emailStatus" defaultValue="VERIFIED"><Options options={['VERIFIED', 'FAILED', 'PENDING']} /></select></Field>
            <Field label="Address" note="required"><select name="addressStatus" defaultValue="VERIFIED"><Options options={['VERIFIED', 'FAILED', 'PENDING']} /></select></Field>
            <Field label="Verification reference" note="required" hint="Record the reference only. The one-time code is not stored."><input name="reference" required minLength={3} /></Field>
            <button className="button primary" type="submit" disabled={busy}>Save contact verification</button>
          </form>
        </Panel>
      )}
      {account.status === 'VERIFICATION' && (
        <Panel icon="search" title="Duplicate check">
          <p>The check looks at open accounts, schools, guardians, students, and registrations. A confirmed match must be linked or rejected.</p>
          {account.duplicateMatches.length > 0 && (
            <Table columns={['Source', 'Record', 'Name', 'Result']} empty="No duplicate matches." rows={account.duplicateMatches.map((item) => [item.source, item.id, item.name, label(item.reason)])} />
          )}
          <div className="app-inline-actions">
            <button className="button primary" type="button" disabled={busy} onClick={() => refresh(() => api.accounts.duplicates(account.id))}>Run duplicate check</button>
          </div>
          {account.duplicateResult === 'POSSIBLE_DUPLICATE' && (
            <form className="app-form" onSubmit={onSubmit((event) => refresh(() => api.accounts.clearDuplicate(account.id, String(new FormData(event.currentTarget).get('note') ?? ''))))}>
              <Field label="Why this can proceed" span="full" note="required"><input name="note" required minLength={5} /></Field>
              <button className="button secondary" type="submit" disabled={busy}>Clear possible duplicate</button>
            </form>
          )}
          {account.duplicateResult === 'CONFIRMED_DUPLICATE' && (
            <form className="app-form" onSubmit={onSubmit((event) => refresh(() => api.accounts.linkParty(account.id, String(new FormData(event.currentTarget).get('partyId') ?? ''))))}>
              <Field label="Link the existing record" span="full" note="required">
                <select name="partyId" required defaultValue="">
                  <option value="">Select the existing record</option>
                  {(parties.data?.parties ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
                </select>
              </Field>
              <button className="button secondary" type="submit" disabled={busy}>Link and check again</button>
            </form>
          )}
        </Panel>
      )}
      {account.status === 'PENDING_APPROVAL' && !account.riskLevel && (
        <Panel icon="shield" title="Risk and compliance">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.risk(account.id, { riskLevel: String(data.get('riskLevel')), complianceResult: String(data.get('complianceResult')), notes: String(data.get('notes')) }))
          })}>
            <Field label="Risk" note="required"><select name="riskLevel" required defaultValue="LOW"><Options options={['LOW', 'MEDIUM', 'HIGH']} /></select></Field>
            <Field label="Compliance" note="required"><select name="complianceResult" required defaultValue="CLEAR"><Options options={['CLEAR', 'REVIEW', 'FAILED']} /></select></Field>
            <Field label="Notes" span="full" note="required"><input name="notes" required minLength={5} defaultValue="Standard account opening review." /></Field>
            <button className="button primary" type="submit" disabled={busy}>Save risk assessment</button>
          </form>
        </Panel>
      )}
      {account.status === 'PENDING_APPROVAL' && account.riskLevel && (
        <Panel icon="shield" title="Approval">
          <p>Risk {account.riskLevel}. Compliance {label(account.complianceResult)}. {account.riskNotes}</p>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.decision(account.id, {
              decision: String(data.get('decision')),
              conditions: String(data.get('conditions') ?? ''),
              reason: String(data.get('reason') ?? ''),
            }))
          })}>
            <Field label="Decision" note="required">
              <select name="decision" required defaultValue="APPROVE"><Options options={['APPROVE', 'CONDITIONAL', 'MORE_INFORMATION', 'REJECT']} /></select>
            </Field>
            <Field label="Conditions" note="optional"><input name="conditions" /></Field>
            <Field label="Reason" note="optional" hint="Required when rejecting or asking for more information."><input name="reason" /></Field>
            <button className="button primary" type="submit" disabled={busy}>Record decision</button>
          </form>
        </Panel>
      )}
      {account.status === 'APPROVED' && (
        <Panel icon="pay" title="Activation">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.activate(account.id, {
              username: String(data.get('username')),
              mfaMethod: String(data.get('mfaMethod')),
              dailyLimit: Number(data.get('dailyLimit')),
              transactionLimit: Number(data.get('transactionLimit')),
            }))
          })}>
            <Field label="Username" note="required"><input name="username" required minLength={3} defaultValue={account.applicantName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')} /></Field>
            <Field label="Verification method" note="required"><select name="mfaMethod" required defaultValue="SMS"><Options options={['APP', 'SMS', 'EMAIL']} /></select></Field>
            <Field label="Daily limit (RWF)" note="required"><input name="dailyLimit" type="number" min="0" required defaultValue={account.accountType === 'SCHOOL' ? 5000000 : 500000} /></Field>
            <Field label="Transaction limit (RWF)" note="required"><input name="transactionLimit" type="number" min="0" required defaultValue={account.accountType === 'SCHOOL' ? 1000000 : 200000} /></Field>
            <button className="button primary" type="submit" disabled={busy}>Activate account</button>
          </form>
        </Panel>
      )}
      {['ACTIVE', 'SUSPENDED', 'DORMANT'].includes(account.status) && (
        <Panel icon="shield" title="Security and status">
          <p>Role {account.roleName}. Limits {money(account.limits.daily)} daily, {money(account.limits.transaction)} per transaction. {account.legalHold ? `Legal hold: ${account.legalHoldReason}` : 'No legal hold.'}</p>
          {account.devices.length > 0 && <Table columns={['Device', 'Registered']} empty="No devices registered." rows={account.devices.map((item) => [item.name, item.registeredAt.slice(0, 10)])} />}
          {account.status === 'ACTIVE' && (
            <form className="app-form" onSubmit={onSubmit((event) => refresh(() => api.accounts.device(account.id, String(new FormData(event.currentTarget).get('name') ?? ''))))}>
              <Field label="Device name" note="required"><input name="name" required minLength={2} /></Field>
              <button className="button secondary" type="submit" disabled={busy}>Register device</button>
            </form>
          )}
          <ReasonForm busy={busy} label="Suspension reason" action="Suspend" onSubmit={(reason) => refresh(() => api.accounts.suspend(account.id, reason))} />
          {account.status !== 'ACTIVE' && <button className="button primary" type="button" disabled={busy} onClick={() => refresh(() => api.accounts.reactivate(account.id))}>Reactivate</button>}
          {account.status === 'ACTIVE' && <button className="button secondary" type="button" disabled={busy} onClick={() => refresh(() => api.accounts.dormant(account.id, 'Marked dormant by an officer'))}>Mark dormant</button>}
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            const active = data.get('active') === 'hold'
            refresh(() => api.accounts.hold(account.id, { active, reason: String(data.get('reason') ?? '') }))
          })}>
            <Field label="Legal hold" note="required">
              <select name="active" defaultValue={account.legalHold ? 'hold' : 'release'}><option value="hold">Place a hold</option><option value="release">Release the hold</option></select>
            </Field>
            <Field label="Hold reason" note="optional"><input name="reason" /></Field>
            <button className="button secondary" type="submit" disabled={busy}>Update hold</button>
          </form>
          {account.closureBlockers.length > 0 && <p>Closure is waiting on {account.closureBlockers.join(', ')}.</p>}
          <ReasonForm busy={busy} label="Closure reason" action="Close account" onSubmit={(reason) => refresh(() => api.accounts.close(account.id, reason))} />
        </Panel>
      )}
      {account.accountType === 'PARENT' && account.status === 'ACTIVE' && (
        <Panel icon="family" title="Link a student">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.linkStudent(account.id, {
              studentPublicId: String(data.get('studentPublicId')),
              relationship: String(data.get('relationship')),
              financialResponsibility: data.get('financialResponsibility') === 'on',
              paymentAuthorization: data.get('paymentAuthorization') === 'on',
            }))
          })}>
            <Field label="Student" note="required">
              <select name="studentPublicId" required defaultValue="">
                <option value="">Select a student</option>
                {(parties.data?.students ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Relationship" note="required"><input name="relationship" required defaultValue="Parent" /></Field>
            <label className="app-check"><input type="checkbox" name="financialResponsibility" /><span>Financial responsibility</span></label>
            <label className="app-check"><input type="checkbox" name="paymentAuthorization" /><span>Payment authorisation</span></label>
            <button className="button primary" type="submit" disabled={busy}>Link student</button>
          </form>
        </Panel>
      )}
      {['DRAFT', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'DORMANT'].includes(account.status) && (
        <Panel icon="user" title="Change a detail">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.change(account.id, { field: String(data.get('field')), value: String(data.get('value')), reason: String(data.get('reason')) }))
          })}>
            <Field label="Field" note="required">
              <select name="field" required defaultValue="phone">
                {['applicantName', 'phone', 'email', 'address', 'province', 'district', 'profile.accountNumber', 'profile.bankName'].map((field) => <option key={field} value={field}>{field}</option>)}
              </select>
            </Field>
            <Field label="New value" note="required"><input name="value" required /></Field>
            <Field label="Reason" span="full" note="required"><input name="reason" required minLength={5} /></Field>
            <button className="button secondary" type="submit" disabled={busy}>Apply change</button>
          </form>
          {account.changes.length > 0 && <Table columns={['Field', 'From', 'To', 'Reason']} empty="No changes recorded." rows={account.changes.map((item) => [item.field, item.previous || '—', item.value, item.reason])} />}
        </Panel>
      )}
      {!['REJECTED', 'CLOSED', 'ACTIVE', 'APPROVED'].includes(account.status) && account.status !== 'PENDING_APPROVAL' && (
        <Panel icon="report" title="Reject or ask for more information">
          <form className="app-form" onSubmit={onSubmit((event) => {
            const data = new FormData(event.currentTarget)
            refresh(() => api.accounts.decision(account.id, { decision: String(data.get('decision')) as 'REJECT' | 'MORE_INFORMATION', reason: String(data.get('reason') ?? '') }))
          })}>
            <Field label="Decision" note="required">
              <select name="decision" required defaultValue="MORE_INFORMATION"><option value="MORE_INFORMATION">More information</option><option value="REJECT">Reject</option></select>
            </Field>
            <Field label="Reason" span="full" note="required"><input name="reason" required minLength={5} /></Field>
            <button className="button secondary" type="submit" disabled={busy}>Record decision</button>
          </form>
        </Panel>
      )}
    </>
  )
}

function ReasonForm({ busy, label: fieldLabel, action, onSubmit: submit }: { busy: boolean; label: string; action: string; onSubmit: (reason: string) => void }) {
  return (
    <form className="app-form" onSubmit={onSubmit((event) => submit(String(new FormData(event.currentTarget).get('reason') ?? '')))}>
      <Field label={fieldLabel} span="full" note="required"><input name="reason" required minLength={5} /></Field>
      <button className="button secondary" type="submit" disabled={busy}>{action}</button>
    </form>
  )
}
