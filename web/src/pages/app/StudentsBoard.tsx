import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type StudentRow } from '../../platform/api'
import { useAuth } from '../../platform/AuthContext'
import { money } from '../../platform/format'
import { Banner, Field, matchesQuery, Modal, PageHeading, Panel, RowActions, SearchField, Stat, StatusPill, Table } from '../../platform/ui'
import { useLoad } from '../../platform/useLoad'
import { usePageTitle } from '../../components/usePageTitle'

type Mode = { type: 'edit' | 'delete'; record: StudentRow }

export function StudentsBoard() {
  usePageTitle('Students — UPSA Next Payment')
  const { can } = useAuth()
  const students = useLoad(() => api.students.list())
  const schools = useLoad(() => can('school.read') ? api.schools.list() : Promise.resolve({ items: [] }))
  const schoolName = (id: string) => schools.data?.items.find((school) => school.schoolId === id)?.schoolName ?? id
  const firstId = students.data?.items[0]?.studentId
  const summary = useLoad(
    () => firstId ? api.students.summary(firstId) : Promise.resolve(null),
    [firstId],
  )
  const [mode, setMode] = useState<Mode | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = mode?.record ?? null
  const visible = (students.data?.items ?? []).filter((item) =>
    matchesQuery(query, item.studentName, item.studentExternalId, schoolName(item.schoolId), item.classLevel, item.academicYear, item.status, item.feeCategory),
  )

  async function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.students.update(selected.studentId, {
        studentName: String(form.get('studentName')),
        studentExternalId: String(form.get('studentExternalId')),
        classLevel: String(form.get('classLevel')),
        academicYear: String(form.get('academicYear')),
        feeCategory: String(form.get('feeCategory') || ''),
        status: String(form.get('status')),
      })
      setMode(null)
      students.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the student.')
    } finally {
      setBusy(false)
    }
  }

  async function onDeactivate() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await api.students.remove(selected.studentId)
      setMode(null)
      students.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not deactivate the student.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-page">
      <PageHeading
        kicker="Families"
        title="Students"
        lead="School relationship, class and the authoritative financial account."
        icon="family"
        actions={(
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search students…" />
            {can('student.write') && <Link className="button primary" to="/app/students/new">Register student</Link>}
          </>
        )}
      />
      {(students.error || error) && <Banner>{students.error || error}</Banner>}
      {summary.data && (
        <div className="app-stats">
          <Stat icon="ledger" label="Billed" value={money(summary.data.totalBilled)} />
          <Stat icon="pay" label="Paid" value={money(summary.data.totalPaid)} />
          <Stat icon="ledger" label="Outstanding" value={money(summary.data.outstanding)} />
        </div>
      )}
      <Panel icon="family" title="Roll">
        {students.loading ? <p className="app-empty">Loading students…</p> : (
          <Table
            columns={['Student', 'School', 'Class', 'Year', 'Status', 'Actions']}
            empty={query ? 'No students match that search.' : 'No students found.'}
            rows={visible.map((item) => [
              item.studentName,
              schoolName(item.schoolId),
              item.classLevel,
              item.academicYear,
              <StatusPill key={item.studentId} value={item.status} />,
              <RowActions key={`${item.studentId}-actions`}>
                <Link to={`/app/students/${item.studentId}`}>View</Link>
                {can('student.write') && <button type="button" onClick={() => setMode({ type: 'edit', record: item })}>Edit</button>}
                {can('student.write') && item.status !== 'INACTIVE' && <button type="button" className="danger" onClick={() => setMode({ type: 'delete', record: item })}>Deactivate</button>}
              </RowActions>,
            ])}
          />
        )}
      </Panel>

      <Modal open={mode?.type === 'edit'} title="Edit student" onClose={() => setMode(null)} footer={<button className="button primary" form="student-edit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}>
        {selected && (
          <form id="student-edit" className="app-form" onSubmit={onEdit}>
            <Field label="Student name" span="full">
              <input name="studentName" required defaultValue={selected.studentName} />
            </Field>
            <Field label="External ID">
              <input name="studentExternalId" required defaultValue={selected.studentExternalId} />
            </Field>
            <Field label="Class">
              <input name="classLevel" required defaultValue={selected.classLevel} />
            </Field>
            <Field label="Academic year">
              <input name="academicYear" required defaultValue={selected.academicYear} />
            </Field>
            <Field label="Fee category">
              <input name="feeCategory" defaultValue={selected.feeCategory ?? ''} />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={selected.status}>
                {['APPLICANT', 'ACTIVE', 'TRANSFERRED', 'GRADUATED', 'SUSPENDED', 'WITHDRAWN', 'INACTIVE'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
              </select>
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={mode?.type === 'delete'}
        title="Deactivate student"
        onClose={() => setMode(null)}
        footer={(
          <>
            <button className="button secondary" type="button" onClick={() => setMode(null)}>Keep active</button>
            <button className="button primary" type="button" disabled={busy} onClick={onDeactivate}>{busy ? 'Updating…' : 'Deactivate'}</button>
          </>
        )}
      >
        <p className="app-empty">{selected?.studentName} will be marked inactive. Invoices already issued stay on the ledger.</p>
      </Modal>
    </div>
  )
}
