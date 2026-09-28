import { useState, type FormEvent } from 'react'
import { api, type LoanApplicationRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, FieldGroup, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, SearchSelect, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

type Mode = { type: 'create' } | { type: 'view' | 'decide'; record: LoanApplicationRow }

export function LoansBoard() {
  usePageTitle('Financing — UPSA Next Payment')
  const { can } = useAuth()
  const applications = useLoad(() => api.loans.applications())
  const schools = useLoad(() => can('school.read') ? api.schools.list() : Promise.resolve({ items: [] }))
  const institutions = useLoad(() => api.institutions.list())
  const schoolName = (id: string) => schools.data?.items.find((school) => school.schoolId === id)?.schoolName ?? id
  const firstLoan = applications.data?.items.find((item) => item.loanId)?.loanId
  const balance = useLoad(
    () => firstLoan ? api.loans.balance(firstLoan) : Promise.resolve(null),
    [firstLoan],
  )
  const [mode, setMode] = useState<Mode | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = mode && mode.type !== 'create' ? mode.record : null
  const visible = (applications.data?.items ?? []).filter((item) =>
    matchesQuery(query, item.applicationId, schoolName(item.schoolId), item.productCode, item.status, item.decision, item.requestedAmount),
  )

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.loans.apply({
        schoolId: String(form.get('schoolId')),
        financialInstitutionId: String(form.get('financialInstitutionId')),
        productCode: String(form.get('productCode')),
        requestedAmount: Number(form.get('requestedAmount')),
        tenorMonths: Number(form.get('tenorMonths')),
        purpose: String(form.get('purpose')),
        guaranteeRequested: form.get('guaranteeRequested') === 'on',
      })
      setMode(null)
      applications.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the application.')
    } finally {
      setBusy(false)
    }
  }

  async function onDecide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    const decision = String(form.get('decision')) as 'APPROVED' | 'DECLINED'
    setBusy(true)
    setError('')
    try {
      await api.loans.decide(selected.applicationId, {
        decision,
        approvedAmount: decision === 'APPROVED' ? Number(form.get('approvedAmount') || selected.requestedAmount) : undefined,
        tenorMonths: decision === 'APPROVED' ? Number(form.get('tenorMonths') || selected.tenorMonths) : undefined,
        interestRate: decision === 'APPROVED' ? 14 : undefined,
      })
      setMode(null)
      applications.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the decision.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Credit"
        title="Loan marketplace"
        lead="UPSA Next Payment runs the workflow. Licensed institutions keep the final credit decision."
        icon="loan"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search applications…" />
            {can('loan.write') && <button className="button primary" type="button" onClick={() => setMode({ type: 'create' })}>New application</button>}
          </>
        )}
      />
      {(applications.error || error) && <Banner>{applications.error || error}</Banner>}
      {balance.data && (
        <div className="app-stats">
          <Stat icon="loan" label="Loan" value={balance.data.loanId} />
          <Stat icon="ledger" label="Principal outstanding" value={money(balance.data.principalOutstanding)} />
          <Stat icon="report" label="Total outstanding" value={money(balance.data.totalOutstanding)} />
        </div>
      )}
      <Panel icon="loan" title="Applications">
        {applications.loading ? <p className="app-empty">Loading applications…</p> : (
          <Table
            columns={['Application', 'School', 'Product', 'Requested', 'Status', 'Actions']}
            empty={query ? 'No applications match that search.' : 'No financing applications.'}
            rows={visible.map((item) => [
              item.applicationId,
              schoolName(item.schoolId),
              item.productCode.replaceAll('_', ' '),
              money(item.requestedAmount, item.currency),
              <StatusPill key={item.applicationId} value={item.status} />,
              <RowActions key={`${item.applicationId}-actions`}>
                <button type="button" onClick={() => setMode({ type: 'view', record: item })}>View</button>
                {can('loan.write') && !item.decision && <button type="button" onClick={() => setMode({ type: 'decide', record: item })}>Decide</button>}
              </RowActions>,
            ])}
          />
        )}
      </Panel>

      <Modal size="wide" open={mode?.type === 'create'} title="New loan application" onClose={() => setMode(null)} footer={<button className="button primary" form="loan-create" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>}>
        <form id="loan-create" className="app-form" onSubmit={onCreate}>
          <FieldGroup title="Parties">
            <Field label="School" hint="Search the borrowing school">
              <SearchSelect
                name="schoolId"
                required
                placeholder="Search schools…"
                defaultValue={schools.data?.items[0]?.schoolId}
                options={(schools.data?.items ?? []).map((school) => ({
                  value: school.schoolId,
                  label: school.schoolName,
                  hint: `${school.address.district}, ${school.address.province}`,
                }))}
              />
            </Field>
            <Field label="Institution" hint="Licensed lender">
              <SearchSelect
                name="financialInstitutionId"
                required
                placeholder="Search institutions…"
                defaultValue={institutions.data?.items[0]?.financialInstitutionId}
                options={(institutions.data?.items ?? []).map((item) => ({
                  value: item.financialInstitutionId,
                  label: item.name,
                  hint: item.type,
                }))}
              />
            </Field>
          </FieldGroup>
          <FieldGroup title="Facility">
            <Field label="Product">
              <select name="productCode" defaultValue="WORKING_CAPITAL">
                <option value="WORKING_CAPITAL">Working capital</option>
                <option value="EXPANSION">Expansion</option>
                <option value="EQUIPMENT">Equipment</option>
                <option value="ENERGY">Energy</option>
              </select>
            </Field>
            <Field label="Amount (RWF)">
              <input name="requestedAmount" type="number" min="1" required placeholder="50000000" />
            </Field>
            <Field label="Tenor (months)">
              <input name="tenorMonths" type="number" min="1" required defaultValue={12} />
            </Field>
            <Field label="Purpose">
              <input name="purpose" required placeholder="Term cash-flow support" />
            </Field>
            <Field label="Guarantee" span="full">
              <span className="app-check">
                <input name="guaranteeRequested" type="checkbox" />
                Request a UPSA guarantee on this application
              </span>
            </Field>
          </FieldGroup>
        </form>
      </Modal>

      <Modal open={mode?.type === 'view'} title="Application record" onClose={() => setMode(null)}>
        {selected && (
          <dl className="app-dl">
            <div><dt>Application</dt><dd>{selected.applicationId}</dd></div>
            <div><dt>School</dt><dd>{schoolName(selected.schoolId)}</dd></div>
            <div><dt>Product</dt><dd>{selected.productCode.replaceAll('_', ' ')}</dd></div>
            <div><dt>Requested</dt><dd>{money(selected.requestedAmount, selected.currency)}</dd></div>
            <div><dt>Tenor</dt><dd>{selected.tenorMonths} months</dd></div>
            <div><dt>Decision</dt><dd>{selected.decision ?? 'Pending'}</dd></div>
            <div><dt>Status</dt><dd><StatusPill value={selected.status} /></dd></div>
          </dl>
        )}
      </Modal>

      <Modal open={mode?.type === 'decide'} title="Credit decision" onClose={() => setMode(null)} footer={<button className="button primary" form="loan-decide" disabled={busy}>{busy ? 'Saving…' : 'Record decision'}</button>}>
        {selected && (
          <form id="loan-decide" className="app-form" onSubmit={onDecide}>
            <Field label="Decision">
              <select name="decision" defaultValue="APPROVED">
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
              </select>
            </Field>
            <Field label="Approved amount (RWF)">
              <input name="approvedAmount" type="number" min="1" defaultValue={selected.requestedAmount} />
            </Field>
            <Field label="Tenor (months)" span="full">
              <input name="tenorMonths" type="number" min="1" defaultValue={selected.tenorMonths} />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}
