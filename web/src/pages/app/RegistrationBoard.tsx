import { Link } from 'react-router-dom'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { shortDate } from '../../platform/format'
import { Banner, PageHeading, Panel, SearchField, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'
import { useState } from 'react'
import { REGISTRATION_KINDS } from './registrationCatalog'

const KIND_FILTERS = ['', 'SCHOOL', 'PARENT', 'STUDENT', 'TEACHER', 'SUPPLIER', 'INVESTOR', 'DONOR']

export function RegistrationBoard() {
  usePageTitle('Registration — UPSA Next Payment')
  const { can } = useAuth()
  const summary = useLoad(() => api.registrations.summary())
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const registry = useLoad(
    () => api.registrations.list({ q: query || undefined, kind: kind || undefined, status: status || undefined }),
    [query, kind, status],
  )
  const counts = summary.data

  return (
    <div className="app-page">
      <PageHeading
        kicker="Onboarding"
        title="Registration"
        lead="Schools, families, staff, suppliers, investors and donors are registered once, then verified and approved."
        icon="user"
      />
      {(summary.error || registry.error) && <Banner>{summary.error || registry.error}</Banner>}
      <div className="app-stats">
        <Stat icon="user" label="Registered users" value={String(counts?.users ?? '—')} />
        <Stat icon="school" label="Schools" value={String(counts?.schools ?? '—')} />
        <Stat icon="family" label="Parents" value={String(counts?.parents ?? '—')} />
        <Stat icon="family" label="Students" value={String(counts?.students ?? '—')} />
        <Stat icon="user" label="Teachers" value={String(counts?.teachers ?? '—')} />
        <Stat icon="ledger" label="Suppliers" value={String(counts?.suppliers ?? '—')} />
        <Stat icon="loan" label="Investors" value={String(counts?.investors ?? '—')} />
        <Stat icon="pay" label="Donors" value={String(counts?.donors ?? '—')} />
        <Stat icon="report" label="Pending" value={String(counts?.pending ?? '—')} hint="Submitted or still in review" />
        <Stat icon="shield" label="Pending verification" value={String(counts?.pendingVerification ?? '—')} />
        <Stat icon="shield" label="Approved" value={String(counts?.approved ?? '—')} />
        <Stat icon="report" label="Rejected" value={String(counts?.rejected ?? '—')} />
        <Stat icon="user" label="Suspended" value={String(counts?.suspended ?? '—')} />
      </div>

      <Panel icon="user" title="Register">
        <div className="app-kind-grid">
          <Link className="app-kind-card" to="/register">
            <b>Register school</b>
            <span>Public school application, legal documents and representative.</span>
          </Link>
          {can('student.write') && (
            <Link className="app-kind-card" to="/app/students/new">
              <b>Register student</b>
              <span>Admission, guardians, documents and the fee profile.</span>
            </Link>
          )}
          {can('school.write') && REGISTRATION_KINDS.map((item) => (
            <Link key={item.id} className="app-kind-card" to={item.href}>
              <b>Register {item.label.toLowerCase()}</b>
              <span>{item.detail}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel icon="search" title="Registry">
        <div className="app-inline-actions">
          <SearchField value={query} onChange={setQuery} placeholder="Name, ID, telephone, email…" />
          <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Registration type">
            {KIND_FILTERS.map((value) => <option key={value || 'all'} value={value}>{value ? value.replaceAll('_', ' ') : 'All types'}</option>)}
          </select>
          <input value={status} onChange={(event) => setStatus(event.target.value.toUpperCase())} placeholder="Status" aria-label="Status" />
        </div>
        {registry.loading ? <p className="app-empty">Loading the registry…</p> : (
          <Table
            columns={['Name', 'Type', 'Reference', 'Contact', 'Status', 'Opened']}
            empty="No registrations match that search."
            rows={(registry.data?.items ?? []).map((item) => [
              item.href ? <Link key={item.id} to={item.href}>{item.name}</Link> : item.name,
              item.kind.replaceAll('_', ' '),
              item.reference ?? '—',
              item.email || item.phone || '—',
              <StatusPill key={`${item.id}-status`} value={item.status} />,
              shortDate(item.createdAt),
            ])}
          />
        )}
      </Panel>
    </div>
  )
}
