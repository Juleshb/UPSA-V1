import { useState } from 'react'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Field, PageHeading, Panel, Table } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAuth } from '../../../platform/AuthContext'
import { onSubmit, useAction } from '../donations/kit'
import { DOCUMENTS, REPORTS, num, str, today } from './catalog'

export function ReportBoard() {
  usePageTitle('Escrow reports — UPSA Next Payment')
  const [type, setType] = useState<string>(REPORTS[0][0])
  const data = useLoad(() => api.escrow.report(type), [type])
  const items = data.data?.items ?? []
  const columns = items[0] ? Object.keys(items[0]) : ['Report']
  return (
    <>
      <PageHeading kicker="Reports" title="Escrow, collateral, guarantee and group risk" lead="Each report reads the control records. Escrow cash, collateral and the guarantee are not added together inside a single balance." icon="report" />
      <Field label="Report">
        <select value={type} onChange={(event) => setType(event.target.value)}>{REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </Field>
      {data.error && <p className="form-error">{data.error}</p>}
      <Table columns={columns} empty="This report has no rows yet." rows={items.map((item) => columns.map((column) => String(item[column] ?? '')))} />
    </>
  )
}

export function ReconciliationBoard() {
  usePageTitle('Escrow reconciliation — UPSA Next Payment')
  const data = useLoad(() => api.escrow.reconciliation())
  const accounts = useLoad(() => api.escrow.accounts())
  const action = useAction()
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Reconciliation" title="Match the escrow ledger to the payment rail" lead="A match needs the same external transaction and the same amount. A repeated external transaction is a duplicate." icon="ledger" />
      <Table
        columns={['Record', 'Account', 'Expected', 'Actual', 'Difference', 'Status']}
        empty="No reconciliation has been recorded."
        rows={(data.data?.items ?? []).map((item) => [String(item.reconciliationId), String(item.accountId ?? '—'), String(item.expectedAmount), String(item.actualAmount), String(item.difference), String(item.matchStatus)])}
      />
      {can('guarantee.write') && (
        <Panel title="Reconcile" wide>
          <form className="app-form" onSubmit={onSubmit((event) => {
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              await api.escrow.reconcile({
                accountId: str(form, 'accountId') || undefined,
                transactionDate: str(form, 'transactionDate'),
                internalId: str(form, 'internalId'),
                externalId: str(form, 'externalId'),
                amount: num(form, 'amount'),
                expectedAmount: num(form, 'expectedAmount'),
                actualAmount: num(form, 'actualAmount'),
                paymentReference: str(form, 'paymentReference'),
                bankName: str(form, 'bankName'),
                exceptionReason: str(form, 'exceptionReason'),
                resolution: str(form, 'resolution'),
              })
              data.reload()
            })
          })}>
            <Field label="Account" hint="optional"><select name="accountId"><option value="">None</option>{(accounts.data?.items ?? []).map((item) => <option key={item.accountId} value={item.accountId}>{item.name}</option>)}</select></Field>
            <Field label="Date"><input name="transactionDate" type="date" defaultValue={today()} required /></Field>
            <Field label="Internal transaction" hint="optional"><input name="internalId" /></Field>
            <Field label="External transaction" hint="optional"><input name="externalId" /></Field>
            <Field label="Amount"><input name="amount" type="number" step="0.01" required /></Field>
            <Field label="Expected"><input name="expectedAmount" type="number" step="0.01" required /></Field>
            <Field label="Actual"><input name="actualAmount" type="number" step="0.01" required /></Field>
            <Field label="Payment reference" hint="optional"><input name="paymentReference" /></Field>
            <Field label="Bank" hint="optional"><input name="bankName" /></Field>
            <Field label="Exception" hint="optional"><input name="exceptionReason" /></Field>
            <Field label="Resolution" hint="optional"><input name="resolution" /></Field>
            {action.error && <p className="form-error">{action.error}</p>}
            <button className="button primary" type="submit" disabled={action.busy}>Save reconciliation</button>
          </form>
        </Panel>
      )}
    </>
  )
}

export function DocumentBoard() {
  usePageTitle('Escrow documents — UPSA Next Payment')
  const data = useLoad(() => api.escrow.documents())
  const action = useAction()
  const { can } = useAuth()
  return (
    <>
      <PageHeading kicker="Documents" title="Agreements, valuations and claim files" lead="Record the file name and the record it supports. Verification is a separate step." icon="report" />
      <Table columns={['Document', 'Type', 'Entity', 'File', 'Status']} empty="No document is on file." rows={(data.data?.items ?? []).map((item) => [String(item.documentId), String(item.documentType), `${item.entityType} ${item.entityId}`, String(item.fileName), String(item.verificationStatus)])} />
      {can('guarantee.write') && (
        <form className="app-form" onSubmit={onSubmit((event) => {
          const form = new FormData(event.currentTarget)
          action.run(async () => {
            await api.escrow.addDocument({
              entityType: str(form, 'entityType'),
              entityId: str(form, 'entityId'),
              documentType: str(form, 'documentType'),
              documentNumber: str(form, 'documentNumber'),
              fileName: str(form, 'fileName'),
              issueDate: str(form, 'issueDate') || undefined,
              comments: str(form, 'comments'),
            })
            data.reload()
          })
        })}>
          <Field label="Entity type"><input name="entityType" required placeholder="EscrowAccount" /></Field>
          <Field label="Entity ID"><input name="entityId" required /></Field>
          <Field label="Document type"><select name="documentType">{DOCUMENTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Document number" hint="optional"><input name="documentNumber" /></Field>
          <Field label="File name"><input name="fileName" required /></Field>
          <Field label="Issue date" hint="optional"><input name="issueDate" type="date" /></Field>
          <Field label="Comments" hint="optional"><input name="comments" /></Field>
          {action.error && <p className="form-error">{action.error}</p>}
          <button className="button primary" type="submit" disabled={action.busy}>Save document</button>
        </form>
      )}
    </>
  )
}

export function NoticeBoard() {
  usePageTitle('Escrow notifications — UPSA Next Payment')
  const data = useLoad(() => api.escrow.notices())
  return (
    <>
      <PageHeading kicker="Notifications" title="What the module has queued" lead="Contributions, allocations, freezes, releases, certificates, claims and recoveries are queued in the app." icon="report" />
      <Table columns={['When', 'Event', 'Subject', 'Message']} empty="No notice yet." rows={(data.data?.items ?? []).map((item) => [String(item.createdAt).slice(0, 16), String(item.event), String(item.subject), String(item.body)])} />
    </>
  )
}

export function AuditBoard() {
  usePageTitle('Escrow audit — UPSA Next Payment')
  const data = useLoad(() => api.escrow.audit())
  return (
    <>
      <PageHeading kicker="Audit" title="Financial and security actions" lead="Each action keeps the officer, the previous status, the new status, the amount and the request." icon="shield" />
      <Table columns={['When', 'Action', 'Entity', 'From', 'To', 'Amount']} empty="No audit row yet." rows={(data.data?.items ?? []).map((item) => [String(item.createdAt).slice(0, 16), String(item.action), `${item.entityType} ${item.entityId}`, String(item.previousStatus ?? ''), String(item.newStatus ?? ''), String(item.amount ?? '')])} />
    </>
  )
}
