import { useState, type FormEvent } from 'react'
import { api, type InvoiceRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, SearchSelect, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

type Mode = { type: 'create' } | { type: 'view' | 'edit' | 'delete'; record: InvoiceRow }

export function InvoicesBoard() {
  usePageTitle('Invoices — UPSA Next Payment')
  const { can } = useAuth()
  const invoices = useLoad(() => api.invoices.list())
  const students = useLoad(() => can('student.read') ? api.students.list() : Promise.resolve({ items: [] }))
  const studentName = (id: string) => students.data?.items.find((student) => student.studentId === id)?.studentName ?? id
  const [mode, setMode] = useState<Mode | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = mode && mode.type !== 'create' ? mode.record : null
  const visible = (invoices.data?.items ?? []).filter((item) =>
    matchesQuery(query, item.description, item.invoiceId, studentName(item.studentId), item.status, item.amount, item.balance),
  )

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const studentId = String(form.get('studentId'))
    const student = students.data?.items.find((item) => item.studentId === studentId)
    setBusy(true)
    setError('')
    try {
      await api.invoices.create({
        schoolId: student?.schoolId ?? '',
        studentId,
        amount: Number(form.get('amount')),
        description: String(form.get('description')),
        dueDate: String(form.get('dueDate')),
      })
      setMode(null)
      invoices.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the invoice.')
    } finally {
      setBusy(false)
    }
  }

  async function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.invoices.update(selected.invoiceId, {
        amount: Number(form.get('amount')),
        description: String(form.get('description')),
        dueDate: String(form.get('dueDate')),
      })
      setMode(null)
      invoices.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the invoice.')
    } finally {
      setBusy(false)
    }
  }

  async function onCancel() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await api.invoices.cancel(selected.invoiceId)
      setMode(null)
      invoices.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the invoice.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Ledger"
        title="Invoices"
        lead="The invoice is the record of what is owed. Payments only change how much has arrived."
        icon="ledger"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search invoices…" />
            {can('invoice.write') && <button className="button primary" type="button" onClick={() => setMode({ type: 'create' })}>Issue invoice</button>}
          </>
        )}
      />
      {(invoices.error || error) && <Banner>{invoices.error || error}</Banner>}
      <Panel icon="ledger" title="School ledger">
        {invoices.loading ? <p className="app-empty">Loading invoices…</p> : (
          <Table
            columns={['Invoice', 'Student', 'Amount', 'Balance', 'Status', 'Actions']}
            empty={query ? 'No invoices match that search.' : 'No invoices in the ledger.'}
            rows={visible.map((item) => [
              item.description,
              studentName(item.studentId),
              money(item.amount, item.currency),
              money(item.balance, item.currency),
              <StatusPill key={item.invoiceId} value={item.status} />,
              <RowActions key={`${item.invoiceId}-actions`}>
                <button type="button" onClick={() => setMode({ type: 'view', record: item })}>View</button>
                {can('invoice.write') && item.status === 'ISSUED' && item.amountPaid === 0 && (
                  <button type="button" onClick={() => setMode({ type: 'edit', record: item })}>Edit</button>
                )}
                {can('invoice.write') && item.status !== 'PAID' && item.status !== 'CANCELLED' && (
                  <button type="button" className="danger" onClick={() => setMode({ type: 'delete', record: item })}>Cancel</button>
                )}
              </RowActions>,
            ])}
          />
        )}
      </Panel>

      <Modal open={mode?.type === 'create'} title="Issue invoice" onClose={() => setMode(null)} footer={<button className="button primary" form="invoice-create" disabled={busy}>{busy ? 'Saving…' : 'Create invoice'}</button>}>
        <form id="invoice-create" className="app-form" onSubmit={onCreate}>
          <Field label="Student" span="full" hint="Search the student on the school roll">
            <SearchSelect
              name="studentId"
              required
              placeholder="Search students…"
              defaultValue={students.data?.items[0]?.studentId}
              options={(students.data?.items ?? []).map((student) => ({
                value: student.studentId,
                label: student.studentName,
                hint: `${student.classLevel} · ${student.academicYear}`,
              }))}
            />
          </Field>
          <Field label="Description" span="full">
            <input name="description" required placeholder="Term 3 School Fees" />
          </Field>
          <Field label="Amount (RWF)">
            <input name="amount" type="number" min="1" required placeholder="300000" />
          </Field>
          <Field label="Due date">
            <input name="dueDate" type="date" required />
          </Field>
        </form>
      </Modal>

      <Modal open={mode?.type === 'view'} title="Invoice record" onClose={() => setMode(null)}>
        {selected && (
          <dl className="app-dl">
            <div><dt>Invoice</dt><dd>{selected.invoiceId}</dd></div>
            <div><dt>Description</dt><dd>{selected.description}</dd></div>
            <div><dt>Student</dt><dd>{studentName(selected.studentId)}</dd></div>
            <div><dt>Amount</dt><dd>{money(selected.amount, selected.currency)}</dd></div>
            <div><dt>Paid</dt><dd>{money(selected.amountPaid, selected.currency)}</dd></div>
            <div><dt>Balance</dt><dd>{money(selected.balance, selected.currency)}</dd></div>
            <div><dt>Due</dt><dd>{selected.dueDate}</dd></div>
            <div><dt>Status</dt><dd><StatusPill value={selected.status} /></dd></div>
          </dl>
        )}
      </Modal>

      <Modal open={mode?.type === 'edit'} title="Edit invoice" onClose={() => setMode(null)} footer={<button className="button primary" form="invoice-edit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}>
        {selected && (
          <form id="invoice-edit" className="app-form" onSubmit={onEdit}>
            <Field label="Description" span="full">
              <input name="description" required defaultValue={selected.description} />
            </Field>
            <Field label="Amount (RWF)">
              <input name="amount" type="number" min="1" required defaultValue={selected.amount} />
            </Field>
            <Field label="Due date">
              <input name="dueDate" type="date" required defaultValue={selected.dueDate} />
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={mode?.type === 'delete'}
        title="Cancel invoice"
        onClose={() => setMode(null)}
        footer={(
          <>
            <button className="button secondary" type="button" onClick={() => setMode(null)}>Keep invoice</button>
            <button className="button primary" type="button" disabled={busy} onClick={onCancel}>{busy ? 'Cancelling…' : 'Cancel invoice'}</button>
          </>
        )}
      >
        <p className="app-empty">{selected?.invoiceId} will be cancelled. The school ledger remains the record of what was issued.</p>
      </Modal>
    </div>
  )
}
