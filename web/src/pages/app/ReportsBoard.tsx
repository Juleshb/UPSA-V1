import { api } from '../../platform/api'
import {
  ChannelBars,
  CollectionSplit,
  CollectionsTrend,
  ExposureBars,
  FacilitySplit,
  StatusBars,
} from '../../platform/charts'
import { money, percent } from '../../platform/format'
import { Banner, PageHeading, Panel, Stat } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

export function ReportsBoard() {
  usePageTitle('Reports — UPSA Next Payment')
  const overview = useLoad(() => api.overview())
  const data = overview.data

  return (
    <div className="app-page">
      <PageHeading
        kicker="Reporting"
        title="Financial control view"
        lead="Collections, credit book and guarantee exposure in one operating picture."
        icon="report"
      />
      {overview.error && <Banner>{overview.error}</Banner>}
      {overview.loading && <p className="app-empty">Loading report…</p>}
      {data && (
        <>
          <div className="app-stats">
            <Stat icon="pay" label="Collected" value={money(data.collections.collected)} hint={`${percent(data.collections.collectionRate)} of billed`} />
            <Stat icon="ledger" label="Outstanding fees" value={money(data.collections.outstanding)} />
            <Stat icon="loan" label="Loan book" value={money(data.credit.principalOutstanding)} hint={`${data.credit.activeLoans} active`} />
            <Stat icon="shield" label="Guarantee capacity" value={money(data.guarantee.availableCapacity)} />
          </div>
          <div className="app-grid charts">
            <Panel wide icon="pay" title="Monthly billed vs collected">
              <CollectionsTrend series={data.collections.series ?? []} />
            </Panel>
            <Panel icon="ledger" title="Fee book split">
              <CollectionSplit collected={data.collections.collected} outstanding={data.collections.outstanding} />
            </Panel>
            <Panel icon="ledger" title="Invoice positions">
              <StatusBars items={data.invoicesByStatus ?? []} />
            </Panel>
            <Panel icon="pay" title="Settlement by rail">
              <ChannelBars items={data.paymentChannels ?? []} />
            </Panel>
            <Panel icon="loan" title="Exposure">
              <ExposureBars
                credit={data.credit.principalOutstanding}
                outstandingFees={data.collections.outstanding}
                cover={data.guarantee.outstandingGuarantees}
              />
            </Panel>
            <Panel icon="shield" title="Guarantee facility">
              <FacilitySplit
                outstanding={data.guarantee.outstandingGuarantees}
                available={data.guarantee.availableCapacity}
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
