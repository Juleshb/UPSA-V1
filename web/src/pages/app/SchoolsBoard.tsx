import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../platform/api'
import { Banner, matchesQuery, PageHeading, Panel, RowActions, SearchField, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

const REVIEWING = ['SUBMITTED', 'DOCUMENT_REVIEW', 'PENDING_VERIFICATION', 'VERIFICATION', 'APPROVED']

export function SchoolsBoard() {
  usePageTitle('School registration — UPSA Next Payment')
  const schools = useLoad(() => api.schools.list())
  const [query, setQuery] = useState('')
  const items = schools.data?.items ?? []
  const visible = items.filter((item) =>
    matchesQuery(query, item.schoolName, item.rupsaMemberId, item.registrationNumber, item.email, item.address.district, item.address.province, item.status, item.kybStatus, item.membershipStatus),
  )

  return (
    <div className="app-page">
      <PageHeading
        kicker="Module 1"
        title="Member school registration"
        lead="Schools apply on the public registration page. This register is where UPSA reviews documents, membership, KYC and status."
        icon="school"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search the register…" />
            <Link className="button secondary" to="/register">Public registration</Link>
          </>
        )}
      />
      {schools.error && <Banner>{schools.error}</Banner>}
      <div className="app-stats">
        <Stat icon="school" label="Applications" value={String(items.filter((item) => item.status === 'APPLICATION').length)} />
        <Stat icon="ledger" label="In review" value={String(items.filter((item) => REVIEWING.includes(item.status)).length)} />
        <Stat icon="shield" label="Active members" value={String(items.filter((item) => item.status === 'ACTIVE').length)} />
        <Stat icon="report" label="On the register" value={String(items.length)} />
      </div>
      <Panel icon="school" title="Register">
        {schools.loading ? <p className="app-empty">Loading schools…</p> : (
          <Table
            columns={['School', 'Member ID', 'Location', 'Membership', 'KYB', 'Status', 'Actions']}
            empty={query ? 'No schools match that search.' : 'No schools on the register.'}
            rows={visible.map((item) => [
              item.schoolName,
              item.rupsaMemberId ?? '—',
              `${item.address.district}, ${item.address.province}`,
              <StatusPill key={`${item.schoolId}-mem`} value={item.membershipStatus ?? 'UNVERIFIED'} />,
              <StatusPill key={`${item.schoolId}-kyb`} value={item.kybStatus} />,
              <StatusPill key={item.schoolId} value={item.status} />,
              <RowActions key={`${item.schoolId}-actions`}>
                <Link className="app-text-btn" to={`/app/schools/${item.schoolId}`}>Open file</Link>
              </RowActions>,
            ])}
          />
        )}
      </Panel>
    </div>
  )
}
