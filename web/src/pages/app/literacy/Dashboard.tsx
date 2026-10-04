import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../../platform/AuthContext'
import { usePageTitle } from '../../../components/usePageTitle'
import { api } from '../../../platform/api'
import { Banner, PageHeading, Panel, Stat } from '../../../platform/ui'
import { useLoad } from '../../../platform/useLoad'
import { useAction } from '../donations/kit'

const ACTIONS = [
  ['/app/literacy/courses/new', 'Add a course'],
  ['/training', 'Open public training'],
  ['/app/literacy/programmes/new', 'New programme'],
  ['/app/literacy/learners/new', 'Register a learner'],
  ['/app/literacy/certificates', 'Certificates'],
]

export function LiteracyHome() {
  const { can } = useAuth()
  if (!can('literacy.write')) return <Navigate to="/app/literacy/study" replace />
  return <LiteracyDashboard />
}

export function LiteracyDashboard() {
  usePageTitle('Financial literacy — UPSA Next Payment')
  const summary = useLoad(() => api.literacy.summary())
  const { error, busy, run } = useAction()
  const data = summary.data

  return (
    <>
      <PageHeading
        kicker="Admin"
        title="Add a course, then let a student finish it."
        lead="You publish the modules. The student enrols in the classroom, follows each module, and the system issues the certificate when the course is complete."
        icon="report"
        actions={<button className="button secondary" type="button" disabled={busy} onClick={() => void run(async () => { await api.literacy.curriculum(); summary.reload() })}>Install core curriculum</button>}
      />
      {(summary.error || error) && <Banner>{summary.error || error}</Banner>}
      <div className="app-stats">
        <Stat icon="user" label="Learners" value={String(data?.learners ?? '—')} />
        <Stat icon="school" label="Open courses" value={String(data?.courses ?? '—')} />
        <Stat icon="report" label="In progress" value={String(data?.pending ?? '—')} />
        <Stat icon="shield" label="Completed" value={String(data?.completed ?? '—')} />
        <Stat icon="ledger" label="Completion" value={data ? `${data.completionRate}%` : '—'} />
        <Stat icon="pay" label="Pass rate" value={data ? `${data.passRate}%` : '—'} />
        <Stat icon="report" label="Certificates" value={String(data?.certificates ?? '—')} />
        <Stat icon="shield" label="Expiring" value={String(data?.expiring ?? '—')} />
        <Stat icon="user" label="Retraining" value={String(data?.retraining ?? '—')} />
        <Stat icon="ledger" label="Attendance" value={data ? `${data.attendanceRate}%` : '—'} />
        <Stat icon="pay" label="Credit score" value={data ? String(data.credit) : '—'} hint="Average post-assessment" />
        <Stat icon="family" label="Savings score" value={data ? String(data.savings) : '—'} />
      </div>
      <Panel icon="report" title="Quick actions">
        <div className="app-kind-grid">
          {ACTIONS.map(([to, label]) => (
            <Link key={to} className="app-kind-card" to={to}>
              <b>{label}</b>
              <span>Open this step in financial literacy.</span>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  )
}
