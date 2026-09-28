import { useState, type FormEvent } from 'react'
import { api, type PaymentRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, SearchSelect, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

type Mode = { type: 'create' } | { type: 'view'; record: PaymentRow }

const PAYER_COUNTRIES = [
  ['RW', 'Rwanda — domestic'],
  ['TZ', 'Tanzania — RSwitch ↔ TIPS pilot'],
  ['UG', 'Uganda — planned'],
  ['KE', 'Kenya — planned'],
  ['BI', 'Burundi — planned'],
  ['SS', 'South Sudan — planned'],
  ['CD', 'DRC — planned'],
] as const

export function PaymentsBoard() {
  usePageTitle('Payments — UPSA Next Payment')
  const { can, user } = useAuth()
  const invoices = useLoad(() => api.invoices.list())
  const payments = useLoad(() => api.payments.list())
  const rails = useLoad(() => api.payments.rails())
  const corridors = useLoad(() => api.payments.corridors())
  const events = useLoad(() => api.payments.events())
  const [mode, setMode] = useState<Mode | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const openInvoices = (invoices.data?.items ?? []).filter((item) => item.balance > 0 && item.status !== 'CANCELLED')
  const selected = mode?.type === 'view' ? mode.record : null
  const visible = (payments.data?.items ?? []).filter((item) =>
    matchesQuery(query, item.paymentId, item.status, item.flowCode, item.rail?.name, item.rail?.code, item.amount),
  )

  async function onPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const invoiceId = String(form.get('invoiceId'))
    const amount = Number(form.get('amount'))
    setBusy(true)
    setError('')
    try {
      const payment = await api.payments.initiate({
        invoiceId,
        amount,
        paymentChannel: String(form.get('paymentChannel')) as 'BANK' | 'PSP' | 'MOBILE_PAYMENT' | 'CARD',
        originCountry: String(form.get('originCountry')),
        destinationCountry: 'RW',
        payerReference: user?.userId,
      })
      await api.payments.confirm({
        paymentId: payment.paymentId,
        invoiceId,
        amount,
        transactionReference: `SANDBOX-${payment.paymentId.slice(-6)}`,
      })
      setMode(null)
      invoices.reload()
      payments.reload()
      events.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function act(kind: 'retry' | 'refund', paymentId: string) {
    setBusy(true)
    setError('')
    try {
      const updated = kind === 'retry'
        ? await api.payments.retry(paymentId)
        : await api.payments.refund(paymentId)
      setMode({ type: 'view', record: updated })
      invoices.reload()
      payments.reload()
      events.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Payments"
        title="Payment orchestration"
        lead="UPSA Next Payment routes the instruction. An approved bank, PSP, mobile-money or card rail moves the funds. Cross-border payments use the EAC corridor."
        icon="pay"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search payments…" />
            {can('payment.write') && <button className="button primary" type="button" onClick={() => setMode({ type: 'create' })}>Record payment</button>}
          </>
        )}
      />
      {(payments.error || error) && <Banner>{payments.error || error}</Banner>}
      <Panel icon="pay" title="Payment activity">
        {payments.loading ? <p className="app-empty">Loading payments…</p> : (
          <Table
            columns={['Payment', 'Rail', 'Flow', 'Amount', 'Status', 'Actions']}
            empty={query ? 'No payments match that search.' : 'No payments yet.'}
            rows={visible.map((item) => [
              item.paymentId,
              item.rail?.name ?? '—',
              item.flowCode ?? '—',
              money(item.amount, item.currency),
              <StatusPill key={item.paymentId} value={item.status} />,
              <RowActions key={`${item.paymentId}-actions`}>
                <button type="button" onClick={() => setMode({ type: 'view', record: item })}>View</button>
              </RowActions>,
            ])}
          />
        )}
      </Panel>

      <div className="app-grid">
        <Panel icon="pay" title="Approved payment rails">
          {rails.loading ? <p className="app-empty">Loading rails…</p> : (
            <Table
              columns={['Rail', 'Kind', 'Country', 'Status']}
              empty="No approved rails are registered."
              rows={(rails.data?.items ?? []).map((rail) => [
                rail.name,
                rail.kind.replaceAll('_', ' '),
                `${rail.country} · ${rail.infrastructure}`,
                <StatusPill key={rail.code} value={rail.status} />,
              ])}
            />
          )}
        </Panel>
        <Panel icon="site" title="EAC corridors">
          {corridors.loading ? <p className="app-empty">Loading corridors…</p> : (
            <Table
              columns={['Corridor', 'Path', 'Status']}
              empty="No EAC corridors are registered."
              rows={(corridors.data?.items ?? []).map((corridor) => [
                corridor.code,
                `${corridor.originLabel} ↔ ${corridor.destinationLabel}`,
                <StatusPill key={corridor.code} value={corridor.status} />,
              ])}
            />
          )}
        </Panel>
      </div>

      <Panel icon="report" title="Event bus">
        <div className="app-bus">
          {(events.data?.contract ?? ['PAYMENT.INITIATED', 'PAYMENT.SUCCESS', 'PAYMENT.FAILED', 'PAYMENT.REFUNDED', 'SETTLEMENT.COMPLETED']).map((name) => (
            <i key={name}>{name}</i>
          ))}
        </div>
        {events.loading ? <p className="app-empty">Loading events…</p> : (
          <Table
            columns={['Event', 'Payment', 'When']}
            empty="No payment events yet."
            rows={(events.data?.items ?? []).map((item) => [
              item.event,
              item.aggregateId,
              item.createdAt.slice(0, 16).replace('T', ' '),
            ])}
          />
        )}
      </Panel>

      <Modal open={mode?.type === 'create'} title="Record payment" onClose={() => setMode(null)} footer={<button className="button primary" form="payment-create" disabled={busy || !openInvoices.length}>{busy ? 'Posting…' : 'Pay now'}</button>}>
        <form id="payment-create" className="app-form" onSubmit={onPay}>
          <Field label="Invoice" span="full" hint="Search an open invoice">
            <SearchSelect
              name="invoiceId"
              required
              placeholder="Search open invoices…"
              defaultValue={openInvoices[0]?.invoiceId}
              options={openInvoices.map((item) => ({
                value: item.invoiceId,
                label: item.description,
                hint: `${money(item.balance)} remaining`,
              }))}
            />
          </Field>
          <Field label="Amount (RWF)">
            <input name="amount" type="number" min="1" required defaultValue={openInvoices[0]?.balance || 10000} />
          </Field>
          <Field label="Rail">
            <select name="paymentChannel" defaultValue="MOBILE_PAYMENT">
              <option value="MOBILE_PAYMENT">Mobile money</option>
              <option value="BANK">Bank</option>
              <option value="PSP">PSP</option>
              <option value="CARD">Card</option>
            </select>
          </Field>
          <Field label="Payer country" span="full" hint="Tanzania uses the live RSwitch ↔ TIPS corridor. Other EAC states are planned.">
            <select name="originCountry" defaultValue="RW">
              {PAYER_COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={mode?.type === 'view'}
        title="Payment record"
        onClose={() => setMode(null)}
        footer={selected && can('payment.write') ? (
          <>
            {selected.status === 'FAILED' && (
              <button className="button primary" type="button" disabled={busy} onClick={() => act('retry', selected.paymentId)}>Retry on next rail</button>
            )}
            {selected.status === 'SUCCESS' && (
              <button className="button" type="button" disabled={busy} onClick={() => act('refund', selected.paymentId)}>Refund</button>
            )}
          </>
        ) : undefined}
      >
        {selected && (
          <>
            <dl className="app-dl">
              <div><dt>Payment</dt><dd>{selected.paymentId}</dd></div>
              <div><dt>Flow</dt><dd>{selected.flowCode ?? '—'}</dd></div>
              <div><dt>Rail</dt><dd>{selected.rail ? `${selected.rail.name} · ${selected.rail.infrastructure}` : '—'}</dd></div>
              <div><dt>Corridor</dt><dd>{selected.corridor ? `${selected.corridor.originLabel} ↔ ${selected.corridor.destinationLabel}` : 'Domestic'}</dd></div>
              <div><dt>Amount</dt><dd>{money(selected.amount, selected.currency)}</dd></div>
              <div><dt>Confirmation</dt><dd>{selected.transactionReference ?? '—'}</dd></div>
              <div><dt>Settlement</dt><dd>{selected.settlementReference ?? '—'}</dd></div>
              <div><dt>Status</dt><dd><StatusPill value={selected.status} /></dd></div>
            </dl>
            {selected.lastError && <Banner>{selected.lastError}</Banner>}
            {!!selected.flow?.length && (
              <ol className="app-flow">
                {selected.flow.map((step) => (
                  <li key={`${step.code}-${step.createdAt}`}>
                    <b>{step.code}</b>
                    <span>{step.label}{step.detail ? ` — ${step.detail}` : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
