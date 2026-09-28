import { Link } from 'react-router-dom'
import { api, openSchoolDocument } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import {
  ChannelBars,
  CollectionSplit,
  CollectionsTrend,
  ExposureBars,
  FacilitySplit,
  StatusBars,
} from '../../platform/charts'
import { money, percent } from '../../platform/format'
import { roleHome } from '../../platform/roles'
import { Banner, PageHeading, Panel, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

const DOCUMENT_LABEL: Record<string, string> = {
  LICENSE: 'Operating licence',
  REGISTRATION_CERTIFICATE: 'Registration certificate',
  TIN_CERTIFICATE: 'TIN certificate',
  RUPSA_MEMBERSHIP: 'UPSA membership letter',
  OWNER_IDENTITY: 'Owner identity',
  BANK_LETTER: 'Bank confirmation letter',
  OTHER: 'Other document',
}

export function Dashboard() {
  const { user, can } = useAuth()
  usePageTitle('Workspace — UPSA Next Payment')
  const copy = roleHome(user!.role)
  const overview = useLoad(() => can('report.read') ? api.overview() : Promise.resolve(null), [user?.role])
  const invoices = useLoad(() => can('invoice.read') ? api.invoices.list() : Promise.resolve({ items: [] }), [user?.role])
  const loans = useLoad(() => can('loan.read') ? api.loans.applications() : Promise.resolve({ items: [] }), [user?.role])
  const uploads = useLoad(() => can('admin.write') ? api.schools.uploads() : Promise.resolve({ items: [] }), [user?.role])

  const billed = overview.data?.collections.billed ?? invoices.data?.items.reduce((sum, item) => sum + item.amount, 0) ?? 0
  const paid = overview.data?.collections.collected ?? invoices.data?.items.reduce((sum, item) => sum + item.amountPaid, 0) ?? 0
  const outstanding = overview.data?.collections.outstanding ?? invoices.data?.items.reduce((sum, item) => sum + item.balance, 0) ?? 0
  const series = overview.data?.collections.series ?? []
  const invoiceStatus = overview.data?.invoicesByStatus ?? Object.values(
    (invoices.data?.items ?? []).reduce<Record<string, { status: string; count: number; amount: number }>>((acc, item) => {
      acc[item.status] ??= { status: item.status, count: 0, amount: 0 }
      acc[item.status].count += 1
      acc[item.status].amount += item.balance || item.amount
      return acc
    }, {}),
  )
  const channels = overview.data?.paymentChannels ?? []

  return (
    <div className="app-page">
      <PageHeading
        kicker={copy.kicker}
        title={copy.title}
        lead={copy.lead}
        icon="dash"
        actions={(
          <>
            {can('school.write') && <Link className="button secondary" to="/register">Register school</Link>}
            {can('invoice.write') && <Link className="button primary" to="/app/invoices">Issue invoice</Link>}
            {can('payment.write') && <Link className="button secondary" to="/app/payments">Make a payment</Link>}
          </>
        )}
      />

      {overview.error && <Banner>{overview.error}</Banner>}

      <div className="app-stats">
        {overview.data ? (
          <>
            <Stat icon="school" label="Schools" value={String(overview.data.schools)} />
            <Stat icon="family" label="Students" value={String(overview.data.students)} />
            <Stat icon="pay" label="Collected" value={money(overview.data.collections.collected)} hint={`${percent(overview.data.collections.collectionRate)} collection rate`} />
            <Stat icon="ledger" label="Outstanding fees" value={money(overview.data.collections.outstanding)} />
            {can('loan.read') && <Stat icon="loan" label="Loan book" value={money(overview.data.credit.principalOutstanding)} hint={`${overview.data.credit.activeLoans} active`} />}
            {can('guarantee.read') && <Stat icon="shield" label="Guarantee capacity" value={money(overview.data.guarantee.availableCapacity)} />}
          </>
        ) : (
          <>
            <Stat icon="ledger" label="Billed" value={money(billed)} />
            <Stat icon="pay" label="Paid" value={money(paid)} />
            <Stat icon="ledger" label="Outstanding" value={money(outstanding)} />
            <Stat icon="dash" label="Open invoices" value={String(invoices.data?.items.filter((item) => item.balance > 0).length ?? 0)} />
          </>
        )}
      </div>

      <div className="app-grid charts">
        {can('invoice.read') && series.length > 0 && (
          <Panel wide icon="pay" title="Collections trend" action={<Link to="/app/reports">Open reports</Link>}>
            <CollectionsTrend series={series} />
          </Panel>
        )}
        {can('invoice.read') && (
          <Panel icon="ledger" title="Fee book">
            <CollectionSplit collected={paid} outstanding={outstanding} />
          </Panel>
        )}
        {can('invoice.read') && (
          <Panel icon="ledger" title="Invoice positions">
            <StatusBars items={invoiceStatus} />
          </Panel>
        )}
        {can('payment.read') && channels.length > 0 && (
          <Panel icon="pay" title="Settlement by rail">
            <ChannelBars items={channels} />
          </Panel>
        )}
        {can('loan.read') && overview.data && (
          <Panel icon="loan" title="Balance sheet view">
            <ExposureBars
              credit={overview.data.credit.principalOutstanding}
              outstandingFees={overview.data.collections.outstanding}
              cover={overview.data.guarantee.outstandingGuarantees}
            />
          </Panel>
        )}
        {can('guarantee.read') && overview.data && (
          <Panel icon="shield" title="Guarantee facility">
            <FacilitySplit
              outstanding={overview.data.guarantee.outstandingGuarantees}
              available={overview.data.guarantee.availableCapacity}
            />
          </Panel>
        )}
      </div>

      {can('admin.write') && (
        <Panel wide icon="ledger" title="Uploaded documents" action={<Link to="/app/schools">Open schools</Link>}>
          {uploads.loading ? <p className="app-empty">Loading uploads…</p> : uploads.error ? <Banner>{uploads.error}</Banner> : (
            <Table
              columns={['School', 'Document', 'File', 'Status', 'Open']}
              empty="No documents have been uploaded yet."
              rows={(uploads.data?.items ?? []).map((item) => [
                item.schoolName,
                DOCUMENT_LABEL[item.documentType] ?? item.documentType,
                item.fileName,
                <StatusPill key={`${item.id}-status`} value={item.status} />,
                item.viewable ? (
                  <button key={`${item.id}-view`} type="button" onClick={() => void openSchoolDocument(item.schoolId, item.id)}>View</button>
                ) : 'Name only',
              ])}
            />
          )}
        </Panel>
      )}

      <div className="app-grid">
        {can('invoice.read') && (
          <Panel icon="ledger" title="Ledger" action={<Link to="/app/invoices">View invoices</Link>}>
            {invoices.loading ? <p className="app-empty">Loading ledger…</p> : (
              <Table
                columns={['Invoice', 'Due', 'Balance', 'Status']}
                empty="No invoices yet."
                rows={(invoices.data?.items ?? []).slice(0, 8).map((item) => [
                  item.description,
                  item.dueDate,
                  money(item.balance, item.currency),
                  <StatusPill key={item.invoiceId} value={item.status} />,
                ])}
              />
            )}
          </Panel>
        )}
        {can('loan.read') && (
          <Panel icon="loan" title="Financing pipeline" action={<Link to="/app/loans">View applications</Link>}>
            {loans.loading ? <p className="app-empty">Loading applications…</p> : (
              <Table
                columns={['Application', 'Product', 'Amount', 'Status']}
                empty="No loan applications."
                rows={(loans.data?.items ?? []).slice(0, 8).map((item) => [
                  item.applicationId,
                  item.productCode.replaceAll('_', ' '),
                  money(item.requestedAmount, item.currency),
                  <StatusPill key={item.applicationId} value={item.status} />,
                ])}
              />
            )}
          </Panel>
        )}
      </div>
    </div>
  )
}
