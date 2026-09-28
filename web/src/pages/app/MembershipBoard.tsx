import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MembershipCertificate } from '../../components/MembershipCertificate'
import { api, type MembershipApplicationRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { Banner, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

export function MembershipBoard() {
  usePageTitle('Membership review — UPSA Next Payment')
  const { can } = useAuth()
  const applications = useLoad(() => api.membershipApplications.list())
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [certificate, setCertificate] = useState<MembershipApplicationRow | null>(null)
  const items = applications.data?.items ?? []
  const visible = items.filter((item) =>
    matchesQuery(query, item.applicationId, item.schoolName, item.contactName, item.email, item.address.district, item.status),
  )

  async function decide(applicationId: string, decision: 'CONFIRMED' | 'REJECTED') {
    setBusyId(applicationId)
    setError('')
    try {
      await api.membershipApplications.decide(applicationId, { decision })
      applications.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The decision could not be recorded.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Membership"
        title="UPSA membership review"
        lead="Public requests arrive as submitted. Confirming a request is an administrator decision. Submission does not accept the school."
        icon="shield"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search requests…" />
            <Link className="button secondary" to="/membership">Public request</Link>
          </>
        )}
      />
      {(applications.error || error) && <Banner>{applications.error || error}</Banner>}
      <div className="app-stats">
        <Stat icon="ledger" label="In review" value={String(items.filter((item) => item.status === 'SUBMITTED').length)} />
        <Stat icon="shield" label="Confirmed" value={String(items.filter((item) => item.status === 'CONFIRMED').length)} />
        <Stat icon="report" label="Not confirmed" value={String(items.filter((item) => item.status === 'REJECTED').length)} />
      </div>
      <Panel icon="shield" title="Requests">
        {applications.loading ? <p className="app-empty">Loading membership requests…</p> : (
          <Table
            columns={['School', 'Reference', 'Contact', 'Location', 'Status', 'Actions']}
            empty={query ? 'No requests match that search.' : 'No membership requests yet.'}
            rows={visible.map((item) => [
              item.schoolName,
              item.applicationId,
              item.email,
              `${item.address.district}, ${item.address.province}`,
              <StatusPill key={item.applicationId} value={item.status === 'SUBMITTED' ? 'IN_REVIEW' : item.status} />,
              <RowActions key={`${item.applicationId}-actions`}>
                {item.status === 'CONFIRMED' && (
                  <button className="app-text-btn" type="button" onClick={() => setCertificate(item)}>Certificate</button>
                )}
                {item.status === 'SUBMITTED' && can('school.write') && (
                  <>
                    <button className="app-text-btn" type="button" disabled={busyId === item.applicationId} onClick={() => void decide(item.applicationId, 'CONFIRMED')}>Confirm</button>
                    <button className="app-text-btn" type="button" disabled={busyId === item.applicationId} onClick={() => void decide(item.applicationId, 'REJECTED')}>Reject</button>
                  </>
                )}
              </RowActions>,
            ])}
          />
        )}
      </Panel>
      <Modal open={Boolean(certificate)} title="Membership certificate" onClose={() => setCertificate(null)} size="wide">
        {certificate && (
          <MembershipCertificate
            applicationId={certificate.applicationId}
            schoolName={certificate.schoolName}
            contactName={certificate.contactName}
            title={certificate.title}
            location={[certificate.address.sector, certificate.address.district, certificate.address.province].filter(Boolean).join(', ')}
            reviewedAt={certificate.reviewedAt}
            reviewerName={certificate.reviewerName}
            reviewerTitle={certificate.reviewerTitle}
            verifyUrl={certificate.verifyUrl}
          />
        )}
      </Modal>
    </div>
  )
}
