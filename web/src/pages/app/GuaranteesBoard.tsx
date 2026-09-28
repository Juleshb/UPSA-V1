import { useState, type FormEvent } from 'react'
import { api, type GuaranteeRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, SearchSelect, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

type Mode = { type: 'create' } | { type: 'view' | 'decide'; record: GuaranteeRow }

export function GuaranteesBoard() {
  usePageTitle('Guarantees — UPSA Next Payment')
  const { can } = useAuth()
  const data = useLoad(() => api.guarantees.list())
  const applications = useLoad(() => can('loan.read') ? api.loans.applications() : Promise.resolve({ items: [] }))
  const institutions = useLoad(() => api.institutions.list())
  const schools = useLoad(() => can('school.read') ? api.schools.list() : Promise.resolve({ items: [] }))
  const schoolName = (id: string) => schools.data?.items.find((school) => school.schoolId === id)?.schoolName ?? id
  const [mode, setMode] = useState<Mode | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = mode && mode.type !== 'create' ? mode.record : null
  const visible = (data.data?.items ?? []).filter((item) =>
    matchesQuery(query, item.guaranteeId, schoolName(item.schoolId), item.status, item.expiryDate, item.guaranteeAmount, item.guaranteedAmount),
  )

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const applicationId = String(form.get('loanApplicationId'))
    const application = applications.data?.items.find((item) => item.applicationId === applicationId)
    setBusy(true)
    setError('')
    try {
      await api.guarantees.request({
        loanApplicationId: applicationId,
        schoolId: application?.schoolId ?? '',
        financialInstitutionId: String(form.get('financialInstitutionId')),
        loanAmount: Number(form.get('loanAmount')),
        guaranteeAmount: Number(form.get('guaranteeAmount')),
      })
      setMode(null)
      data.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request the guarantee.')
    } finally {
      setBusy(false)
    }
  }

  async function onDecide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.guarantees.decide(selected.guaranteeId, {
        decision: String(form.get('decision')) as 'APPROVED' | 'DECLINED',
        guaranteedAmount: Number(form.get('guaranteedAmount') || selected.guaranteeAmount),
        expiryDate: String(form.get('expiryDate') || '') || undefined,
      })
      setMode(null)
      data.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the guarantee decision.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Guarantee"
        title="Facility and register"
        lead="Live view of maximum exposure, available capacity and outstanding cover."
        icon="shield"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search guarantees…" />
            {can('guarantee.write') && <button className="button primary" type="button" onClick={() => setMode({ type: 'create' })}>Request guarantee</button>}
          </>
        )}
      />
      {(data.error || error) && <Banner>{data.error || error}</Banner>}
      {data.data && (
        <div className="app-stats">
          <Stat icon="shield" label="Maximum exposure" value={money(data.data.facility.maximumExposure)} />
          <Stat icon="pay" label="Available" value={money(data.data.facility.availableCapacity)} />
          <Stat icon="ledger" label="Outstanding" value={money(data.data.facility.outstandingGuarantees)} />
          <Stat icon="report" label="Claims" value={money(data.data.facility.claims)} />
        </div>
      )}
      <Panel icon="shield" title="Guarantee register">
        {data.loading ? <p className="app-empty">Loading guarantees…</p> : (
          <Table
            columns={['Guarantee', 'School', 'Cover', 'Expiry', 'Status', 'Actions']}
            empty={query ? 'No guarantees match that search.' : 'No guarantees issued.'}
            rows={visible.map((item) => [
              item.guaranteeId,
              schoolName(item.schoolId),
              money(item.guaranteedAmount ?? item.guaranteeAmount, item.currency),
              item.expiryDate ?? '—',
              <StatusPill key={item.guaranteeId} value={item.status} />,
              <RowActions key={`${item.guaranteeId}-actions`}>
                <button type="button" onClick={() => setMode({ type: 'view', record: item })}>View</button>
                {can('guarantee.write') && item.status === 'REQUESTED' && (
                  <button type="button" onClick={() => setMode({ type: 'decide', record: item })}>Decide</button>
                )}
              </RowActions>,
            ])}
          />
        )}
      </Panel>

      <Modal open={mode?.type === 'create'} title="Request guarantee" onClose={() => setMode(null)} footer={<button className="button primary" form="guarantee-create" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button>}>
        <form id="guarantee-create" className="app-form" onSubmit={onCreate}>
          <Field label="Loan application" span="full" hint="Search the related application">
            <SearchSelect
              name="loanApplicationId"
              required
              placeholder="Search applications…"
              defaultValue={applications.data?.items[0]?.applicationId}
              options={(applications.data?.items ?? []).map((item) => ({
                value: item.applicationId,
                label: item.applicationId,
                hint: `${schoolName(item.schoolId)} · ${money(item.requestedAmount)}`,
              }))}
            />
          </Field>
          <Field label="Institution" span="full">
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
          <Field label="Loan amount (RWF)">
            <input name="loanAmount" type="number" min="1" required placeholder="50000000" />
          </Field>
          <Field label="Guarantee amount (RWF)">
            <input name="guaranteeAmount" type="number" min="1" required placeholder="20000000" />
          </Field>
        </form>
      </Modal>

      <Modal open={mode?.type === 'view'} title="Guarantee record" onClose={() => setMode(null)}>
        {selected && (
          <dl className="app-dl">
            <div><dt>Guarantee</dt><dd>{selected.guaranteeId}</dd></div>
            <div><dt>School</dt><dd>{schoolName(selected.schoolId)}</dd></div>
            <div><dt>Cover</dt><dd>{money(selected.guaranteedAmount ?? selected.guaranteeAmount, selected.currency)}</dd></div>
            <div><dt>Expiry</dt><dd>{selected.expiryDate ?? '—'}</dd></div>
            <div><dt>Status</dt><dd><StatusPill value={selected.status} /></dd></div>
          </dl>
        )}
      </Modal>

      <Modal open={mode?.type === 'decide'} title="Guarantee decision" onClose={() => setMode(null)} footer={<button className="button primary" form="guarantee-decide" disabled={busy}>{busy ? 'Saving…' : 'Record decision'}</button>}>
        {selected && (
          <form id="guarantee-decide" className="app-form" onSubmit={onDecide}>
            <Field label="Decision">
              <select name="decision" defaultValue="APPROVED">
                <option value="APPROVED">Approved</option>
                <option value="DECLINED">Declined</option>
              </select>
            </Field>
            <Field label="Guaranteed amount (RWF)">
              <input name="guaranteedAmount" type="number" min="1" defaultValue={selected.guaranteeAmount} />
            </Field>
            <Field label="Expiry" span="full">
              <input name="expiryDate" type="date" />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}
